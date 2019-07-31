/*
 * vim: ts=2:sw=2:expandtab
 */

"use strict";

const debug = require("debug")("libsignal-service:SendMessage");
const libsignal = require("@throneless/libsignal-protocol");
const crypto = require("./crypto.js");
const errors = require("./errors.js");
const helpers = require("./helpers.js");
const OutgoingMessage = require("./OutgoingMessage.js");
const createTaskWithTimeout = require("./taskWithTimeout.js");
const Message = require("./Message.js");
const protobuf = require("./protobufs.js");
const AttachmentPointer = protobuf.lookupType(
  "signalservice.AttachmentPointer"
);
const Content = protobuf.lookupType("signalservice.Content");
const DataMessage = protobuf.lookupType("signalservice.DataMessage");
const GroupContext = protobuf.lookupType("signalservice.GroupContext");
const NullMessage = protobuf.lookupType("signalservice.NullMessage");
const ReceiptMessage = protobuf.lookupType("signalservice.ReceiptMessage");
const SyncMessage = protobuf.lookupType("signalservice.SyncMessage");
const SyncMessageRead = protobuf.lookupType("signalservice.SyncMessage.Read");
const SyncMessageRequest = protobuf.lookupType(
  "signalservice.SyncMessage.Request"
);
const SyncMessageSent = protobuf.lookupType("signalservice.SyncMessage.Sent");
const SyncMessageStickerPackOperation = protobuf.lookupType(
  "signalservice.SyncMessage.StickerPackOperation"
);
const TypingMessage = protobuf.lookupType("signalservice.TypingMessage");
const Verified = protobuf.lookupType("signalservice.Verified");
/* eslint-disable more/no-then, no-bitwise */

const PAD_ALL_ATTACHMENTS = false;

function stringToArrayBuffer(str) {
  if (typeof str !== "string") {
    throw new Error("Passed non-string to stringToArrayBuffer");
  }
  const res = new ArrayBuffer(str.length);
  const uint = new Uint8Array(res);
  for (let i = 0; i < str.length; i += 1) {
    uint[i] = str.charCodeAt(i);
  }
  return res;
}

class MessageSender {
  constructor(store) {
    this.pendingMessages = {};
    this.store = store;
  }

  async connect() {
    if (this.server === undefined) {
      const username = await this.store.getNumber();
      const password = await this.store.getPassword();
      this.server = this.constructor.WebAPI.connect({ username, password });
    }
  }

  _getAttachmentSizeBucket(size) {
    return Math.max(
      541,
      Math.floor(1.05 ** Math.ceil(Math.log(size) / Math.log(1.05)))
    );
  }

  getPaddedAttachment(data, shouldPad) {
    if (!PAD_ALL_ATTACHMENTS && !shouldPad) {
      return data;
    }

    const size = data.byteLength;
    const paddedSize = this._getAttachmentSizeBucket(size);
    const padding = crypto.getZeroes(paddedSize - size);

    return crypto.concatenateBytes(data, padding);
  }

  async makeAttachmentPointer(attachment, shouldPad = false) {
    if (typeof attachment !== "object" || attachment == null) {
      return Promise.resolve(undefined);
    }

    const { data, size } = attachment;
    if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
      throw new Error(
        `makeAttachmentPointer: data was a '${typeof data}' instead of ArrayBuffer/ArrayBufferView`
      );
    }
    if (data.byteLength !== size) {
      throw new Error(
        `makeAttachmentPointer: Size ${size} did not match data.byteLength ${data.byteLength}`
      );
    }

    const padded = this.getPaddedAttachment(data, shouldPad);
    const key = crypto.getRandomBytes(64);
    const iv = crypto.getRandomBytes(16);

    const result = await crypto.encryptAttachment(padded, key, iv);
    const id = await this.server.putAttachment(result.ciphertext);

    const proto = AttachmentPointer.create();
    proto.id = id;
    proto.contentType = attachment.contentType;
    proto.key = new Uint8Array(key);
    proto.size = attachment.size;
    proto.digest = new Uint8Array(result.digest);

    if (attachment.fileName) {
      proto.fileName = attachment.fileName;
    }
    if (attachment.flags) {
      proto.flags = attachment.flags;
    }
    if (attachment.width) {
      proto.width = attachment.width;
    }
    if (attachment.height) {
      proto.height = attachment.height;
    }
    if (attachment.caption) {
      proto.caption = attachment.caption;
    }

    return proto;
  }

  retransmitMessage(number, jsonData, timestamp) {
    const outgoing = new OutgoingMessage(this.server);
    return outgoing.transmitMessage(number, jsonData, timestamp);
  }

  validateRetryContentMessage(content) {
    // We want at least one field set, but not more than one
    let count = 0;
    count += content.syncMessage ? 1 : 0;
    count += content.dataMessage ? 1 : 0;
    count += content.callMessage ? 1 : 0;
    count += content.nullMessage ? 1 : 0;
    if (count !== 1) {
      return false;
    }

    // It's most likely that dataMessage will be populated, so we look at it in detail
    const data = content.dataMessage;
    if (
      data &&
      !data.attachments.length &&
      !data.body &&
      !data.expireTimer &&
      !data.flags &&
      !data.group
    ) {
      return false;
    }

    return true;
  }

  getRetryProto(message, timestamp) {
    // If message was sent before v0.41.3 was released on Aug 7, then it was most
    //   certainly a DataMessage
    //
    // var d = new Date('2017-08-07T07:00:00.000Z');
    // d.getTime();
    const august7 = 1502089200000;
    if (timestamp < august7) {
      return DataMessage.decode(message);
    }

    // This is ugly. But we don't know what kind of proto we need to decode...
    try {
      // Simply decoding as a Content message may throw
      const proto = Content.decode(message);

      // But it might also result in an invalid object, so we try to detect that
      if (this.validateRetryContentMessage(proto)) {
        return proto;
      }

      return DataMessage.decode(message);
    } catch (e) {
      // If this call throws, something has really gone wrong, we'll fail to send
      return DataMessage.decode(message);
    }
  }

  tryMessageAgain(number, encodedMessage, timestamp) {
    const proto = this.getRetryProto(encodedMessage, timestamp);
    return this.sendIndividualProto(number, proto, timestamp);
  }

  queueJobForNumber(number, runJob) {
    const taskWithTimeout = createTaskWithTimeout(
      runJob,
      `queueJobForNumber ${number}`
    );

    const runPrevious = this.pendingMessages[number] || Promise.resolve();
    this.pendingMessages[number] = runPrevious.then(
      taskWithTimeout,
      taskWithTimeout
    );

    const runCurrent = this.pendingMessages[number];
    runCurrent.then(() => {
      if (this.pendingMessages[number] === runCurrent) {
        delete this.pendingMessages[number];
      }
    });
  }

  uploadAttachments(message) {
    debug("Message attachments: ", message.attachments);
    return Promise.all(
      message.attachments.map(this.makeAttachmentPointer.bind(this))
    )
      .then(attachmentPointers => {
        // eslint-disable-next-line no-param-reassign
        message.attachmentPointers = attachmentPointers;
      })
      .catch(error => {
        if (error instanceof Error && error.name === "HTTPError") {
          throw new errors.MessageError(message, error);
        } else {
          throw error;
        }
      });
  }

  async uploadLinkPreviews(message) {
    try {
      const preview = await Promise.all(
        (message.preview || []).map(async item => ({
          ...item,
          image: await this.makeAttachmentPointer(item.image)
        }))
      );
      // eslint-disable-next-line no-param-reassign
      message.preview = preview;
    } catch (error) {
      if (error instanceof Error && error.name === "HTTPError") {
        throw new errors.MessageError(message, error);
      } else {
        throw error;
      }
    }
  }

  async uploadSticker(message) {
    try {
      const { sticker } = message;

      if (!sticker || !sticker.data) {
        return;
      }

      const shouldPad = true;
      // eslint-disable-next-line no-param-reassign
      message.sticker = {
        ...sticker,
        attachmentPointer: await this.makeAttachmentPointer(
          sticker.data,
          shouldPad
        )
      };
    } catch (error) {
      if (error instanceof Error && error.name === "HTTPError") {
        throw new errors.MessageError(message, error);
      } else {
        throw error;
      }
    }
  }

  uploadThumbnails(message) {
    const makePointer = this.makeAttachmentPointer.bind(this);
    const { quote } = message;

    if (!quote || !quote.attachments || quote.attachments.length === 0) {
      return Promise.resolve();
    }

    return Promise.all(
      quote.attachments.map(attachment => {
        const { thumbnail } = attachment;
        if (!thumbnail) {
          return null;
        }

        return makePointer(thumbnail).then(pointer => {
          // eslint-disable-next-line no-param-reassign
          attachment.attachmentPointer = pointer;
        });
      })
    ).catch(error => {
      if (error instanceof Error && error.name === "HTTPError") {
        throw new errors.MessageError(message, error);
      } else {
        throw error;
      }
    });
  }

  async sendMessage(attrs, options) {
    if (!attrs.timestamp) {
      attrs.timestamp = Date.now();
    }
    attrs.profileKey = await this.store.getProfileKey();
    const message = new Message(attrs);
    const silent = false;

    return Promise.all([
      this.uploadAttachments(message),
      this.uploadThumbnails(message),
      this.uploadLinkPreviews(message),
      this.uploadSticker(message)
    ]).then(
      () =>
        new Promise((resolve, reject) => {
          this.sendMessageProto(
            message.timestamp,
            message.recipients,
            message.toProto(),
            res => {
              res.dataMessage = message.toArrayBuffer();
              if (res.errors.length > 0) {
                reject(res);
              } else {
                resolve(res);
              }
            },
            silent,
            options
          );
        })
    );
  }

  async sendMessageProto(
    timestamp,
    numbers,
    message,
    callback,
    silent,
    options = {}
  ) {
    debug("message to send: ", message);
    const rejections = await this.store.getSignedKeyRotationRejected();
    if (rejections > 5) {
      throw new errors.SignedPreKeyRotationError(
        numbers,
        message.toArrayBuffer(),
        timestamp
      );
    }

    const outgoing = new OutgoingMessage(
      this.server,
      this.store,
      timestamp,
      numbers,
      message,
      silent,
      callback,
      options
    );

    numbers.forEach(number => {
      this.queueJobForNumber(number, () => outgoing.sendToNumber(number));
    });
  }

  sendMessageProtoAndWait(timestamp, numbers, message, silent, options = {}) {
    return new Promise((resolve, reject) => {
      const callback = result => {
        if (result && result.errors && result.errors.length > 0) {
          return reject(result);
        }

        return resolve(result);
      };

      this.sendMessageProto(
        timestamp,
        numbers,
        message,
        callback,
        silent,
        options
      );
    });
  }

  sendIndividualProto(number, proto, timestamp, silent, options = {}) {
    return new Promise((resolve, reject) => {
      const callback = res => {
        if (res && res.errors && res.errors.length > 0) {
          reject(res);
        } else {
          resolve(res);
        }
      };
      this.sendMessageProto(
        timestamp,
        [number],
        proto,
        callback,
        silent,
        (options = {})
      );
    });
  }

  createSyncMessage() {
    const syncMessage = SyncMessage.create();

    // Generate a random int from 1 and 512
    const buffer = crypto.getRandomBytes(1);
    const paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    syncMessage.padding = crypto.getRandomBytes(paddingLength);

    return syncMessage;
  }

  async sendSyncMessage(
    encodedDataMessage,
    timestamp,
    destination,
    expirationStartTimestamp,
    sentTo = [],
    unidentifiedDeliveries = [],
    isUpdate = false,
    options
  ) {
    const myNumber = await this.store.getNumber();
    const myDevice = await this.store.getDeviceId();
    if (myDevice === 1 || myDevice === "1") {
      return Promise.resolve();
    }

    const dataMessage = DataMessage.decode(encodedDataMessage);
    const sentMessage = SyncMessageSent.create();
    sentMessage.timestamp = timestamp;
    sentMessage.message = dataMessage;
    if (destination) {
      sentMessage.destination = destination;
    }
    if (expirationStartTimestamp) {
      sentMessage.expirationStartTimestamp = expirationStartTimestamp;
    }

    const unidentifiedLookup = unidentifiedDeliveries.reduce(
      (accumulator, item) => {
        // eslint-disable-next-line no-param-reassign
        accumulator[item] = true;
        return accumulator;
      },
      Object.create(null)
    );

    if (isUpdate) {
      syncMessage.isRecipientUpdate = true;
    }

    // Though this field has 'unidenified' in the name, it should have entries for each
    //   number we sent to.
    if (sentTo && sentTo.length) {
      sentMessage.unidentifiedStatus = sentTo.map(number => {
        const status = SyncMessageSent.UnidentifiedDeliveryStatus.create();
        status.destination = number;
        status.unidentified = Boolean(unidentifiedLookup[number]);
        return status;
      });
    }

    const syncMessage = this.createSyncMessage();
    syncMessage.sent = sentMessage;
    const contentMessage = Content.create();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      timestamp,
      silent,
      options
    );
  }

  async getProfile(number, { accessKey } = {}) {
    if (accessKey) {
      return this.server.getProfileUnauth(number, { accessKey });
    }

    return this.server.getProfile(number);
  }
  getAvatar(path) {
    return this.server.getAvatar(path);
  }
  getSticker(packId, stickerId) {
    return this.server.getSticker(packId, stickerId);
  }
  getStickerPackManifest(packId) {
    return this.server.getStickerPackManifest(packId);
  }

  async sendRequestConfigurationSyncMessage(options) {
    const myNumber = await this.store.getNumber();
    const myDevice = await this.store.getDeviceId();
    if (myDevice !== 1 && myDevice !== "1") {
      const request = SyncMessageRequest.create();
      request.type = SyncMessageRequest.Type.CONFIGURATION;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = Content.create();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent,
        options
      );
    }

    return Promise.resolve();
  }
  async sendRequestGroupSyncMessage(options) {
    const myNumber = await this.store.getNumber();
    const myDevice = await this.store.getDeviceId();
    if (myDevice !== 1 && myDevice !== "1") {
      const request = SyncMessageRequest.create();
      request.type = SyncMessageRequest.Type.GROUPS;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = Content.create();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent,
        options
      );
    }

    return Promise.resolve();
  }

  async sendRequestContactSyncMessage(options) {
    const myNumber = await this.store.getNumber();
    const myDevice = await this.store.getDeviceId();
    if (myDevice !== 1 && myDevice !== "1") {
      const request = SyncMessageRequest.create();
      request.type = SyncMessageRequest.Type.CONTACTS;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = Content.create();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent,
        options
      );
    }

    return Promise.resolve();
  }

  async sendTypingMessage(options = {}, sendOptions = {}) {
    const ACTION_ENUM = TypingMessage.Action;
    const { recipientId, groupId, groupNumbers, isTyping, timestamp } = options;

    // We don't want to send typing messages to our other devices, but we will
    //   in the group case.
    const myNumber = await this.store.getNumber();
    if (recipientId && myNumber === recipientId) {
      return null;
    }

    if (!recipientId && !groupId) {
      throw new Error("Need to provide either recipientId or groupId!");
    }

    const recipients = groupId
      ? _.without(groupNumbers, myNumber)
      : [recipientId];
    const groupIdBuffer = groupId
      ? crypto.fromEncodedBinaryToArrayBuffer(groupId)
      : null;

    const action = isTyping ? ACTION_ENUM.STARTED : ACTION_ENUM.STOPPED;
    const finalTimestamp = timestamp || Date.now();

    const typingMessage = TypingMessage.create();
    typingMessage.groupId = groupIdBuffer;
    typingMessage.action = action;
    typingMessage.timestamp = finalTimestamp;

    const contentMessage = Content.create();
    contentMessage.typingMessage = typingMessage;

    const silent = true;
    const online = true;

    return this.sendMessageProtoAndWait(
      finalTimestamp,
      recipients,
      contentMessage,
      silent,
      {
        ...sendOptions,
        online
      }
    );
  }

  async sendDeliveryReceipt(recipientId, timestamp, options) {
    const myNumber = await this.store.getNumber();
    const myDevice = await this.store.getDeviceId();
    if (myNumber === recipientId && (myDevice === 1 || myDevice === "1")) {
      return Promise.resolve();
    }

    const receiptMessage = ReceiptMessage.create();
    receiptMessage.type = ReceiptMessage.Type.DELIVERY;
    receiptMessage.timestamp = [timestamp];

    const contentMessage = Content.create();
    contentMessage.receiptMessage = receiptMessage;

    const silent = true;
    return this.sendIndividualProto(
      recipientId,
      contentMessage,
      Date.now(),
      silent,
      options
    );
  }

  sendReadReceipts(sender, timestamps, options) {
    const receiptMessage = ReceiptMessage.create();
    receiptMessage.type = ReceiptMessage.Type.READ;
    receiptMessage.timestamp = timestamps;

    const contentMessage = Content.create();
    contentMessage.receiptMessage = receiptMessage;

    const silent = true;
    return this.sendIndividualProto(
      sender,
      contentMessage,
      Date.now(),
      silent,
      options
    );
  }
  async syncReadMessages(reads, options) {
    const myNumber = await this.store.getNumber();
    const myDevice = await this.store.getDeviceId();
    if (myDevice !== 1 && myDevice !== "1") {
      const syncMessage = this.createSyncMessage();
      syncMessage.read = [];
      for (let i = 0; i < reads.length; i += 1) {
        const read = SyncMessageRead.create();
        read.timestamp = reads[i].timestamp;
        read.sender = reads[i].sender;
        syncMessage.read.push(read);
      }
      const contentMessage = Content.create();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent,
        options
      );
    }

    return Promise.resolve();
  }
  async sendStickerPackSync(operations, options) {
    const myDevice = await this.store.getDeviceId();
    if (myDevice === 1 || myDevice === "1") {
      return null;
    }

    const myNumber = await this.store.getNumber();
    const ENUM = SyncMessageStickerPackOperation.Type;

    const packOperations = operations.map(item => {
      const { packId, packKey, installed } = item;

      const operation = SyncMessageStickerPackOperation.create();
      operation.packId = hexStringToArrayBuffer(packId);
      operation.packKey = base64ToArrayBuffer(packKey);
      operation.type = installed ? ENUM.INSTALL : ENUM.REMOVE;

      return operation;
    });

    const syncMessage = this.createSyncMessage();
    syncMessage.stickerPackOperation = packOperations;

    const contentMessage = Content.create();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      Date.now(),
      silent,
      options
    );
  }
  async syncVerification(destination, state, identityKey, options) {
    const myNumber = await this.store.getNumber();
    const myDevice = await this.store.getDeviceId();
    const now = Date.now();

    if (myDevice === 1 || myDevice === "1") {
      return Promise.resolve();
    }

    // First send a null message to mask the sync message.
    const nullMessage = NullMessage.create();

    // Generate a random int from 1 and 512
    const buffer = crypto.getRandomBytes(1);
    const paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    nullMessage.padding = crypto.getRandomBytes(paddingLength);

    const contentMessage = Content.create();
    contentMessage.nullMessage = nullMessage;

    // We want the NullMessage to look like a normal outgoing message; not silent
    const silent = false;
    const promise = this.sendIndividualProto(
      destination,
      contentMessage,
      now,
      silent,
      options
    );

    return promise.then(() => {
      const verified = Verified.create();
      verified.state = state;
      verified.destination = destination;
      verified.identityKey = identityKey;
      verified.nullMessage = nullMessage.padding;

      const syncMessage = this.createSyncMessage();
      syncMessage.verified = verified;

      const secondMessage = Content.create();
      secondMessage.syncMessage = syncMessage;

      const innerSilent = true;
      return this.sendIndividualProto(
        myNumber,
        secondMessage,
        now,
        innerSilent,
        options
      );
    });
  }

  async sendGroupProto(
    providedNumbers,
    proto,
    timestamp = Date.now(),
    options = {}
  ) {
    const me = await this.store.getNumber();
    const numbers = providedNumbers.filter(number => number !== me);
    if (numbers.length === 0) {
      return Promise.resolve({
        successfulNumbers: [],
        failoverNumbers: [],
        errors: [],
        unidentifiedDeliveries: [],
        dataMessage: helpers.convertToArrayBuffer(
          DataMessage.encode(proto).finish()
        )
      });
    }

    return new Promise((resolve, reject) => {
      const silent = true;
      const callback = res => {
        res.dataMessage = helpers.convertToArrayBuffer(
          DataMessage.encode(proto).finish()
        );
        if (res.errors.length > 0) {
          reject(res);
        } else {
          resolve(res);
        }
      };

      this.sendMessageProto(
        timestamp,
        numbers,
        proto,
        callback,
        silent,
        options
      );
    });
  }

  async getMessageProto(
    number,
    body,
    attachments,
    quote,
    preview,
    sticker,
    timestamp,
    expireTimer,
    flags
  ) {
    const attributes = {
      recipients: [number],
      body,
      timestamp,
      attachments,
      quote,
      preview,
      sticker,
      expireTimer,
      flags
    };

    return this.getMessageProtoObj(attributes);
  }

  async getMessageProtoObj(attributes) {
    if (!attrs.timestamp) {
      attrs.timestamp = Date.now();
    }
    attrs.profileKey = await this.store.getProfileKey();
    const message = new Message(attributes);
    await Promise.all([
      this.uploadAttachments(message),
      this.uploadThumbnails(message),
      this.uploadLinkPreviews(message),
      this.uploadSticker(message)
    ]);

    return message.toArrayBuffer();
  }

  async sendMessageToNumber(
    {
      number,
      body = "",
      attachments = [],
      quote,
      preview,
      sticker,
      timestamp,
      expireTimer
    },
    options = {}
  ) {
    return this.sendMessage(
      {
        recipients: [number],
        body: body,
        timestamp,
        attachments,
        quote,
        preview,
        sticker,
        expireTimer
      },
      options
    );
  }

  async resetSession(number, timestamp, options) {
    debug("resetting secure session");
    const silent = false;
    const proto = DataMessage.create();
    proto.body = "TERMINATE";
    proto.flags = DataMessage.Flags.END_SESSION;

    const logError = prefix => error => {
      debug(prefix, error && error.stack ? error.stack : error);
      throw error;
    };
    const deleteAllSessions = targetNumber =>
      this.store.getDeviceIds(targetNumber).then(deviceIds =>
        Promise.all(
          deviceIds.map(deviceId => {
            const address = new libsignal.SignalProtocolAddress(
              targetNumber,
              deviceId
            );
            debug("deleting sessions for", address.toString());
            const sessionCipher = new libsignal.SessionCipher(
              this.store,
              address
            );
            return sessionCipher.deleteAllSessionsForDevice();
          })
        )
      );

    const sendToContactPromise = deleteAllSessions(number)
      .catch(logError("resetSession/deleteAllSessions1 error:"))
      .then(() => {
        debug("finished closing local sessions, now sending to contact");
        return this.sendIndividualProto(
          number,
          proto,
          timestamp,
          silent,
          options
        ).catch(logError("resetSession/sendToContact error:"));
      })
      .then(() =>
        deleteAllSessions(number).catch(
          logError("resetSession/deleteAllSessions2 error:")
        )
      );

    const myNumber = await this.store.getNumber();
    // We already sent the reset session to our other devices in the code above!
    if (number === myNumber) {
      return sendToContactPromise;
    }

    const buffer = proto.toArrayBuffer();
    const sendSyncPromise = this.sendSyncMessage(
      buffer,
      timestamp,
      number,
      null,
      [],
      [],
      options
    ).catch(logError("resetSession/sendSync error:"));

    return Promise.all([sendToContactPromise, sendSyncPromise]);
  }

  async sendMessageToGroup(
    {
      groupId,
      groupNumbers = [],
      body = "",
      attachments = [],
      quote,
      preview,
      sticker,
      timestamp,
      expireTimer
    },
    options = {}
  ) {
    const me = await this.store.getNumber();
    const numbers = groupNumbers.filter(number => number !== me);
    const attrs = {
      recipients: groupNumbers,
      body: body,
      timestamp,
      attachments,
      quote,
      preview,
      sticker,
      expireTimer,
      group: {
        id: groupId,
        type: GroupContext.Type.DELIVER
      }
    };

    if (numbers.length === 0) {
      return Promise.resolve({
        successfulNumbers: [],
        failoverNumbers: [],
        errors: [],
        unidentifiedDeliveries: [],
        dataMessage: await this.getMessageProtoObj(attrs)
      });
    }

    return this.sendMessage(attrs, options);
  }

  createGroup(targetNumbers, id, name, avatar, options) {
    const proto = DataMessage.create();
    proto.group = GroupContext.create();
    proto.group.id = stringToArrayBuffer(id);

    proto.group.type = GroupContext.Type.UPDATE;
    proto.group.members = targetNumbers;
    proto.group.name = name;

    return this.makeAttachmentPointer(avatar).then(attachment => {
      proto.group.avatar = attachment;
      return this.sendGroupProto(
        targetNumbers,
        proto,
        Date.now(),
        options
      ).then(() => proto.group.id);
    });
  }

  updateGroup(groupId, name, avatar, targetNumbers, options) {
    const proto = DataMessage.create();
    proto.group = GroupContext.create();

    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = GroupContext.Type.UPDATE;
    proto.group.name = name;
    proto.group.members = targetNumbers;

    return this.makeAttachmentPointer(avatar).then(attachment => {
      proto.group.avatar = attachment;
      return this.sendGroupProto(
        targetNumbers,
        proto,
        Date.now(),
        options
      ).then(() => proto.group.id);
    });
  }

  addNumberToGroup(groupId, newNumber, options) {
    const proto = DataMessage.create();
    proto.group = GroupContext.create();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = GroupContext.Type.UPDATE;
    proto.group.members = newNumbers;
    return this.sendGroupProto(newNumbers, proto, Date.now(), options);
  }

  setGroupName(groupId, name) {
    const proto = DataMessage.create();
    proto.group = GroupContext.create();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = GroupContext.Type.UPDATE;
    proto.group.name = name;
    proto.group.members = groupNumbers;
    return this.sendGroupProto(groupNumbers, proto, Date.now(), options);
  }

  setGroupAvatar(groupId, avatar, groupNumbers, options) {
    const proto = DataMessage.create();
    proto.group = GroupContext.create();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = GroupContext.Type.UPDATE;
    proto.group.members = groupNumbers;
    return this.makeAttachmentPointer(avatar).then(attachment => {
      proto.group.avatar = attachment;
      return this.sendGroupProto(groupNumbers, proto, Date.now(), options);
    });
  }

  leaveGroup(groupId, groupNumbers, options) {
    const proto = DataMessage.create();
    proto.group = GroupContext.create();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = GroupContext.Type.QUIT;
    return this.sendGroupProto(groupNumbers, proto, Date.now(), options);
  }

  async sendExpirationTimerUpdateToGroup(
    groupId,
    groupNumbers,
    expireTimer,
    timestamp,
    options
  ) {
    const me = await this.store.getNumber();
    const numbers = groupNumbers.filter(number => number !== me);
    const attrs = {
      recipients: numbers,
      timestamp,
      expireTimer,
      flags: DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      group: {
        id: groupId,
        type: GroupContext.Type.DELIVER
      }
    };

    if (numbers.length === 0) {
      return Promise.resolve({
        successfulNumbers: [],
        failoverNumbers: [],
        errors: [],
        unidentifiedDeliveries: [],
        dataMessage: await this.getMessageProtoObj(attrs)
      });
    }

    return this.sendMessage(attrs, options);
  }

  async sendExpirationTimerUpdateToNumber(
    number,
    expireTimer,
    timestamp,
    options = {}
  ) {
    return this.sendMessage(
      {
        recipients: [number],
        timestamp,
        expireTimer,
        flags: DataMessage.Flags.EXPIRATION_TIMER_UPDATE
      },
      options
    );
  }
  makeProxiedRequest(url, options) {
    return this.server.makeProxiedRequest(url, options);
  }
}

exports = module.exports = WebAPI => {
  MessageSender.WebAPI = WebAPI;
  return MessageSender;
};
