const btoa = require("btoa");
const EventTarget = require("event-target-shim");
const Event = require("./event.js");
const libsignal = require("@throneless/libsignal-protocol");
const protobuf = require("./protobufs.js");
const ProvisionEnvelope = protobuf.lookupType(
  "signalservice.ProvisionEnvelope"
);
const ProvisioningUuid = protobuf.lookupType("signalservice.ProvisioningUuid");
const crypto = require("./crypto.js");
const provisioning = require("./ProvisioningCipher.js");
const WebSocketResource = require("./websocket-resources.js");
const libphonenumber = require("./libphonenumber-util.js");
const createTaskWithTimeout = require("./task_with_timeout.js");
const helpers = require("./helpers.js");

const ARCHIVE_AGE = 7 * 24 * 60 * 60 * 1000;

const VerifiedStatus = {
  DEFAULT: 0,
  VERIFIED: 1,
  UNVERIFIED: 2
};

function getNumber(numberId) {
  if (!numberId || !numberId.length) {
    return numberId;
  }

  const parts = numberId.split(".");
  if (!parts.length) {
    return numberId;
  }

  return parts[0];
}

class AccountManager extends EventTarget {
  constructor(username, password, store) {
    super(username, password, store);
    this.server = this.constructor.WebAPI.connect({ username, password });
    this.store = store;
    this.password = password;
    this.pending = Promise.resolve();
  }

  requestVoiceVerification(number) {
    return this.server.requestVerificationVoice(number);
  }

  requestSMSVerification(number) {
    return this.server.requestVerificationSMS(number);
  }

  registerSingleDevice(number, verificationCode) {
    const registerKeys = this.server.registerKeys.bind(this.server);
    const createAccount = this.createAccount.bind(this);
    const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
    const generateKeys = this.generateKeys.bind(this, 100);
    const confirmKeys = this.confirmKeys.bind(this);
    const registrationDone = this.registrationDone.bind(this);
    return this.queueTask(() =>
      libsignal.KeyHelper.generateIdentityKeyPair().then(identityKeyPair => {
        const profileKey = crypto.getRandomBytes(32);
        return createAccount(
          number,
          verificationCode,
          identityKeyPair,
          profileKey
        )
          .then(clearSessionsAndPreKeys)
          .then(generateKeys)
          .then(keys => registerKeys(keys).then(() => confirmKeys(keys)))
          .then(registrationDone);
      })
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
            console.info("provisioning socket closed. Code:", event.code);
            if (!gotProvisionEnvelope) {
              reject(new Error("websocket closed"));
            }
          };
          socket.onopen = () => {
            console.info("provisioning socket open");
          };
          const wsr = new WebSocketResource(socket, {
            keepalive: { path: "/v1/keepalive/provisioning" },
            handleRequest(request) {
              if (request.path === "/v1/address" && request.verb === "PUT") {
                const proto = ProvisioningUuid.decode(request.body);
                setProvisioningUrl(
                  [
                    "tsdevice:/?uuid=",
                    proto.uuid,
                    "&pub_key=",
                    encodeURIComponent(btoa(helpers.getString(pubKey)))
                  ].join("")
                );
                request.respond(200, "OK");
              } else if (
                request.path === "/v1/message" &&
                request.verb === "PUT"
              ) {
                const envelope = ProvisionEnvelope.decode(
                  request.body,
                  "binary"
                );
                request.respond(200, "OK");
                gotProvisionEnvelope = true;
                wsr.close();
                resolve(
                  provisioningCipher.decrypt(envelope).then(provisionMessage =>
                    queueTask(() =>
                      confirmNumber(provisionMessage.number).then(
                        deviceName => {
                          if (
                            typeof deviceName !== "string" ||
                            deviceName.length === 0
                          ) {
                            throw new Error("Invalid device name");
                          }
                          return createAccount(
                            provisionMessage.number,
                            provisionMessage.provisioningCode,
                            provisionMessage.identityKeyPair,
                            provisionMessage.profileKey,
                            deviceName,
                            provisionMessage.userAgent,
                            provisionMessage.readReceipts
                          )
                            .then(clearSessionsAndPreKeys)
                            .then(generateKeys)
                            .then(keys =>
                              registerKeys(keys).then(() => confirmKeys(keys))
                            )
                            .then(registrationDone);
                        }
                      )
                    )
                  )
                );
              } else {
                console.error("Unknown websocket message", request.path);
              }
            }
          });
        })
    );
  }

  refreshPreKeys() {
    const generateKeys = this.generateKeys.bind(this, 100);
    const registerKeys = this.server.registerKeys.bind(this.server);

    return this.queueTask(() =>
      this.server.getMyKeys().then(preKeyCount => {
        console.info(`prekey count ${preKeyCount}`);
        if (preKeyCount < 10) {
          return generateKeys().then(registerKeys);
        }
        return null;
      })
    );
  }

  rotateSignedPreKey() {
    return this.queueTask(() => {
      const signedKeyId = this.store.get("signedKeyId", 1);
      if (typeof signedKeyId !== "number") {
        throw new Error("Invalid signedKeyId");
      }

      const { server, cleanSignedPreKeys } = this;

      // TODO: harden this against missing identity key? Otherwise, we get
      //   retries every five seconds.
      return this.store
        .getIdentityKeyPair()
        .then(
          identityKey =>
            libsignal.KeyHelper.generateSignedPreKey(identityKey, signedKeyId),
          () => {
            console.error(
              "Failed to get identity key. Canceling key rotation."
            );
          }
        )
        .then(res => {
          if (!res) {
            return null;
          }
          console.info("Saving new signed prekey", res.keyId);
          return Promise.all([
            this.store.put("signedKeyId", signedKeyId + 1),
            this.store.storeSignedPreKey(res.keyId, res.keyPair),
            server.setSignedPreKey({
              keyId: res.keyId,
              publicKey: res.keyPair.pubKey,
              signature: res.signature
            })
          ])
            .then(() => {
              const confirmed = true;
              console.info("Confirming new signed prekey", res.keyId);
              return Promise.all([
                this.store.remove("signedKeyRotationRejected"),
                this.store.storeSignedPreKey(res.keyId, res.keyPair, confirmed)
              ]);
            })
            .then(() => cleanSignedPreKeys());
        })
        .catch(e => {
          console.error(
            "rotateSignedPrekey error:",
            e && e.stack ? e.stack : e
          );

          if (
            e instanceof Error &&
            e.name === "HTTPError" &&
            e.code >= 400 &&
            e.code <= 599
          ) {
            const rejections =
              1 + this.store.get("signedKeyRotationRejected", 0);
            this.store.put("signedKeyRotationRejected", rejections);
            console.error("Signed key rotation rejected count:", rejections);
          } else {
            throw e;
          }
        });
    });
  }

  queueTask(task) {
    const taskWithTimeout = createTaskWithTimeout(task);
    this.pending = this.pending.then(taskWithTimeout, taskWithTimeout);

    return this.pending;
  }

  cleanSignedPreKeys() {
    const MINIMUM_KEYS = 3;
    return this.store.loadSignedPreKeys().then(allKeys => {
      allKeys.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
      allKeys.reverse(); // we want the most recent first
      let confirmed = allKeys.filter(key => key.confirmed);
      const unconfirmed = allKeys.filter(key => !key.confirmed);

      const recent = allKeys[0] ? allKeys[0].keyId : "none";
      const recentConfirmed = confirmed[0] ? confirmed[0].keyId : "none";
      console.info(`Most recent signed key: ${recent}`);
      console.info(`Most recent confirmed signed key: ${recentConfirmed}`);
      console.info(
        "Total signed key count:",
        allKeys.length,
        "-",
        confirmed.length,
        "confirmed"
      );

      let confirmedCount = confirmed.length;

      // Keep MINIMUM_KEYS confirmed keys, then drop if older than a week
      confirmed = confirmed.forEach((key, index) => {
        if (index < MINIMUM_KEYS) {
          return;
        }
        const createdAt = key.created_at || 0;
        const age = Date.now() - createdAt;

        if (age > ARCHIVE_AGE) {
          console.info(
            "Removing confirmed signed prekey:",
            key.keyId,
            "with timestamp:",
            createdAt
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
          console.info(
            "Removing unconfirmed signed prekey:",
            key.keyId,
            "with timestamp:",
            createdAt
          );
          this.store.removeSignedPreKey(key.keyId);
        }
      });
    });
  }

  createAccount(
    number,
    verificationCode,
    identityKeyPair,
    profileKey,
    deviceName,
    userAgent,
    readReceipts
  ) {
    const signalingKey = crypto.getRandomBytes(32 + 20);
    const registrationId = libsignal.KeyHelper.generateRegistrationId();

    const previousNumber = getNumber(this.store.get("number_id"));

    return this.server
      .confirmCode(
        number,
        verificationCode,
        this.password,
        signalingKey,
        registrationId,
        deviceName
      )
      .then(response => {
        if (previousNumber && previousNumber !== number) {
          console.warn(
            "New number is different from old number; deleting all previous data"
          );

          return this.store.removeAllData().then(
            () => {
              console.info("Successfully deleted previous data");
              return response;
            },
            error => {
              console.error(
                "Something went wrong deleting data from previous number",
                error && error.stack ? error.stack : error
              );

              return response;
            }
          );
        }

        return response;
      })
      .then(response => {
        this.store.remove("identityKey");
        this.store.remove("signaling_key");
        this.store.remove("registrationId");
        this.store.remove("number_id");
        this.store.remove("device_name");
        this.store.remove("regionCode");
        this.store.remove("userAgent");
        this.store.remove("profileKey");
        this.store.remove("read-receipts-setting");

        // update our own identity key, which may have changed
        // if we're relinking after a reinstall on the master device
        this.store.saveIdentityWithAttributes(number, {
          id: number,
          publicKey: identityKeyPair.pubKey,
          firstUse: true,
          timestamp: Date.now(),
          verified: VerifiedStatus.VERIFIED,
          nonblockingApproval: true
        });

        this.store.put("identityKey", identityKeyPair);
        this.store.put("signaling_key", signalingKey);
        this.store.put("registrationId", registrationId);
        if (profileKey) {
          this.store.put("profileKey", profileKey);
        }
        if (userAgent) {
          this.store.put("userAgent", userAgent);
        }
        if (readReceipts) {
          this.store.put("read-receipt-setting", true);
        } else {
          this.store.put("read-receipt-setting", false);
        }

        this.store.userSetNumberAndDeviceId(
          number,
          response.deviceId || 1,
          deviceName
        );
        this.store.put(
          "regionCode",
          libphonenumber.util.getRegionCodeForNumber(number)
        );
      });
  }

  clearSessionsAndPreKeys() {
    console.info("clearing all sessions, prekeys, and signed prekeys");
    return Promise.all([
      this.store.clearPreKeyStore(),
      this.store.clearSignedPreKeysStore(),
      this.store.clearSessionStore()
    ]);
  }

  // Takes the same object returned by generateKeys
  confirmKeys(keys) {
    const key = keys.signedPreKey;
    const confirmed = true;

    console.info("confirmKeys: confirming key", key.keyId);
    return this.store.storeSignedPreKey(key.keyId, key.keyPair, confirmed);
  }

  generateKeys(count, providedProgressCallback) {
    const progressCallback =
      typeof providedProgressCallback === "function"
        ? providedProgressCallback
        : null;
    const startId = this.store.get("maxPreKeyId", 1);
    const signedKeyId = this.store.get("signedKeyId", 1);

    if (typeof startId !== "number") {
      throw new Error("Invalid maxPreKeyId");
    }
    if (typeof signedKeyId !== "number") {
      throw new Error("Invalid signedKeyId");
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
              publicKey: res.keyPair.pubKey
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
              keyPair: res.keyPair
            };
          }
        )
      );

      this.store.put("maxPreKeyId", startId + count);
      this.store.put("signedKeyId", signedKeyId + 1);
      return Promise.all(promises).then(() =>
        // This is primarily for the signed prekey summary it logs out
        this.cleanSignedPreKeys().then(() => result)
      );
    });
  }

  registrationDone() {
    console.info("registration done");
    this.dispatchEvent(new Event("registration"));
  }
}

exports = module.exports = WebAPI => {
  AccountManager.WebAPI = WebAPI;
  return AccountManager;
};
