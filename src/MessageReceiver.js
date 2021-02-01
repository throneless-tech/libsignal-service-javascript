/*
 * vim: ts=2:sw=2:expandtab
 */



const debug = require('debug')('libsignal-service:MessageReceiver');
const _ = require('lodash');
const libsignal = require('@throneless/libsignal-protocol');
const ByteBuffer = require('bytebuffer');
const { default: PQueue } = require('p-queue');
const getGuid = require('uuid/v4');
const WebSocket = require('websocket').w3cwebsocket;
const EventTarget = require('./EventTarget.js');
const Event = require('./Event.js');
const createTaskWithTimeout = require('./taskWithTimeout.js');
const crypto = require('./crypto.js');
const errors = require('./errors.js');
const helpers = require('./helpers.js');
const WebSocketResource = require('./WebSocketResource.js');
const protobuf = require('./protobufs.js');
const Metadata = require('./Metadata.js');

const Content = protobuf.lookupType('signalservice.Content');
const DataMessage = protobuf.lookupType('signalservice.DataMessage');
const Envelope = protobuf.lookupType('signalservice.Envelope');
const GroupContext = protobuf.lookupType('signalservice.GroupContext');
const ReceiptMessage = protobuf.lookupType('signalservice.ReceiptMessage');
const SyncMessage = protobuf.lookupType('signalservice.SyncMessage');
const TypingMessage = protobuf.lookupType('signalservice.TypingMessage');
const { ContactBuffer, GroupBuffer } = protobuf;

/* eslint-disable more/no-then */

const RETRY_TIMEOUT = 2 * 60 * 1000; // two minutes

class MessageReceiver extends EventTarget {
  constructor(store, signalingKey, options = {}) {
    super();
    this.count = 0;

    this.signalingKey = signalingKey;
    this.store = store;
    this.calledClose = false;

    this.incomingQueue = new PQueue({ concurrency: 1 });
    this.pendingQueue = new PQueue({ concurrency: 1 });
    this.appQueue = new PQueue({ concurrency: 1 });

    this.cacheAddBatcher = helpers.createBatcher({
      wait: 200,
      maxSize: 30,
      processBatch: this.cacheAndQueueBatch.bind(this),
    });
    this.cacheUpdateBatcher = helpers.createBatcher({
      wait: 500,
      maxSize: 30,
      processBatch: this.cacheUpdateBatch.bind(this),
    });
    this.cacheRemoveBatcher = helpers.createBatcher({
      wait: 500,
      maxSize: 30,
      processBatch: this.cacheRemoveBatch.bind(this),
    });

    if (options.retryCached) {
      this.pendingQueue.add(() => this.queueAllCached());
    }
  }

  async connect() {
    if (this.server === undefined) {
      this.number = await this.store.getNumber();
      this.uuid = await this.store.getUuid();
      this.deviceId = await this.store.getDeviceId();
      let username = this.uuid || this.number;
      username = `${username  }.${  this.deviceId}`;
      const password = await this.store.getPassword();
      this.server = this.constructor.WebAPI.connect({ username, password });
    }

    if (this.calledClose) {
      return;
    }

    this.count = 0;
    if (this.hasConnected) {
      const ev = new Event('reconnect');
      this.dispatchEvent(ev);
    }

    this.isEmptied = false;
    this.hasConnected = true;

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
      this.wsr.close();
    }
    // initialize the socket and start listening for messages
    this.socket = this.server.getMessageSocket();
    this.socket.onclose = this.onclose.bind(this);
    this.socket.onerror = this.onerror.bind(this);
    this.socket.onopen = this.onopen.bind(this);
    this.wsr = new WebSocketResource(this.socket, {
      handleRequest: this.handleRequest.bind(this),
      keepalive: {
        path: '/v1/keepalive',
        disconnect: true,
      },
    });

    // Because sometimes the socket doesn't properly emit its close event
    this._onClose = this.onclose.bind(this);
    this.wsr.addEventListener('close', this._onClose);
  }

  stopProcessing() {
    debug('MessageReceiver: stopProcessing requested');
    this.stoppingProcessing = true;
    return this.close();
  }

  unregisterBatchers() {
    debug('MessageReceiver: unregister batchers');
    this.cacheAddBatcher.unregister();
    this.cacheUpdateBatcher.unregister();
    this.cacheRemoveBatcher.unregister();
  }

  shutdown() {
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onopen = null;
      this.socket = null;
    }

    if (this.wsr) {
      this.wsr.removeEventListener('close', this._onClose);
      this.wsr = null;
    }
  }

  close() {
    debug('MessageReceiver.close()');
    this.calledClose = true;

    // Our WebSocketResource instance will close the socket and emit a 'close' event
    //   if the socket doesn't emit one quickly enough.
    if (this.wsr) {
      this.wsr.close(3000, 'called close');
    }

    this.clearRetryTimeout();

    return this.drain();
  }

  onopen() {
    debug('websocket open');
  }

  onerror() {
    debug('websocket error');
  }

  dispatchAndWait(event) {
    this.appQueue.add(() => Promise.all(this.dispatchEvent(event)));

    return Promise.resolve();
  }

  onclose(ev) {
    debug(
      'websocket closed',
      ev.code,
      ev.reason || '',
      'calledClose:',
      this.calledClose
    );

    this.shutdown();

    if (this.calledClose) {
      return Promise.resolve();
    }
    if (ev.code === 3000) {
      return Promise.resolve();
    }
    if (ev.code === 3001) {
      this.onEmpty();
    }
    // possible 403 or network issue. Make an request to confirm
    return this.server
      .getDevices(this.number || this.uuid)
      .then(this.connect.bind(this)) // No HTTP error? Reconnect
      .catch(e => {
        const event = new Event('error');
        event.error = e;
        return this.dispatchAndWait(event);
      });
  }

  handleRequest(request) {
    // We do the message decryption here, instead of in the ordered pending queue,
    // to avoid exposing the time it took us to process messages through the time-to-ack.

    if (request.path !== '/api/v1/message') {
      debug('got request', request.verb, request.path);
      request.respond(200, 'OK');

      if (request.verb === 'PUT' && request.path === '/api/v1/queue/empty') {
        this.incomingQueue.add(() => this.onEmpty());
      }
      return;
    }

    const job = async () => {
      let plaintext;
      const headers = request.headers || [];
      if (headers.includes('X-Signal-Key: true')) {
        plaintext = await crypto.decryptWebsocketMessage(
          request.body,
          this.signalingKey
        );
      } else {
        plaintext = request.body.buffer;
      }

      try {
        const envelope = Envelope.decode(new Uint8Array(plaintext));
        helpers.normalizeUuids(
          envelope,
          ['sourceUuid'],
          'message_receiver::handleRequest::job'
        );
        // After this point, decoding errors are not the server's
        //   fault, and we should handle them gracefully and tell the
        //   user they received an invalid message

        if (await this.isBlocked(envelope.source)) {
          request.respond(200, 'OK');
          return;
        }

        if (await this.isUuidBlocked(envelope.sourceUuid)) {
          request.respond(200, 'OK');
          return;
        }

        // Make non-private envelope IDs dashless so they don't get redacted
        // from logs
        envelope.id = (envelope.serverGuid || getGuid()).replace(/-/g, '');

        envelope.serverTimestamp = envelope.serverTimestamp
          ? envelope.serverTimestamp.toNumber()
          : null;

        this.cacheAndQueue(envelope, plaintext, request);
      } catch (e) {
        request.respond(500, 'Bad encrypted websocket message');
        debug('Error handling incoming message:', e && e.stack ? e.stack : e);
        const ev = new Event('error');
        ev.error = e;
        await this.dispatchAndWait(ev);
      }
    };

    this.incomingQueue.add(job);
  }

  addToQueue(task) {
    this.count += 1;
    const promise = this.pendingQueue.add(task);

    const { count } = this;

    const update = () => {
      this.updateProgress(count);
    };

    promise.then(update, update);

    return promise;
  }

  onEmpty() {
    const emitEmpty = () => {
      debug("MessageReceiver: emitting 'empty' event");
      const ev = new Event('empty');
      this.dispatchAndWait(ev);
      this.isEmptied = true;

      this.maybeScheduleRetryTimeout();
    };

    const waitForPendingQueue = () => {
      debug(
        "MessageReceiver: finished processing messages after 'empty', now waiting for application"
      );

      // We don't await here because we don't want this to gate future message processing
      this.appQueue.add(emitEmpty);
    };

    const waitForIncomingQueue = () => {
      this.addToQueue(waitForPendingQueue);

      // Note: this.count is used in addToQueue
      // Resetting count so everything from the websocket after this starts at zero
      this.count = 0;
    };

    const waitForCacheAddBatcher = async () => {
      await this.cacheAddBatcher.onIdle();
      this.incomingQueue.add(waitForIncomingQueue);  
    };

    waitForCacheAddBatcher();
  }

  drain() {
    const waitForIncomingQueue = () =>
      this.addToQueue(() => {
        debug('drained');
      });

    return this.incomingQueue.add(waitForIncomingQueue);
  }

  updateProgress(count) {
    // count by 10s
    if (count % 10 !== 0) {
      return;
    }
    const ev = new Event('progress');
    ev.count = count;
    this.dispatchEvent(ev);
  }

  async queueAllCached() {
    const items = await this.getAllFromCache();
    for (let i = 0, max = items.length; i < max; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await this.queueCached(items[i]);
    }
  }

  async queueCached(item) {
    try {
      let envelopePlaintext = item.envelope;

      if (item.version === 2) {
        envelopePlaintext = MessageReceiver.stringToArrayBufferBase64(
          envelopePlaintext
        );
      }

      if (typeof envelopePlaintext === 'string') {
        envelopePlaintext = MessageReceiver.stringToArrayBuffer(
          envelopePlaintext
        );
      }
      const envelope = Envelope.decode(new Uint8Array(envelopePlaintext));
      envelope.id = envelope.serverGuid || item.id;
      envelope.source = envelope.source || item.source;
      envelope.sourceUuid = envelope.sourceUuid || item.sourceUuid;
      envelope.sourceDevice = envelope.sourceDevice || item.sourceDevice;
      envelope.serverTimestamp =        envelope.serverTimestamp || item.serverTimestamp;

      const { decrypted } = item;
      if (decrypted) {
        let payloadPlaintext = decrypted;

        if (item.version === 2) {
          payloadPlaintext = MessageReceiver.stringToArrayBufferBase64(
            payloadPlaintext
          );
        }

        if (typeof payloadPlaintext === 'string') {
          payloadPlaintext = MessageReceiver.stringToArrayBuffer(
            payloadPlaintext
          );
        }
        this.queueDecryptedEnvelope(envelope, payloadPlaintext);
      } else {
        this.queueEnvelope(envelope);
      }
    } catch (error) {
      debug(
        'queueCached error handling item',
        item.id,
        'removing it. Error:',
        error && error.stack ? error.stack : error
      );

      try {
        const { id } = item;
        await this.store.removeUnprocessed(id);
      } catch (deleteError) {
        debug(
          'queueCached error deleting item',
          item.id,
          'Error:',
          deleteError && deleteError.stack ? deleteError.stack : deleteError
        );
      }
    }
  }

  getEnvelopeId(envelope) {
    if (envelope.sourceUuid || envelope.source) {
      return `${envelope.sourceUuid || envelope.source}.${
        envelope.sourceDevice
      } ${envelope.timestamp.toNumber()} (${envelope.id})`;
    }

    return envelope.id;
  }

  clearRetryTimeout() {
    if (this.retryCachedTimeout) {
      clearInterval(this.retryCachedTimeout);
      this.retryCachedTimeout = null;
    }
  }

  maybeScheduleRetryTimeout() {
    if (this.isEmptied) {
      this.clearRetryTimeout();
      this.retryCachedTimeout = setTimeout(() => {
        this.pendingQueue.add(() => this.queueAllCached());
      }, RETRY_TIMEOUT);
    }
  }

  async getAllFromCache() {
    debug('getAllFromCache');
    const count = await this.store.getUnprocessedCount();

    if (count > 1500) {
      await this.store.removeAllUnprocessed();
      debug(
        `There were ${count} messages in cache. Deleted all instead of reprocessing`
      );
      return [];
    }

    const items = await this.store.getAllUnprocessed();
    debug('getAllFromCache loaded', items.length, 'saved envelopes');

    return Promise.all(
      _.map(items, async item => {
        const attempts = 1 + (item.attempts || 0);

        try {
          if (attempts >= 1) {
            debug('getAllFromCache final attempt for envelope', item.id);
            await this.store.removeUnprocessed(item.id);
          } else {
            await this.store.updateAttemptsUnprocessed(item.id, attempts);
          }
        } catch (error) {
          debug(
            'getAllFromCache error updating item after load:',
            error && error.stack ? error.stack : error
          );
        }

        return item;
      })
    );
  }

  async cacheAndQueueBatch(items) {
    const dataArray = items.map(item => item.data);
    try {
      await this.store.batchAddUnprocessed(dataArray);
      items.forEach(item => {
        item.request.respond(200, 'OK');
        this.queueEnvelope(item.envelope);
      });

      this.maybeScheduleRetryTimeout();
    } catch (error) {
      items.forEach(item => {
        item.request.respond(500, 'Failed to cache message');
      });
      debug(
        'cacheAndQueue error trying to add messages to cache:',
        error && error.stack ? error.stack : error
      );
    }
  }

  cacheAndQueue(envelope, plaintext, request) {
    const { id } = envelope;
    const decoded = MessageReceiver.arrayBufferToStringBase64(plaintext);
    const data = {
      id,
      version: 2,
      envelope: new Uint8Array(decoded),
      timestamp: Date.now(),
      attempts: 1,
    };
    this.cacheAddBatcher.add({
      request,
      envelope,
      data,
    });
  }

  async cacheUpdateBatch(items) {
    await this.store.updateUnprocessedsWithData(items);
  }

  async updateCache(envelope, plaintext) {
    const { id } = envelope;
    const data = {
      source: envelope.source,
      sourceUuid: envelope.sourceUuid,
      sourceDevice: envelope.sourceDevice,
      serverTimestamp: envelope.serverTimestamp,
      decrypted: MessageReceiver.arrayBufferToStringBase64(plaintext),
    };
    this.cacheUpdateBatcher.add({ id, data });
  }

  async cacheRemoveBatch(items) {
    const removed = items.map(item => this.store.removeUnprocessed(item.id));
    return Promise.all(removed);
  }

  removeFromCache(envelope) {
    const { id } = envelope;
    this.cacheRemoveBatcher.add(id);
  }

  queueDecryptedEnvelope(envelope, plaintext) {
    const id = this.getEnvelopeId(envelope);
    debug('queueing decrypted envelope', id);

    const task = this.handleDecryptedEnvelope.bind(this, envelope, plaintext);
    const taskWithTimeout = createTaskWithTimeout(
      task,
      `queueEncryptedEnvelope ${id}`
    );
    const promise = this.addToQueue(taskWithTimeout);

    return promise.catch(error => {
      debug(
        `queueDecryptedEnvelope error handling envelope ${id}:`,
        error && error.stack ? error.stack : error
      );
    });
  }

  queueEnvelope(envelope) {
    const id = this.getEnvelopeId(envelope);
    debug('queueing envelope', id);

    const task = this.handleEnvelope.bind(this, envelope);
    const taskWithTimeout = createTaskWithTimeout(task, `queueEnvelope ${id}`);
    const promise = this.addToQueue(taskWithTimeout);

    return promise.catch(error => {
      debug(
        `queueEnvelope error handling envelope ${id}:`,
        error && error.stack ? error.stack : error
      );
    });
  }

  // Same as handleEnvelope, just without the decryption step. Necessary for handling
  //   messages which were successfully decrypted, but application logic didn't finish
  //   processing.
  handleDecryptedEnvelope(envelope, plaintext) {
    if (this.stoppingProcessing) {
      return Promise.resolve();
    }
    // No decryption is required for delivery receipts, so the decrypted field of
    //   the Unprocessed model will never be set

    if (envelope.content) {
      return this.innerHandleContentMessage(envelope, plaintext);
    } if (envelope.legacyMessage) {
      return this.innerHandleLegacyMessage(envelope, plaintext);
    }
    this.removeFromCache(envelope);
    throw new Error('Received message with no content and no legacyMessage');
  }

  handleEnvelope(envelope) {
    if (this.stoppingProcessing) {
      return Promise.resolve();
    }

    if (envelope.type === Envelope.Type.RECEIPT) {
      return this.onDeliveryReceipt(envelope);
    }

    if (envelope.content) {
      return this.handleContentMessage(envelope);
    } if (envelope.legacyMessage) {
      return this.handleLegacyMessage(envelope);
    }
    this.removeFromCache(envelope);
    throw new Error('Received message with no content and no legacyMessage');
  }

  getStatus() {
    if (this.socket) {
      return this.socket.readyState;
    } if (this.hasConnected) {
      return WebSocket.CLOSED;
    }
    return -1;
  }

  onDeliveryReceipt(envelope) {
    return new Promise((resolve, reject) => {
      const ev = new Event('delivery');
      ev.confirm = this.removeFromCache.bind(this, envelope);
      ev.deliveryReceipt = {
        timestamp: envelope.timestamp.toNumber(),
        source: envelope.source,
        sourceUuid: envelope.sourceUuid,
        sourceDevice: envelope.sourceDevice,
      };
      this.dispatchAndWait(ev).then(resolve, reject);
    });
  }

  unpad(paddedData) {
    const paddedPlaintext = new Uint8Array(paddedData);
    let plaintext;

    for (let i = paddedPlaintext.length - 1; i >= 0; i -= 1) {
      if (paddedPlaintext[i] === 0x80) {
        plaintext = new Uint8Array(i);
        plaintext.set(paddedPlaintext.subarray(0, i));
        plaintext = plaintext.buffer;
        break;
      } else if (paddedPlaintext[i] !== 0x00) {
        throw new Error('Invalid padding');
      }
    }

    return plaintext;
  }

  async decrypt(envelope, ciphertext) {
    const { serverTrustRoot } = this;

    let promise;
    const address = new libsignal.SignalProtocolAddress(
      // Using source as opposed to sourceUuid allows us to get the existing
      // session if we haven't yet harvested the incoming uuid
      envelope.source || envelope.sourceUuid,
      envelope.sourceDevice
    );

    const ourNumber = await this.store.getNumber();
    const ourUuid = await this.store.getUuid();
    const options = {};

    // No limit on message keys if we're communicating with our other devices
    if (
      (envelope.source && ourNumber && ourNumber === envelope.source)
      || (envelope.sourceUuid && ourUuid && ourUuid === envelope.sourceUuid)
    ) {
      options.messageKeysLimit = false;
    }

    const sessionCipher = new libsignal.SessionCipher(
      this.store,
      address,
      options
    );
    const secretSessionCipher = new Metadata.SecretSessionCipher(this.store);
    const deviceId = await this.store.getDeviceId();
    const me = {
      number: ourNumber,
      uuid: ourUuid,
      deviceId: parseInt(deviceId, 10),
    };

    switch (envelope.type) {
      case Envelope.Type.CIPHERTEXT:
        debug('message from', this.getEnvelopeId(envelope));
        promise = sessionCipher
          .decryptWhisperMessage(ciphertext)
          .then(this.unpad);
        break;
      case Envelope.Type.PREKEY_BUNDLE:
        debug('prekey message from', this.getEnvelopeId(envelope));
        promise = this.decryptPreKeyWhisperMessage(
          ciphertext,
          sessionCipher,
          address
        );
        break;
      case Envelope.Type.UNIDENTIFIED_SENDER:
        debug('received unidentified sender message');
        promise = secretSessionCipher
          .decrypt(
            Metadata.createCertificateValidator(serverTrustRoot),
            ciphertext.toArrayBuffer(),
            Math.min(envelope.serverTimestamp || Date.now(), Date.now()),
            me
          )
          .then(
            async result => {
              const { isMe, sender, senderUuid, content } = result;

              // We need to drop incoming messages from ourself since server can't
              //   do it for us
              if (isMe) {
                return { isMe: true };
              }

              if (
                (sender && this.isBlocked(sender.getName()))
                || (senderUuid && this.isUuidBlocked(senderUuid.getName()))
              ) {
                debug(
                  'Dropping blocked message after sealed sender decryption'
                );
                return { isBlocked: true };
              }

              // Here we take this sender information and attach it back to the envelope
              //   to make the rest of the app work properly.

              const originalSource = envelope.source;
              const originalSourceUuid = envelope.sourceUuid;

              // eslint-disable-next-line no-param-reassign
              envelope.source = sender && sender.getName();
              // eslint-disable-next-line no-param-reassign
              envelope.sourceUuid = senderUuid && senderUuid.getName();
              helpers.normalizeUuids(
                envelope,
                ['sourceUuid'],
                'message_receiver::decrypt::UNIDENTIFIED_SENDER'
              );

              // eslint-disable-next-line no-param-reassign
              envelope.sourceDevice = (sender && sender.getDeviceId())
                || (senderUuid && senderUuid.getDeviceId());

              // eslint-disable-next-line no-param-reassign
              envelope.unidentifiedDeliveryReceived = !(
                originalSource || originalSourceUuid
              );

              // Return just the content because that matches the signature of the other
              //   decrypt methods used above.
              return this.unpad(content);
            },
            // eslint-disable-next-line consistent-return 
            error => {
              const { sender, senderUuid } = error || {};

              if (sender || senderUuid) {
                const originalSource = envelope.source;
                const originalSourceUuid = envelope.sourceUuid;

                if (
                  (sender && this.isBlocked(sender.getName()))
                  || (senderUuid && this.isUuidBlocked(senderUuid.getName()))
                ) {
                  debug(
                    'Dropping blocked message with error after sealed sender decryption'
                  );
                  return { isBlocked: true };
                }

                // eslint-disable-next-line no-param-reassign
                envelope.source = sender && sender.getName();
                // eslint-disable-next-line no-param-reassign
                envelope.sourceUuid =                  senderUuid && senderUuid.getName().toLowerCase();
                helpers.normalizeUuids(
                  envelope,
                  ['sourceUuid'],
                  'message_receiver::decrypt::UNIDENTIFIED_SENDER::error'
                );
                // eslint-disable-next-line no-param-reassign
                envelope.sourceDevice =                  (sender && sender.getDeviceId())
                  || (senderUuid && senderUuid.getDeviceId());

                // eslint-disable-next-line no-param-reassign
                envelope.unidentifiedDeliveryReceived = !(
                  originalSource || originalSourceUuid
                );

                throw error;
              }

              this.removeFromCache(envelope).then(() => {
                throw error;
              });
            }
          );
        break;
      default:
        promise = Promise.reject(new Error('Unknown message type'));
    }

    return promise
      .then(plaintext => {
        const { isMe, isBlocked } = plaintext || {};
        if (isMe || isBlocked) {
          this.removeFromCache(envelope);
          return null;
        }

        // Note: this is an out of band update; there are cases where the item in the
        //   cache has already been deleted by the time this runs. That's okay.
        this.updateCache(envelope, plaintext);

        return plaintext;
      })
      .catch(error => {
        let errorToThrow = error;

        if (error && error.message === 'Unknown identity key') {
          // create an error that the UI will pick up and ask the
          // user if they want to re-negotiate
          const buffer = ByteBuffer.wrap(ciphertext);
          errorToThrow = new errors.IncomingIdentityKeyError(
            address.toString(),
            buffer.toArrayBuffer(),
            error.identityKey
          );
        }
        const ev = new Event('error');
        ev.error = errorToThrow;
        ev.proto = envelope;
        ev.confirm = this.removeFromCache.bind(this, envelope);

        const returnError = () => Promise.reject(errorToThrow);
        return this.dispatchAndWait(ev).then(returnError, returnError);
      });
  }

  async decryptPreKeyWhisperMessage(ciphertext, sessionCipher, address) {
    const padded = await sessionCipher.decryptPreKeyWhisperMessage(ciphertext);

    try {
      return this.unpad(padded);
    } catch (e) {
      if (e.message === 'Unknown identity key') {
        // create an error that the UI will pick up and ask the
        // user if they want to re-negotiate
        const buffer = ByteBuffer.wrap(ciphertext);
        throw new errors.IncomingIdentityKeyError(
          address.toString(),
          buffer.toArrayBuffer(),
          e.identityKey
        );
      }
      throw e;
    }
  }

  handleSentMessage(envelope, sentContainer) {
    const {
      destination,
      timestamp,
      message: msg,
      expirationStartTimestamp,
      unidentifiedStatus,
      isRecipientUpdate,
    } = sentContainer;

    let p = Promise.resolve();
    // eslint-disable-next-line no-bitwise
    if (msg.flags & DataMessage.Flags.END_SESSION) {
      p = this.handleEndSession(destination);
    }
    return p.then(() =>
      this.processDecrypted(envelope, msg, this.number).then(async message => {
        const groupId = message.group && message.group.id;
        const isBlocked = await this.isGroupBlocked(groupId);
        const { source, sourceUuid } = envelope;
        const ourE164 = this.store.getNumber();
        const ourUuid = this.store.getUuid();
        const isMe =          (source && ourE164 && source === ourE164)
          || (sourceUuid && ourUuid && sourceUuid === ourUuid);
        const isLeavingGroup = Boolean(
          message.group && message.group.type === GroupContext.Type.QUIT
        );

        if (groupId && isBlocked && !(isMe && isLeavingGroup)) {
          debug(
            `Message ${this.getEnvelopeId(
              envelope
            )} ignored; destined for blocked group`
          );
          return this.removeFromCache(envelope);
        }

        const ev = new Event('sent');
        ev.confirm = this.removeFromCache.bind(this, envelope);
        ev.data = {
          destination,
          timestamp: timestamp.toNumber(),
          device: envelope.sourceDevice,
          unidentifiedStatus,
          message,
          isRecipientUpdate,
        };
        if (expirationStartTimestamp) {
          ev.data.expirationStartTimestamp = expirationStartTimestamp.toNumber();
        }
        return this.dispatchAndWait(ev);
      })
    );
  }

  handleDataMessage(envelope, msg) {
    debug('data message from', this.getEnvelopeId(envelope));
    let p = Promise.resolve();
    // eslint-disable-next-line no-bitwise
    if (msg.flags & DataMessage.Flags.END_SESSION) {
      p = this.handleEndSession(envelope.source || envelope.sourceUuid);
    }
    return p.then(() =>
      this.processDecrypted(envelope, msg, envelope.source).then(
        async message => {
          const groupId = message.group && message.group.id;
          const isBlocked = await this.isGroupBlocked(groupId);
          const { source, sourceUuid } = envelope;
          const ourE164 = this.store.getNumber();
          const ourUuid = this.store.getUuid();
          const isMe =            (source && ourE164 && source === ourE164)
            || (sourceUuid && ourUuid && sourceUuid === ourUuid);
          const isLeavingGroup = Boolean(
            message.group && message.group.type === GroupContext.Type.QUIT
          );

          if (groupId && isBlocked && !(isMe && isLeavingGroup)) {
            debug(
              `Message ${this.getEnvelopeId(
                envelope
              )} ignored; destined for blocked group`
            );
            return this.removeFromCache(envelope);
          }

          const ev = new Event('message');
          ev.confirm = this.removeFromCache.bind(this, envelope);
          ev.data = {
            source: envelope.source,
            sourceUuid: envelope.sourceUuid,
            sourceDevice: envelope.sourceDevice,
            timestamp: envelope.timestamp.toNumber(),
            receivedAt: envelope.receivedAt,
            unidentifiedDeliveryReceived: envelope.unidentifiedDeliveryReceived,
            message,
          };
          return this.dispatchAndWait(ev);
        }
      )
    );
  }

  handleLegacyMessage(envelope) {
    return this.decrypt(envelope, envelope.legacyMessage).then(plaintext => {
      if (!plaintext) {
        debug('handleLegacyMessage: plaintext was falsey');
        return null;
      }
      return this.innerHandleLegacyMessage(envelope, plaintext);
    });
  }

  innerHandleLegacyMessage(envelope, plaintext) {
    const message = DataMessage.decode(new Uint8Array(plaintext));
    return this.handleDataMessage(envelope, message);
  }

  handleContentMessage(envelope) {
    return this.decrypt(envelope, envelope.content).then(plaintext => {
      if (!plaintext) {
        debug('handleContentMessage: plaintext was falsey');
        return null;
      }
      return this.innerHandleContentMessage(envelope, plaintext);
    });
  }

  innerHandleContentMessage(envelope, plaintext) {
    const content = Content.decode(new Uint8Array(plaintext));
    if (content.syncMessage) {
      return this.handleSyncMessage(envelope, content.syncMessage);
    } if (content.dataMessage) {
      return this.handleDataMessage(envelope, content.dataMessage);
    } if (content.nullMessage) {
      return this.handleNullMessage(envelope, content.nullMessage);
    } if (content.callMessage) {
      return this.handleCallMessage(envelope, content.callMessage);
    } if (content.receiptMessage) {
      return this.handleReceiptMessage(envelope, content.receiptMessage);
    } if (content.typingMessage) {
      return this.handleTypingMessage(envelope, content.typingMessage);
    }
    this.removeFromCache(envelope);
    throw new Error('Unsupported content message');
  }

  handleCallMessage(envelope) {
    debug('call message from', this.getEnvelopeId(envelope));
    this.removeFromCache(envelope);
  }

  handleReceiptMessage(envelope, receiptMessage) {
    debug('receipt message from', this.getEnvelopeId(envelope));
    const results = [];
    if (receiptMessage.type === ReceiptMessage.Type.DELIVERY) {
      for (let i = 0; i < receiptMessage.timestamp.length; i += 1) {
        const ev = new Event('delivery');
        ev.confirm = this.removeFromCache.bind(this, envelope);
        ev.deliveryReceipt = {
          timestamp: receiptMessage.timestamp[i].toNumber(),
          source: envelope.source,
          sourceUuid: envelope.sourceUuid,
          sourceDevice: envelope.sourceDevice,
        };
        results.push(this.dispatchAndWait(ev));
      }
    } else if (receiptMessage.type === ReceiptMessage.Type.READ) {
      for (let i = 0; i < receiptMessage.timestamp.length; i += 1) {
        const ev = new Event('read');
        ev.confirm = this.removeFromCache.bind(this, envelope);
        ev.timestamp = envelope.timestamp.toNumber();
        ev.read = {
          timestamp: receiptMessage.timestamp[i].toNumber(),
          reader: envelope.source || envelope.sourceUuid,
        };
        results.push(this.dispatchAndWait(ev));
      }
    }
    return Promise.all(results);
  }

  handleTypingMessage(envelope, typingMessage) {
    debug('typing message from', this.getEnvelopeId(envelope));
    const ev = new Event('typing');

    this.removeFromCache(envelope);

    if (envelope.timestamp && typingMessage.timestamp) {
      const envelopeTimestamp = envelope.timestamp.toNumber();
      const typingTimestamp = typingMessage.timestamp.toNumber();

      if (typingTimestamp !== envelopeTimestamp) {
        debug(
          `Typing message envelope timestamp (${envelopeTimestamp}) did not match typing timestamp (${typingTimestamp})`
        );
        return null;
      }
    }

    ev.sender = envelope.source;
    ev.senderUuid = envelope.sourceUuid;
    ev.senderDevice = envelope.sourceDevice;
    ev.typing = {
      typingMessage,
      timestamp: typingMessage.timestamp
        ? typingMessage.timestamp.toNumber()
        : Date.now(),
      groupId: typingMessage.groupId
        ? typingMessage.groupId.toString('binary')
        : null,
      started: typingMessage.action === TypingMessage.Action.STARTED,
      stopped: typingMessage.action === TypingMessage.Action.STOPPED,
    };

    return this.dispatchEvent(ev);
  }

  handleNullMessage(envelope) {
    debug('null message from', this.getEnvelopeId(envelope));
    this.removeFromCache(envelope);
  }

  handleSyncMessage(envelope, syncMessage) {
    debug('sync message from', this.getEnvelopeId(envelope));
    const unidentified = syncMessage.sent
      ? syncMessage.sent.unidentifiedStatus || []
      : [];
    helpers.normalizeUuids(
      syncMessage,
      [
        'sent.destinationUuid',
        ...unidentified.map(
          (_el, i) => `sent.unidentifiedStatus.${i}.destinationUuid`
        ),
      ],
      'message_receiver::handleSyncMessage'
    );
    const fromSelfSource =      envelope.source && envelope.source === this.number_id;
    const fromSelfSourceUuid =      envelope.sourceUuid && envelope.sourceUuid === this.uuid_id;
    if (!fromSelfSource && !fromSelfSourceUuid) {
      throw new Error('Received sync message from another number');
    }
    // eslint-disable-next-line eqeqeq
    if (envelope.sourceDevice == this.deviceId) {
      throw new Error('Received sync message from our own device');
    }
    if (syncMessage.sent) {
      const sentMessage = syncMessage.sent;
      const to = sentMessage.message.group
        ? `group(${sentMessage.message.group.id.toBinary()})`
        : sentMessage.destination;

      debug(
        'sent message to',
        to,
        sentMessage.timestamp.toNumber(),
        'from',
        this.getEnvelopeId(envelope)
      );
      return this.handleSentMessage(envelope, sentMessage);
    } if (syncMessage.contacts) {
      return this.handleContacts(envelope, syncMessage.contacts);
    } if (syncMessage.groups) {
      return this.handleGroups(envelope, syncMessage.groups);
    } if (syncMessage.blocked) {
      return this.handleBlocked(envelope, syncMessage.blocked);
    } if (syncMessage.request) {
      debug('Got SyncMessage Request');
      return this.removeFromCache(envelope);
    } if (syncMessage.read && syncMessage.read.length) {
      debug('read messages from', this.getEnvelopeId(envelope));
      return this.handleRead(envelope, syncMessage.read);
    } if (syncMessage.verified) {
      return this.handleVerified(envelope, syncMessage.verified);
    } if (syncMessage.configuration) {
      return this.handleConfiguration(envelope, syncMessage.configuration);
    } if (
      syncMessage.stickerPackOperation
      && syncMessage.stickerPackOperation.length > 0
    ) {
      return this.handleStickerPackOperation(
        envelope,
        syncMessage.stickerPackOperation
      );
    } if (syncMessage.viewOnceOpen) {
      return this.handleViewOnceOpen(envelope, syncMessage.viewOnceOpen);
    }

    this.removeFromCache(envelope);
    throw new Error('Got empty SyncMessage');
  }

  handleConfiguration(envelope, configuration) {
    debug('got configuration sync message');
    const ev = new Event('configuration');
    ev.confirm = this.removeFromCache.bind(this, envelope);
    ev.configuration = configuration;
    return this.dispatchAndWait(ev);
  }

  handleViewOnceOpen(envelope, sync) {
    debug('got view once open sync message');

    const ev = new Event('viewSync');
    ev.confirm = this.removeFromCache.bind(this, envelope);
    ev.source = sync.sender;
    ev.sourceUuid = sync.senderUuid;
    ev.timestamp = sync.timestamp ? sync.timestamp.toNumber() : null;

    helpers.normalizeUuids(
      ev,
      ['sourceUuid'],
      'message_receiver::handleViewOnceOpen'
    );

    return this.dispatchAndWait(ev);
  }

  handleStickerPackOperation(envelope, operations) {
    const ENUM = SyncMessage.StickerPackOperation.Type;
    debug('got sticker pack operation sync message');
    const ev = new Event('sticker-pack');
    ev.confirm = this.removeFromCache.bind(this, envelope);
    ev.stickerPacks = operations.map(operation => ({
      id: operation.packId ? operation.packId.toString('hex') : null,
      key: operation.packKey ? operation.packKey.toString('base64') : null,
      isInstall: operation.type === ENUM.INSTALL,
      isRemove: operation.type === ENUM.REMOVE,
    }));
    return this.dispatchAndWait(ev);
  }

  handleVerified(envelope, verified) {
    const ev = new Event('verified');
    ev.confirm = this.removeFromCache.bind(this, envelope);
    ev.verified = {
      state: verified.state,
      destination: verified.destination,
      destinationUuid: verified.destinationUuid,
      identityKey: verified.identityKey.toArrayBuffer(),
    };
    helpers.normalizeUuids(
      ev,
      ['verified.destinationUuid'],
      'message_receiver::handleVerified'
    );

    return this.dispatchAndWait(ev);
  }

  handleRead(envelope, read) {
    const results = [];
    for (let i = 0; i < read.length; i += 1) {
      const ev = new Event('readSync');
      ev.confirm = this.removeFromCache.bind(this, envelope);
      ev.timestamp = envelope.timestamp.toNumber();
      ev.read = {
        timestamp: read[i].timestamp.toNumber(),
        sender: read[i].sender,
        senderUuid: read[i].senderUuid,
      };
      helpers.normalizeUuids(
        ev,
        ['read.senderUuid'],
        'message_receiver::handleRead'
      );
      results.push(this.dispatchAndWait(ev));
    }
    return Promise.all(results);
  }

  handleContacts(envelope, contacts) {
    debug('contact sync');
    const { blob } = contacts;

    this.removeFromCache(envelope);

    // Note: we do not return here because we don't want to block the next message on
    //   this attachment download and a lot of processing of that attachment.
    this.handleAttachment(blob).then(attachmentPointer => {
      const results = [];
      const contactBuffer = new ContactBuffer(attachmentPointer.data);
      let contactDetails = contactBuffer.next();
      while (contactDetails !== undefined) {
        const ev = new Event('contact');
        ev.contactDetails = contactDetails;
        results.push(this.dispatchAndWait(ev));

        contactDetails = contactBuffer.next();
      }

      const ev = new Event('contactsync');
      results.push(this.dispatchAndWait(ev));

      return Promise.all(results).then(() => {
        debug('handleContacts: finished');
      });
    });
  }

  handleGroups(envelope, groups) {
    debug('group sync');
    const { blob } = groups;

    this.removeFromCache(envelope);

    // Note: we do not return here because we don't want to block the next message on
    //   this attachment download and a lot of processing of that attachment.
    this.handleAttachment(blob).then(attachmentPointer => {
      const groupBuffer = new GroupBuffer(attachmentPointer.data);
      let groupDetails = groupBuffer.next();
      const promises = [];
      while (groupDetails !== undefined) {
        groupDetails.id = groupDetails.id.toBinary();
          const ev = new Event('group');
          ev.groupDetails = groupDetails;
          const promise = this.dispatchAndWait(ev).catch(e => {
            debug('error processing group', e);
          });
          groupDetails = groupBuffer.next();
          promises.push(promise);
      }

      Promise.all(promises).then(() => {
        const ev = new Event('groupsync');
        return this.dispatchAndWait(ev);
      });
    });
  }

  async handleBlocked(envelope, blocked) {
    debug('Setting these numbers as blocked:', blocked.numbers);
    await this.store.setBlocked(blocked.numbers);
    if (blocked.uuids) {
      helpers.normalizeUuids(
        blocked,
        blocked.uuids.map((_uuid, i) => `uuids.${i}`),
        'message_receiver::handleBlocked'
      );
      debug('Setting these uuids as blocked:', blocked.uuids);
      this.store.setBlockedUuids(blocked.uuids);
    }

    const groupIds = _.map(blocked.groupIds, groupId => groupId.toBinary());
    debug(
      'Setting these groups as blocked:',
      groupIds.map(groupId => `group(${groupId})`)
    );
    await this.store.setBlockedGroups(groupIds);

    return this.removeFromCache(envelope);
  }

  async isBlocked(number) {
    const blocklist = await this.store.getBlocked();
    return blocklist.includes(number);
  }

  async isUuidBlocked(uuid) {
    const blocklist = await this.store.getBlockedUuids();
    return blocklist.includes(uuid);
  }

  async isGroupBlocked(groupId) {
    const blocklist = await this.store.getBlockedGroups();
    return blocklist.includes(groupId);
  }

  cleanAttachment(attachment) {
    return {
      ..._.omit(attachment, 'thumbnail'),
      cdnId: attachment.cdnId ? attachment.cdnId.toString() : undefined,
      key: attachment.key
        ? ByteBuffer.wrap(attachment.key, 'base64').toString('base64')
        : null,
      digest: attachment.digest
        ? ByteBuffer.wrap(attachment.digest, 'base64').toString('base64')
        : null,
    };
  }

  async downloadAttachment(attachment) {
    const cdnId = attachment.cdnId && attachment.cdnId !== '0' ? attachment.cdnId : attachment.cdnKey;
    const encrypted = await this.server.getAttachment(
      cdnId,
      attachment.cdnNumber || '0'
    );
    const { key, digest, size } = attachment;

    if (!digest) {
      throw new Error('Failure: Ask sender to update Signal and resend.');
    }

    const data = await crypto.decryptAttachment(
      encrypted,
      crypto.base64ToArrayBuffer(key),
      crypto.base64ToArrayBuffer(digest)
    );

    if (!_.isNumber(size)) {
      throw new Error(
        `downloadAttachment: Size was not provided, actual size was ${data.byteLength}`
      );
    }

    const typedArray = crypto.getFirstBytes(data, size);

    return {
      ..._.omit(attachment, 'digest', 'key'),
      data: crypto.typedArrayToArrayBuffer(typedArray),
    };
  }

  handleAttachment(attachment) {
    const cleaned = this.cleanAttachment(attachment);
    return this.downloadAttachment(cleaned);
  }

  async handleEndSession(identifier) {
    debug('got end session');
    const deviceIds = await this.store.getDeviceIds(identifier);

    return Promise.all(
      deviceIds.map(deviceId => {
        const address = new libsignal.SignalProtocolAddress(
          identifier,
          deviceId
        );
        const sessionCipher = new libsignal.SessionCipher(this.store, address);

        debug('deleting sessions for', address.toString());
        return sessionCipher.deleteAllSessionsForDevice();
      })
    );
  }

  async processDecrypted(envelope, decrypted, source) {
    /* eslint-disable no-bitwise, no-param-reassign */
    const FLAGS = DataMessage.Flags;

    // Now that its decrypted, validate the message and clean it up for consumer
    //   processing
    // Note that messages may (generally) only perform one action and we ignore remaining
    //   fields after the first action.

    if (!envelope.timestamp || !decrypted.timestamp) {
      throw new Error('Missing timestamp on dataMessage or envelope');
    }

    const envelopeTimestamp = envelope.timestamp.toNumber();
    const decryptedTimestamp = decrypted.timestamp.toNumber();

    if (envelopeTimestamp !== decryptedTimestamp) {
      throw new Error(
        `Timestamp ${decrypted.timestamp} in DataMessage did not match envelope timestamp ${envelope.timestamp}`
      );
    }

    if (decrypted.flags == null) {
      decrypted.flags = 0;
    }
    if (decrypted.expireTimer == null) {
      decrypted.expireTimer = 0;
    }

    if (decrypted.flags & FLAGS.END_SESSION) {
      decrypted.body = null;
      decrypted.attachments = [];
      decrypted.group = null;
      return Promise.resolve(decrypted);
    } if (decrypted.flags & FLAGS.EXPIRATION_TIMER_UPDATE) {
      decrypted.body = null;
      decrypted.attachments = [];
    } else if (decrypted.flags & FLAGS.PROFILE_KEY_UPDATE) {
      decrypted.body = null;
      decrypted.attachments = [];
    } else if (decrypted.flags !== 0) {
      throw new Error('Unknown flags in message');
    }

    if (decrypted.group !== null) {
      decrypted.group.id = ByteBuffer.wrap(decrypted.group.id).toBinary();

      let existingGroup = [];
      if (this.store.hasGroups()) {
        existingGroup = await this.store.getGroupNumbers(decrypted.group.id);
        if (existingGroup === undefined) {
          if (decrypted.group.type !== GroupContext.Type.UPDATE) {
            decrypted.group.members = [source];
            debug('Got message for unknown group');
          }
          this.store.createNewGroup(
            decrypted.group.id,
            decrypted.group.members
          );
        } else {
          const fromIndex = existingGroup.indexOf(source);

          if (fromIndex < 0) {
            // TODO: This could be indication of a race...
            debug(
              'Sender was not a member of the group they were sending from'
            );
          }
        }
      }
      if (existingGroup !== undefined) {
        switch (decrypted.group.type) {
          case GroupContext.Type.UPDATE:
            decrypted.body = null;
            decrypted.attachments = [];
            if (this.store.hasGroups()) {
              this.store.updateGroupNumbers(
                decrypted.group.id,
                decrypted.group.members
              );
            }
            break;
          case GroupContext.Type.QUIT:
            decrypted.body = null;
            decrypted.attachments = [];
            if (this.store.hasGroups() && source === this.number) {
              this.store.deleteGroup(decrypted.group.id);
            } else {
              this.store.removeGroupNumber(decrypted.group.id, source);
            }
            break;
          case GroupContext.Type.DELIVER:
            decrypted.group.name = null;
            decrypted.group.membersE164 = [];
            decrypted.group.members = [];
            decrypted.group.avatar = null;
            break;
          default: {
            this.removeFromCache(envelope);
            const err = new Error('Unknown group message type');
            err.warn = true;
            throw err;
          }
        }
      }
    }

    const attachmentCount = decrypted.attachments.length;
    const ATTACHMENT_MAX = 32;
    if (attachmentCount > ATTACHMENT_MAX) {
      throw new Error(
        `Too many attachments: ${attachmentCount} included in one message, max is ${ATTACHMENT_MAX}`
      );
    }

    // Here we go from binary to string/base64 in all AttachmentPointer digest/key fields

    if (decrypted.group && decrypted.group.type === GroupContext.Type.UPDATE) {
      if (decrypted.group.avatar !== null) {
        decrypted.group.avatar = this.cleanAttachment(decrypted.group.avatar);
      }
    }

    decrypted.attachments = (decrypted.attachments || []).map(
      this.cleanAttachment.bind(this)
    );
    decrypted.preview = (decrypted.preview || []).map(item => {
      const { image } = item;

      if (!image) {
        return item;
      }

      return {
        ...item,
        image: this.cleanAttachment(image),
      };
    });
    decrypted.contact = (decrypted.contact || []).map(item => {
      const { avatar } = item;

      if (!avatar || !avatar.avatar) {
        return item;
      }

      return {
        ...item,
        avatar: {
          ...item.avatar,
          avatar: this.cleanAttachment(item.avatar.avatar),
        },
      };
    });

    if (decrypted.quote && decrypted.quote.id) {
      decrypted.quote.id = decrypted.quote.id.toNumber();
    }

    if (decrypted.quote) {
      decrypted.quote.attachments = (decrypted.quote.attachments || []).map(
        item => {
          const { thumbnail } = item;

          if (!thumbnail) {
            return item;
          }

          return {
            ...item,
            thumbnail: this.cleanAttachment(item.thumbnail),
          };
        }
      );
    }

    const { sticker } = decrypted;
    if (sticker) {
      if (sticker.packId) {
        sticker.packId = sticker.packId.toString('hex');
      }
      if (sticker.packKey) {
        sticker.packKey = sticker.packKey.toString('base64');
      }
      if (sticker.data) {
        sticker.data = this.cleanAttachment(sticker.data);
      }
    }

    const groupMembers = decrypted.group ? decrypted.group.members || [] : [];

    helpers.normalizeUuids(
      decrypted,
      [
        'quote.authorUuid',
        'reaction.targetAuthorUuid',
        ...groupMembers.map((_member, i) => `group.members.${i}.uuid`),
      ],
      'message_receiver::processDecrypted'
    );

    return Promise.resolve(decrypted);
    /* eslint-enable no-bitwise, no-param-reassign */
  }

  static stringToArrayBuffer(string) {
    Promise.resolve(ByteBuffer.wrap(string, 'binary').toArrayBuffer());
  }

  static arrayBufferToString(arrayBuffer) {
    Promise.resolve(ByteBuffer.wrap(arrayBuffer).toString('binary'));
  }

  static stringToArrayBufferBase64(string) {
    // TODO: port to worker_threads since can't pass arrayBuffers to nodejs processes
    // callWorker("stringToArrayBufferBase64", string);
    return ByteBuffer.wrap(string, 'base64').toArrayBuffer();
  }

  static arrayBufferToStringBase64(arrayBuffer) {
    // TODO: port to worker_threads since can't pass arrayBuffers to nodejs processes
    // callWorker("arrayBufferToStringBase64", arrayBuffer);
    return ByteBuffer.wrap(new Uint8Array(arrayBuffer)).toString('base64');
  }
}

exports = module.exports = (WebAPI, serverTrustRoot) => {
  MessageReceiver.WebAPI = WebAPI;
  MessageReceiver.serverTrustRoot = crypto.base64ToArrayBuffer(serverTrustRoot);
  return MessageReceiver;
};
