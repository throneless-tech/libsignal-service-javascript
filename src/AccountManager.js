/*
 * vim: ts=2:sw=2:expandtab
 */



const btoa = require('btoa');
const { default: PQueue } = require('p-queue');
const debug = require('debug')('libsignal-service:AccountManager');
const libsignal = require('@throneless/libsignal-protocol');
const EventTarget = require('./EventTarget.js');
const Event = require('./Event.js');
const protobuf = require('./protobufs.js');

const ProvisionEnvelope = protobuf.lookupType(
  'signalservice.ProvisionEnvelope'
);
const DeviceName = protobuf.lookupType('signalservice.DeviceName');
const ProvisioningUuid = protobuf.lookupType('signalservice.ProvisioningUuid');
const crypto = require('./crypto.js');
const WebSocketResource = require('./WebSocketResource.js');
const libphonenumber = require('./libphonenumber-util.js');
const createTaskWithTimeout = require('./taskWithTimeout.js');
const helpers = require('./helpers.js');

const ARCHIVE_AGE = 7 * 24 * 60 * 60 * 1000;

const VerifiedStatus = {
  DEFAULT: 0,
  VERIFIED: 1,
  UNVERIFIED: 2,
};

class AccountManager extends EventTarget {
  constructor(username, password, store) {
    super(username, password, store);
    this.server = this.constructor.WebAPI.connect({ username, password });
    this.store = store;
    this.username = username;
    this.password = password;
    this.pending = Promise.resolve();
  }

  requestVoiceVerification() {
    return this.server.requestVerificationVoice(this.username);
  }

  requestSMSVerification(token) {
    return this.server.requestVerificationSMS(this.username, token);
  }

  async encryptDeviceName(name, providedIdentityKey) {
    if (!name) {
      return null;
    }
    const identityKey =      providedIdentityKey || (await this.store.getIdentityKeyPair());
    if (!identityKey) {
      throw new Error('Identity key was not provided and is not in database!');
    }
    const encrypted = await crypto.encryptDeviceName(name, identityKey.pubKey);

    const proto = DeviceName.create();
    proto.ephemeralPublic = new Uint8Array(encrypted.ephemeralPublic);
    proto.syntheticIv = encrypted.syntheticIv;
    proto.ciphertext = new Uint8Array(encrypted.ciphertext);

    const arrayBuffer = DeviceName.encode(proto).finish();
    return crypto.arrayBufferToBase64(arrayBuffer);
  }

  async decryptDeviceName(base64) {
    const identityKey = await this.store.getIdentityKeyPair();

    const arrayBuffer = crypto.base64ToArrayBuffer(base64);
    const proto = DeviceName.decode(new Uint8Array(arrayBuffer));
    // const encrypted = {
    //  ephemeralPublic: proto.ephemeralPublic.toArrayBuffer(),
    //  syntheticIv: proto.syntheticIv.toArrayBuffer(),
    //  ciphertext: proto.ciphertext.toArrayBuffer()
    // };

    const name = await crypto.decryptDeviceName(proto, identityKey.privKey);

    return name;
  }

  async maybeUpdateDeviceName() {
    const isNameEncrypted = this.store.getDeviceNameEncrypted();
    if (isNameEncrypted) {
      return;
    }
    const deviceName = await this.store.getDeviceName();
    const base64 = await this.encryptDeviceName(deviceName);

    await this.server.updateDeviceName(base64);
  }

  async deviceNameIsEncrypted() {
    await this.store.setDeviceNameEncrypted();
  }

  async maybeDeleteSignalingKey() {
    const key = await this.store.getSignalingKey();
    if (key) {
      await this.server.removeSignalingKey();
    }
  }

  registerSingleDevice(verificationCode) {
    const registerKeys = this.server.registerKeys.bind(this.server);
    const createAccount = this.createAccount.bind(this);
    const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
    const generateKeys = this.generateKeys.bind(this, 100);
    const confirmKeys = this.confirmKeys.bind(this);
    const registrationDone = this.registrationDone.bind(this);
    return this.queueTask(() =>
      libsignal.KeyHelper.generateIdentityKeyPair().then(
        async identityKeyPair => {
          const profileKey = crypto.getRandomBytes(32);
          const accessKey = await crypto.deriveAccessKey(profileKey);

          return createAccount(
            this.username,
            verificationCode,
            identityKeyPair,
            profileKey,
            null,
            null,
            null,
            { accessKey }
          )
            .then(clearSessionsAndPreKeys)
            .then(generateKeys)
            .then(keys => registerKeys(keys).then(() => confirmKeys(keys)))
            .then(() => registrationDone({ number: this.username }));
        }
      )
    );
  }

  registerSecondDevice(setProvisioningUrl, confirmNumber, progressCallback) {
    const createAccount = this.createAccount.bind(this);
    const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
    const generateKeys = this.generateKeys.bind(this, 100, progressCallback);
    const confirmKeys = this.confirmKeys.bind(this);
    const registrationDone = this.registrationDone.bind(this);
    const registerKeys = this.server.registerKeys.bind(this.server);
    const getSocket = this.server.getProvisioningSocket.bind(this.server);
    const queueTask = this.queueTask.bind(this);
    const provisioningCipher = new libsignal.ProvisioningCipher();
    let gotProvisionEnvelope = false;
    return provisioningCipher.getPublicKey().then(
      pubKey =>
        new Promise((resolve, reject) => {
          const socket = getSocket();
          socket.onclose = event => {
            debug('provisioning socket closed. Code:', event.code);
            if (!gotProvisionEnvelope) {
              reject(new Error('websocket closed'));
            }
          };
          socket.onopen = () => {
            debug('provisioning socket open');
          };
          const wsr = new WebSocketResource(socket, {
            keepalive: { path: '/v1/keepalive/provisioning' },
            handleRequest(request) {
              if (request.path === '/v1/address' && request.verb === 'PUT') {
                const proto = ProvisioningUuid.decode(request.body);
                setProvisioningUrl(
                  [
                    'tsdevice:/?uuid=',
                    proto.uuid,
                    '&pub_key=',
                    encodeURIComponent(btoa(helpers.getString(pubKey))),
                  ].join('')
                );
                request.respond(200, 'OK');
              } else if (
                request.path === '/v1/message'
                && request.verb === 'PUT'
              ) {
                const envelope = ProvisionEnvelope.decode(
                  request.body,
                  'binary'
                );
                request.respond(200, 'OK');
                gotProvisionEnvelope = true;
                wsr.close();
                resolve(
                  provisioningCipher.decrypt(envelope).then(provisionMessage =>
                    queueTask(() =>
                      confirmNumber(provisionMessage.number).then(
                        deviceName => {
                          if (
                            typeof deviceName !== 'string'
                            || deviceName.length === 0
                          ) {
                            throw new Error('Invalid device name');
                          }
                          return createAccount(
                            provisionMessage.number,
                            provisionMessage.provisioningCode,
                            provisionMessage.identityKeyPair,
                            provisionMessage.profileKey,
                            deviceName,
                            provisionMessage.userAgent,
                            provisionMessage.readReceipts,
                            { uuid: provisionMessage.uuid }
                          )
                            .then(clearSessionsAndPreKeys)
                            .then(generateKeys)
                            .then(keys =>
                              registerKeys(keys).then(() => confirmKeys(keys))
                            )
                            .then(() => registrationDone(provisionMessage));
                        }
                      )
                    )
                  )
                );
              } else {
                debug('Unknown websocket message', request.path);
              }
            },
          });
        })
    );
  }

  refreshPreKeys() {
    const generateKeys = this.generateKeys.bind(this, 100);
    const registerKeys = this.server.registerKeys.bind(this.server);

    return this.queueTask(() =>
      this.server.getMyKeys().then(preKeyCount => {
        debug(`prekey count ${preKeyCount}`);
        if (preKeyCount < 10) {
          return generateKeys().then(registerKeys);
        }
        return null;
      })
    );
  }

  rotateSignedPreKey() {
    return this.queueTask(() => {
      const signedKeyId = this.store.getSignedKeyId();
      if (typeof signedKeyId !== 'number') {
        throw new Error('Invalid signedKeyId');
      }

      const { server, cleanSignedPreKeys } = this;

      return this.store
        .getIdentityKeyPair()
        .then(
          identityKey =>
            libsignal.KeyHelper.generateSignedPreKey(identityKey, signedKeyId),
          () => {
            // We swallow any error here, because we don't want to get into
            //   a loop of repeated retries.
            debug('Failed to get identity key. Canceling key rotation.');
          }
        )
        .then(res => {
          if (!res) {
            return null;
          }
          debug('Saving new signed prekey', res.keyId);
          return Promise.all([
            this.store.setSignedKeyId(signedKeyId + 1),
            this.store.storeSignedPreKey(res.keyId, res.keyPair),
            server.setSignedPreKey({
              keyId: res.keyId,
              publicKey: res.keyPair.pubKey,
              signature: res.signature,
            }),
          ])
            .then(() => {
              const confirmed = true;
              debug('Confirming new signed prekey', res.keyId);
              return Promise.all([
                this.store.removeSignedKeyRotationRejected(),
                this.store.storeSignedPreKey(res.keyId, res.keyPair, confirmed),
              ]);
            })
            .then(() => cleanSignedPreKeys());
        })
        .catch(e => {
          debug('rotateSignedPrekey error:', e && e.stack ? e.stack : e);

          if (
            e instanceof Error
            && e.name === 'HTTPError'
            && e.code >= 400
            && e.code <= 599
          ) {
            const rejections = 1 + this.store.getSignedKeyRotationRejected();
            this.store.setSignedKeyRotationRejected(rejections);
            debug('Signed key rotation rejected count:', rejections);
          } else {
            throw e;
          }
        });
    });
  }

  queueTask(task) {
    this.pendingQueue = this.pendingQueue || new PQueue({ concurrency: 1 });
    const taskWithTimeout = createTaskWithTimeout(task);

    return this.pendingQueue.add(taskWithTimeout);
  }

  cleanSignedPreKeys() {
    const MINIMUM_KEYS = 3;
    return this.store.loadSignedPreKeys().then(allKeys => {
      allKeys.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
      allKeys.reverse(); // we want the most recent first
      const confirmed = allKeys.filter(key => key.confirmed);
      const unconfirmed = allKeys.filter(key => !key.confirmed);

      const recent = allKeys[0] ? allKeys[0].keyId : 'none';
      const recentConfirmed = confirmed[0] ? confirmed[0].keyId : 'none';
      debug(`Most recent signed key: ${recent}`);
      debug(`Most recent confirmed signed key: ${recentConfirmed}`);
      debug(
        'Total signed key count:',
        allKeys.length,
        '-',
        confirmed.length,
        'confirmed'
      );

      let confirmedCount = confirmed.length;

      // Keep MINIMUM_KEYS confirmed keys, then drop if older than a week
      confirmed.forEach((key, index) => {
        if (index < MINIMUM_KEYS) {
          return;
        }
        const createdAt = key.created_at || 0;
        const age = Date.now() - createdAt;

        if (age > ARCHIVE_AGE) {
          debug(
            'Removing confirmed signed prekey:',
            key.keyId,
            'with timestamp:',
            new Date(createdAt).toJSON()
          );
          this.store.removeSignedPreKey(key.keyId);
          confirmedCount -= 1;
        }
      });

      const stillNeeded = MINIMUM_KEYS - confirmedCount;

      // If we still don't have enough total keys, we keep as many unconfirmed
      // keys as necessary. If not necessary, and over a week old, we drop.
      unconfirmed.forEach((key, index) => {
        if (index < stillNeeded) {
          return;
        }

        const createdAt = key.created_at || 0;
        const age = Date.now() - createdAt;
        if (age > ARCHIVE_AGE) {
          debug(
            'Removing unconfirmed signed prekey:',
            key.keyId,
            'with timestamp:',
            new Date(createdAt).toJSON()
          );
          this.store.removeSignedPreKey(key.keyId);
        }
      });
    });
  }

  async createAccount(
    number,
    verificationCode,
    identityKeyPair,
    profileKey,
    deviceName,
    userAgent,
    readReceipts,
    options = {}
  ) {
    const { accessKey } = options;
    const registrationId = libsignal.KeyHelper.generateRegistrationId();

    const previousNumber = this.store.getNumber();
    const previousUuid = this.store.getUuid();

    const encryptedDeviceName = await this.encryptDeviceName(
      deviceName,
      identityKeyPair
    );
    await this.deviceNameIsEncrypted();

    debug(
      `createAccount: Number is ${number}, password has length: ${
        this.password ? this.password.length : 'none'
      }`
    );

    const response = await this.server.confirmCode(
      number,
      verificationCode,
      this.password,
      registrationId,
      encryptedDeviceName,
      { accessKey }
    );

    const numberChanged = previousNumber && previousNumber !== number;
    const uuidChanged =      previousUuid && response.uuid && previousUuid !== response.uuid;

    if (numberChanged || uuidChanged) {
      if (numberChanged) {
        debug(
          'New number is different from old number; deleting all previous data'
        );
      }
      if (uuidChanged) {
        debug(
          'New uuid is different from old uuid; deleting all previous data'
        );
      }

      try {
        await this.store.removeAllData();
        debug('Successfully deleted previous data');
      } catch (error) {
        debug(
          'Something went wrong deleting data from previous number',
          error && error.stack ? error.stack : error
        );
      }
    }

    await Promise.all([this.store.removeAllConfiguration()]);

    // `setNumberAndDeviceId` and `setUuidAndDeviceId` need to be called
    // before `saveIdentifyWithAttributes` since `saveIdentityWithAttributes`
    // indirectly calls `ConversationController.getConverationId()` which
    // initializes the conversation for the given number (our number) which
    // calls out to the user storage API to get the stored UUID and number
    // information.

    await this.store.setNumberAndDeviceId(
      number,
      response.deviceId || 1,
      deviceName
    );

    const setUuid = response.uuid;
    if (setUuid) {
      await this.store.setUuidAndDeviceId(setUuid, response.deviceId || 1);
    }

    // update our own identity key, which may have changed
    // if we're relinking after a reinstall on the master device
    await this.store.saveIdentityWithAttributes(number, {
      publicKey: identityKeyPair.pubKey,
      firstUse: true,
      timestamp: Date.now(),
      verified: VerifiedStatus.VERIFIED,
      nonblockingApproval: true,
    });

    await this.store.setIdentityKeyPair(identityKeyPair);
    await this.store.setPassword(this.password);
    await this.store.setLocalRegistrationId(registrationId);
    if (profileKey) {
      await this.store.setProfileKey(profileKey);
    }
    if (userAgent) {
      await this.store.setUserAgent(userAgent);
    }
    await this.store.setReadReceiptSetting(Boolean(readReceipts));

    const regionCode = libphonenumber.util.getRegionCodeForNumber(number);
    await this.store.setRegionCode(regionCode);
  }

  async clearSessionsAndPreKeys() {
    debug('clearing all sessions, prekeys, and signed prekeys');
    await Promise.all([
      this.store.clearPreKeyStore(),
      this.store.clearSignedPreKeysStore(),
      this.store.clearSessionStore(),
    ]);
  }

  // Takes the same object returned by generateKeys
  async confirmKeys(keys) {
    const key = keys.signedPreKey;
    const confirmed = true;

    debug('confirmKeys: confirming key', key.keyId);
    await this.store.storeSignedPreKey(key.keyId, key.keyPair, confirmed);
  }

  async generateKeys(count, providedProgressCallback) {
    const progressCallback =      typeof providedProgressCallback === 'function'
        ? providedProgressCallback
        : null;
    const startId = await this.store.getMaxPreKeyId();
    const signedKeyId = await this.store.getSignedKeyId();

    if (typeof startId !== 'number') {
      throw new Error('Invalid maxPreKeyId');
    }
    if (typeof signedKeyId !== 'number') {
      throw new Error('Invalid signedKeyId');
    }

    return this.store.getIdentityKeyPair().then(identityKey => {
      const result = { preKeys: [], identityKey: identityKey.pubKey };
      const promises = [];

      for (let keyId = startId; keyId < startId + count; keyId += 1) {
        promises.push(
          libsignal.KeyHelper.generatePreKey(keyId).then(res => {
            this.store.storePreKey(res.keyId, res.keyPair);
            result.preKeys.push({
              keyId: res.keyId,
              publicKey: res.keyPair.pubKey,
            });
            if (progressCallback) {
              progressCallback();
            }
          })
        );
      }

      promises.push(
        libsignal.KeyHelper.generateSignedPreKey(identityKey, signedKeyId).then(
          res => {
            this.store.storeSignedPreKey(res.keyId, res.keyPair);
            result.signedPreKey = {
              keyId: res.keyId,
              publicKey: res.keyPair.pubKey,
              signature: res.signature,
              // server.registerKeys doesn't use keyPair, confirmKeys does
              keyPair: res.keyPair,
            };
          }
        )
      );

      this.store.setMaxPreKeyId(startId + count);
      this.store.setSignedKeyId(signedKeyId + 1);
      return Promise.all(promises).then(() =>
        // This is primarily for the signed prekey summary it logs out
        this.cleanSignedPreKeys().then(() => result)
      );
    });
  }

  // eslint-disable-next-line no-unused-vars
  async registrationDone({ uuid, number }) {
    debug('registration done');

    // Ensure that we always have a conversation for ourself
    // await ConversationController.getOrCreateAndWait(number, "private");
    // const conversation = await ConversationController.getOrCreateAndWait(
    //  number || uuid,
    //  'private'
    // );
    // conversation.updateE164(number);
    // conversation.updateUuid(uuid);

    debug('dispatching registration event');

    this.dispatchEvent(new Event('registration'));
  }
}

exports = module.exports = WebAPI => {
  AccountManager.WebAPI = WebAPI;
  return AccountManager;
};
