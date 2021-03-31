import * as client from 'libsignal-client';
import ByteBuffer from 'bytebuffer';
import { crypto } from '../shims';
import { PreKeyWhisperMessage, WhisperMessage } from './ProtobufWrapper';

const dcodeIO = {
    ByteBuffer,
};

/* vim: ts=4:sw=4:expandtab */
const Internal = {};
const libsignal = {};

Internal.protobuf = {};
Internal.protobuf.PreKeyWhisperMessage = PreKeyWhisperMessage;
Internal.protobuf.WhisperMessage = WhisperMessage;

if (!crypto || !crypto.subtle || typeof crypto.getRandomValues !== 'function') {
    throw new Error('WebCrypto not found');
}

Internal.crypto = {
    getRandomBytes(size) {
        const array = new Uint8Array(size);
        crypto.getRandomValues(array);
        return array.buffer;
    },

    encrypt(key, data, iv) {
        return Promise.resolve(window.synchronousCrypto.encrypt(key, data, iv));
    },
    decrypt(key, data, iv) {
        return Promise.resolve(window.synchronousCrypto.decrypt(key, data, iv));
    },
    sign(key, data) {
        return Promise.resolve(window.synchronousCrypto.sign(key, data));
    },

    hash(data) {
        return Promise.resolve(window.synchronousCrypto.hash(data));
    },

    HKDF(input, salt, info) {
        return Internal.crypto.sign(salt, input).then(function(PRK) {
            const infoBuffer = new ArrayBuffer(info.byteLength + 1 + 32);
            const infoArray = new Uint8Array(infoBuffer);
            infoArray.set(new Uint8Array(info), 32);
            infoArray[infoArray.length - 1] = 1;
            return Internal.crypto.sign(PRK, infoBuffer.slice(32)).then(function(T1) {
                infoArray.set(new Uint8Array(T1));
                infoArray[infoArray.length - 1] = 2;
                return Internal.crypto.sign(PRK, infoBuffer).then(function(T2) {
                    infoArray.set(new Uint8Array(T2));
                    infoArray[infoArray.length - 1] = 3;
                    return Internal.crypto.sign(PRK, infoBuffer).then(function(T3) {
                        return [ T1, T2, T3 ];
                    });
                });
            });
        });
    },

    // Curve 25519 crypto
    createKeyPair(privKey) {
        if (privKey === undefined) {
            privKey = Internal.crypto.getRandomBytes(32);
        }
        return Internal.Curve.async.createKeyPair(privKey);
    },
    ECDHE(pubKey, privKey) {
        return Internal.Curve.async.ECDHE(pubKey, privKey);
    },
    Ed25519Sign(privKey, message) {
        return Internal.Curve.async.Ed25519Sign(privKey, message);
    },
    Ed25519Verify(pubKey, msg, sig) {
        return Internal.Curve.async.Ed25519Verify(pubKey, msg, sig);
    },
};


// HKDF for TextSecure has a bit of additional handling - salts always end up being 32 bytes
Internal.HKDF = function(input, salt, info = new ArrayBuffer()) {
    return Internal.crypto.HKDF(input, salt,  util.toArrayBuffer(info));
};

Internal.verifyMAC = function(data, key, mac, length) {
    return Internal.crypto.sign(key, data).then(function(calculated_mac) {
        if (mac.byteLength != length  || calculated_mac.byteLength < length) {
            throw new Error('Bad MAC length');
        }
        const a = new Uint8Array(calculated_mac);
        const b = new Uint8Array(mac);
        let result = 0;
        for (let i=0; i < mac.byteLength; ++i) {
            result |= (a[i] ^ b[i]);
        }
        if (result !== 0) {
            throw new Error('Bad MAC');
        }
    });
};

libsignal.crypto = {
    encrypt(key, data, iv) {
        return Internal.crypto.encrypt(key, data, iv);
    },
    decrypt(key, data, iv) {
        return Internal.crypto.decrypt(key, data, iv);
    },
    calculateMAC(key, data) {
        return Internal.crypto.sign(key, data);
    },
    verifyMAC(data, key, mac, length) {
        return Internal.verifyMAC(data, key, mac, length);
    },
    getRandomBytes(size) {
        return Internal.crypto.getRandomBytes(size);
    },
};

var util = (function() {
    

    const StaticArrayBufferProto = new ArrayBuffer().__proto__;

    return {
        toString(thing) {
            if (typeof thing === 'string') {
                return thing;
            }
            return new dcodeIO.ByteBuffer.wrap(thing).toString('binary');
        },
        toArrayBuffer(thing) {
            if (thing === undefined) {
                return undefined;
            }
            if (thing === Object(thing)) {
                if (thing.__proto__ == StaticArrayBufferProto) {
                    return thing;
                }
            }

            let str;
            if (typeof thing === 'string') {
                str = thing;
            } else {
                throw new Error(`Tried to convert a non-string of type ${  typeof thing  } to an array buffer`);
            }
            return new dcodeIO.ByteBuffer.wrap(thing, 'binary').toArrayBuffer();
        },
        isEqual(a, b) {
            // TODO: Special-case arraybuffers, etc
            if (a === undefined || b === undefined) {
                return false;
            }
            a = util.toString(a);
            b = util.toString(b);
            const maxLength = Math.max(a.length, b.length);
            if (maxLength < 5) {
                throw new Error('a/b compare too short');
            }
            return a.substring(0, Math.min(maxLength, a.length)) == b.substring(0, Math.min(maxLength, b.length));
        },
    };
})();

function isNonNegativeInteger(n) {
    return (typeof n === 'number' && (n % 1) === 0  && n >= 0);
}

const KeyHelper = {
    generateIdentityKeyPair() {
        return Internal.crypto.createKeyPair();
    },

    generateRegistrationId() {
        const registrationId = new Uint16Array(Internal.crypto.getRandomBytes(2))[0];
        return registrationId & 0x3fff;
    },

    generateSignedPreKey (identityKeyPair, signedKeyId) {
        if (!(identityKeyPair.privKey instanceof ArrayBuffer) ||
            identityKeyPair.privKey.byteLength != 32 ||
            !(identityKeyPair.pubKey instanceof ArrayBuffer) ||
            identityKeyPair.pubKey.byteLength != 33) {
            throw new TypeError('Invalid argument for identityKeyPair');
        }
        if (!isNonNegativeInteger(signedKeyId)) {
            throw new TypeError(
                `Invalid argument for signedKeyId: ${  signedKeyId}`
            );
        }

        return Internal.crypto.createKeyPair().then(function(keyPair) {
            return Internal.crypto.Ed25519Sign(identityKeyPair.privKey, keyPair.pubKey).then(function(sig) {
                return {
                    keyId      : signedKeyId,
                    keyPair,
                    signature  : sig,
                };
            });
        });
    },

    generatePreKey(keyId) {
        if (!isNonNegativeInteger(keyId)) {
            throw new TypeError(`Invalid argument for keyId: ${  keyId}`);
        }

        return Internal.crypto.createKeyPair().then(function(keyPair) {
            return { keyId, keyPair };
        });
    },
};

libsignal.KeyHelper = KeyHelper;

Internal.BaseKeyType = {
  OURS: 1,
  THEIRS: 2,
};
Internal.ChainType = {
  SENDING: 1,
  RECEIVING: 2,
};

Internal.SessionRecord = function() {
    
    const ARCHIVED_STATES_MAX_LENGTH = 40;
    const OLD_RATCHETS_MAX_LENGTH = 10;
    const SESSION_RECORD_VERSION = 'v1';

    const StaticByteBufferProto = new dcodeIO.ByteBuffer().__proto__;
    const StaticArrayBufferProto = new ArrayBuffer().__proto__;
    const StaticUint8ArrayProto = new Uint8Array().__proto__;

    function isStringable(thing) {
        return (thing === Object(thing) &&
                (thing.__proto__ == StaticArrayBufferProto ||
                    thing.__proto__ == StaticUint8ArrayProto ||
                    thing.__proto__ == StaticByteBufferProto));
    }
    function ensureStringed(thing) {
        if (typeof thing === 'string' || typeof thing === 'number' || typeof thing === 'boolean') {
            return thing;
        } if (isStringable(thing)) {
            return util.toString(thing);
        } if (thing instanceof Array) {
            const array = [];
            for (let i = 0; i < thing.length; i++) {
                array[i] = ensureStringed(thing[i]);
            }
            return array;
        } if (thing === Object(thing)) {
            const obj = {};
            for (const key in thing) {
                try {
                  obj[key] = ensureStringed(thing[key]);
                } catch (ex) {
                  console.log('Error serializing key', key);
                  throw ex;
                }
            }
            return obj;
        } if (thing === null) {
            return null;
        } 
            throw new Error(`unsure of how to jsonify object of type ${  typeof thing}`);
        
    }

    function jsonThing(thing) {
        return JSON.stringify(ensureStringed(thing)); // TODO: jquery???
    }

    const migrations = [
      {
        version: 'v1',
        migrate: function migrateV1(data) {
          const {sessions} = data;
          let key;
          if (data.registrationId) {
              for (key in sessions) {
                  if (!sessions[key].registrationId) {
                      sessions[key].registrationId = data.registrationId;
                  }
              }
          } else {
              for (key in sessions) {
                  if (sessions[key].indexInfo.closed === -1) {
                      console.log('V1 session storage migration error: registrationId',
                          data.registrationId, 'for open session version',
                          data.version);
                  }
              }
          }
        },
      },
    ];

    function migrate(data) {
      let run = (data.version === undefined);
      for (let i=0; i < migrations.length; ++i) {
        if (run) {
          migrations[i].migrate(data);
        } else if (migrations[i].version === data.version) {
          run = true;
        }
      }
      if (!run) {
        throw new Error('Error migrating SessionRecord');
      }
    }

    const SessionRecord = function() {
        this.sessions = {};
        this.version = SESSION_RECORD_VERSION;
    };

    SessionRecord.deserialize = function(serialized) {
        const data = JSON.parse(serialized);
        if (data.version !== SESSION_RECORD_VERSION) { migrate(data); }

        const record = new SessionRecord();
        record.sessions = data.sessions;
        if (record.sessions === undefined || record.sessions === null || typeof record.sessions !== 'object' || Array.isArray(record.sessions)) {
            throw new Error('Error deserializing SessionRecord');
        }
        return record;
    };

    SessionRecord.prototype = {
        serialize() {
            return jsonThing({
                sessions       : this.sessions,
                version        : this.version,
            });
        },
        haveOpenSession() {
            const openSession = this.getOpenSession();
            return (!!openSession && typeof openSession.registrationId === 'number');
        },

        getSessionByBaseKey(baseKey) {
            const session = this.sessions[util.toString(baseKey)];
            if (session && session.indexInfo.baseKeyType === Internal.BaseKeyType.OURS) {
                console.log('Tried to lookup a session using our basekey');
                return undefined;
            }
            return session;
        },
        getSessionByRemoteEphemeralKey(remoteEphemeralKey) {
            this.detectDuplicateOpenSessions();
            const {sessions} = this;

            const searchKey = util.toString(remoteEphemeralKey);

            let openSession;
            for (const key in sessions) {
                if (sessions[key].indexInfo.closed == -1) {
                    openSession = sessions[key];
                }
                if (sessions[key][searchKey] !== undefined) {
                    return sessions[key];
                }
            }
            if (openSession !== undefined) {
                return openSession;
            }

            return undefined;
        },
        getOpenSession() {
            const {sessions} = this;
            if (sessions === undefined) {
                return undefined;
            }

            this.detectDuplicateOpenSessions();

            for (const key in sessions) {
                if (sessions[key].indexInfo.closed == -1) {
                    return sessions[key];
                }
            }
            return undefined;
        },
        detectDuplicateOpenSessions() {
            let openSession;
            const {sessions} = this;
            for (const key in sessions) {
                if (sessions[key].indexInfo.closed == -1) {
                    if (openSession !== undefined) {
                        throw new Error('Datastore inconsistensy: multiple open sessions');
                    }
                    openSession = sessions[key];
                }
            }
        },
        updateSessionState(session) {
            const {sessions} = this;

            this.removeOldChains(session);

            sessions[util.toString(session.indexInfo.baseKey)] = session;

            this.removeOldSessions();

        },
        getSessions() {
            // return an array of sessions ordered by time closed,
            // followed by the open session
            let list = [];
            let openSession;
            for (const k in this.sessions) {
                if (this.sessions[k].indexInfo.closed === -1) {
                    openSession = this.sessions[k];
                } else {
                    list.push(this.sessions[k]);
                }
            }
            list = list.sort(function(s1, s2) {
                return s1.indexInfo.closed - s2.indexInfo.closed;
            });
            if (openSession) {
                list.push(openSession);
            }
            return list;
        },
        archiveCurrentState() {
            const open_session = this.getOpenSession();
            if (open_session !== undefined) {
                console.log('closing session');
                open_session.indexInfo.closed = Date.now();
                this.updateSessionState(open_session);
            }
        },
        promoteState(session) {
            console.log('promoting session');
            session.indexInfo.closed = -1;
        },
        removeOldChains(session) {
            // Sending ratchets are always removed when we step because we never need them again
            // Receiving ratchets are added to the oldRatchetList, which we parse
            // here and remove all but the last ten.
            while (session.oldRatchetList.length > OLD_RATCHETS_MAX_LENGTH) {
                let index = 0;
                let oldest = session.oldRatchetList[0];
                for (let i = 0; i < session.oldRatchetList.length; i++) {
                    if (session.oldRatchetList[i].added < oldest.added) {
                        oldest = session.oldRatchetList[i];
                        index = i;
                    }
                }
                console.log('Deleting chain closed at', oldest.added);
                delete session[util.toString(oldest.ephemeralKey)];
                session.oldRatchetList.splice(index, 1);
            }
        },
        removeOldSessions() {
            // Retain only the last 20 sessions
            const {sessions} = this;
            let oldestBaseKey; let oldestSession;
            while (Object.keys(sessions).length > ARCHIVED_STATES_MAX_LENGTH) {
                for (const key in sessions) {
                    const session = sessions[key];
                    if (session.indexInfo.closed > -1 && // session is closed
                        (!oldestSession || session.indexInfo.closed < oldestSession.indexInfo.closed)) {
                        oldestBaseKey = key;
                        oldestSession = session;
                    }
                }
                console.log('Deleting session closed at', oldestSession.indexInfo.closed);
                delete sessions[util.toString(oldestBaseKey)];
            }
        },
        deleteAllSessions() {
            // Used primarily in session reset scenarios, where we really delete sessions
            this.sessions = {};
        },
    };

    return SessionRecord;
}();

function SignalProtocolAddress(name, deviceId) {
  this.name = name;
  this.deviceId = deviceId;
}

SignalProtocolAddress.prototype = {
  getName() {
    return this.name;
  },
  getDeviceId() {
    return this.deviceId;
  },
  toString() {
    return `${this.name  }.${  this.deviceId}`;
  },
  equals(other) {
    if (!(other instanceof SignalProtocolAddress)) { return false; }
    return other.name === this.name && other.deviceId === this.deviceId;
  },
};

libsignal.SignalProtocolAddress = function(name, deviceId) {
  const address = new SignalProtocolAddress(name, deviceId);

  ['getName', 'getDeviceId', 'toString', 'equals'].forEach(function(method) {
    this[method] = address[method].bind(address);
  }.bind(this));
};

libsignal.SignalProtocolAddress.fromString = function(encodedAddress) {
  if (typeof encodedAddress !== 'string' || !encodedAddress.match(/.*\.\d+/)) {
    throw new Error('Invalid SignalProtocolAddress string');
  }
  const parts = encodedAddress.split('.');
  return new libsignal.SignalProtocolAddress(parts[0], parseInt(parts[1]));
};

function SessionBuilder(storage, remoteAddress) {
  this.remoteAddress = remoteAddress;
  this.storage = storage;
}

SessionBuilder.prototype = {
  processPreKey(device) {
    return Internal.SessionLock.queueJobForNumber(this.remoteAddress.toString(), function() {
      return this.storage.isTrustedIdentity(
          this.remoteAddress.getName(), device.identityKey, this.storage.Direction.SENDING
      ).then(function(trusted) {
        if (!trusted) {
          throw new Error('Identity key changed');
        }

        return Internal.crypto.Ed25519Verify(
          device.identityKey,
          device.signedPreKey.publicKey,
          device.signedPreKey.signature
        );
      }).then(didVerificationFail => {
        // Ed25519Verify returns `false` when verification succeeds and `true` if it fails.
        if (didVerificationFail) {
          throw new Error('Signature verification failed');
        }
        return Internal.crypto.createKeyPair();
      }).then(function(baseKey) {
        let devicePreKey;
        if (device.preKey) {
            devicePreKey = device.preKey.publicKey;
        }
        return this.initSession(true, baseKey, undefined, device.identityKey,
          devicePreKey, device.signedPreKey.publicKey, device.registrationId
        ).then(function(session) {
            session.pendingPreKey = {
                signedKeyId : device.signedPreKey.keyId,
                baseKey     : baseKey.pubKey,
            };
            if (device.preKey) {
              session.pendingPreKey.preKeyId = device.preKey.keyId;
            }
            return session;
        });
      }.bind(this)).then(function(session) {
        const address = this.remoteAddress.toString();
        return this.storage.loadSession(address).then(function(serialized) {
          let record;
          if (serialized !== undefined) {
            record = Internal.SessionRecord.deserialize(serialized);
          } else {
            record = new Internal.SessionRecord();
          }

          record.archiveCurrentState();
          record.updateSessionState(session);
          return Promise.all([
            this.storage.storeSession(address, record.serialize()),
            this.storage.saveIdentity(this.remoteAddress.toString(), device.identityKey),
          ]);
        }.bind(this));
      }.bind(this));
    }.bind(this));
  },
  processV3(record, message) {
    let preKeyPair; let signedPreKeyPair; let session;
    return this.storage.isTrustedIdentity(
        this.remoteAddress.getName(), message.identityKey.toArrayBuffer(), this.storage.Direction.RECEIVING
    ).then(function(trusted) {
        if (!trusted) {
            const e = new Error('Unknown identity key');
            e.identityKey = message.identityKey.toArrayBuffer();
            throw e;
        }
        return Promise.all([
            this.storage.loadPreKey(message.preKeyId),
            this.storage.loadSignedPreKey(message.signedPreKeyId),
        ]).then(function(results) {
            preKeyPair       = results[0];
            signedPreKeyPair = results[1];
        });
    }.bind(this)).then(function() {
        session = record.getSessionByBaseKey(message.baseKey);
        if (session) {
          console.log('Duplicate PreKeyMessage for session');
          return;
        }

        session = record.getOpenSession();

        if (signedPreKeyPair === undefined) {
            // Session may or may not be the right one, but if its not, we
            // can't do anything about it ...fall through and let
            // decryptWhisperMessage handle that case
            if (session !== undefined && session.currentRatchet !== undefined) {
                return;
            } 
                throw new Error('Missing Signed PreKey for PreKeyWhisperMessage');
            
        }

        if (session !== undefined) {
            record.archiveCurrentState();
        }
        if (message.preKeyId && !preKeyPair) {
            console.log('Invalid prekey id', message.preKeyId);
        }

        return this.initSession(false, preKeyPair, signedPreKeyPair,
            message.identityKey.toArrayBuffer(),
            message.baseKey.toArrayBuffer(), undefined, message.registrationId
        ).then(function(new_session) {
            // Note that the session is not actually saved until the very
            // end of decryptWhisperMessage ... to ensure that the sender
            // actually holds the private keys for all reported pubkeys
            record.updateSessionState(new_session);
            return this.storage.saveIdentity(this.remoteAddress.toString(), message.identityKey.toArrayBuffer()).then(function() {
              return message.preKeyId;
            });
        }.bind(this));
    }.bind(this));
  },
  initSession(isInitiator, ourEphemeralKey, ourSignedKey,
                   theirIdentityPubKey, theirEphemeralPubKey,
                   theirSignedPubKey, registrationId) {
    return this.storage.getIdentityKeyPair().then(function(ourIdentityKey) {
        if (isInitiator) {
            if (ourSignedKey !== undefined) {
                throw new Error('Invalid call to initSession');
            }
            ourSignedKey = ourEphemeralKey;
        } else {
            if (theirSignedPubKey !== undefined) {
                throw new Error('Invalid call to initSession');
            }
            theirSignedPubKey = theirEphemeralPubKey;
        }

        let sharedSecret;
        if (ourEphemeralKey === undefined || theirEphemeralPubKey === undefined) {
            sharedSecret = new Uint8Array(32 * 4);
        } else {
            sharedSecret = new Uint8Array(32 * 5);
        }

        for (let i = 0; i < 32; i++) {
            sharedSecret[i] = 0xff;
        }

        return Promise.all([
            Internal.crypto.ECDHE(theirSignedPubKey, ourIdentityKey.privKey),
            Internal.crypto.ECDHE(theirIdentityPubKey, ourSignedKey.privKey),
            Internal.crypto.ECDHE(theirSignedPubKey, ourSignedKey.privKey),
        ]).then(function(ecRes) {
            if (isInitiator) {
                sharedSecret.set(new Uint8Array(ecRes[0]), 32);
                sharedSecret.set(new Uint8Array(ecRes[1]), 32 * 2);
            } else {
                sharedSecret.set(new Uint8Array(ecRes[0]), 32 * 2);
                sharedSecret.set(new Uint8Array(ecRes[1]), 32);
            }
            sharedSecret.set(new Uint8Array(ecRes[2]), 32 * 3);

            if (ourEphemeralKey !== undefined && theirEphemeralPubKey !== undefined) {
                return Internal.crypto.ECDHE(
                    theirEphemeralPubKey, ourEphemeralKey.privKey
                ).then(function(ecRes4) {
                    sharedSecret.set(new Uint8Array(ecRes4), 32 * 4);
                });
            }
        }).then(function() {
            return Internal.HKDF(sharedSecret.buffer, new ArrayBuffer(32), 'WhisperText');
        }).then(function(masterKey) {
            const session = {
                registrationId,
                currentRatchet: {
                    rootKey                : masterKey[0],
                    lastRemoteEphemeralKey : theirSignedPubKey,
                    previousCounter        : 0,
                },
                indexInfo: {
                    remoteIdentityKey : theirIdentityPubKey,
                    closed            : -1,
                },
                oldRatchetList: [],
            };

            // If we're initiating we go ahead and set our first sending ephemeral key now,
            // otherwise we figure it out when we first maybeStepRatchet with the remote's ephemeral key
            if (isInitiator) {
                session.indexInfo.baseKey = ourEphemeralKey.pubKey;
                session.indexInfo.baseKeyType = Internal.BaseKeyType.OURS;
                return Internal.crypto.createKeyPair().then(function(ourSendingEphemeralKey) {
                    session.currentRatchet.ephemeralKeyPair = ourSendingEphemeralKey;
                    return this.calculateSendingRatchet(session, theirSignedPubKey).then(function() {
                        return session;
                    });
                }.bind(this));
            } 
                session.indexInfo.baseKey = theirEphemeralPubKey;
                session.indexInfo.baseKeyType = Internal.BaseKeyType.THEIRS;
                session.currentRatchet.ephemeralKeyPair = ourSignedKey;
                return session;
            
        }.bind(this));
    }.bind(this));
  },
  calculateSendingRatchet(session, remoteKey) {
      const ratchet = session.currentRatchet;

      return Internal.crypto.ECDHE(
          remoteKey, util.toArrayBuffer(ratchet.ephemeralKeyPair.privKey)
      ).then(function(sharedSecret) {
          return Internal.HKDF(
              sharedSecret, util.toArrayBuffer(ratchet.rootKey), 'WhisperRatchet'
          );
      }).then(function(masterKey) {
          session[util.toString(ratchet.ephemeralKeyPair.pubKey)] = {
              messageKeys : {},
              chainKey    : { counter : -1, key : masterKey[1] },
              chainType   : Internal.ChainType.SENDING,
          };
          ratchet.rootKey = masterKey[0];
      });
  },

};

libsignal.SessionBuilder = function (storage, remoteAddress) {
  const builder = new SessionBuilder(storage, remoteAddress);
  this.processPreKey = builder.processPreKey.bind(builder);
  this.processV3 = builder.processV3.bind(builder);
};

function SessionCipher(storage, remoteAddress, options) {
  this.remoteAddress = remoteAddress;
  this.storage = storage;
  this.options = options || {};
}

SessionCipher.prototype = {
  getRecord(encodedNumber) {
      return this.storage.loadSession(encodedNumber).then(function(serialized) {
          if (serialized === undefined) {
              return undefined;
          }
          return Internal.SessionRecord.deserialize(serialized);
      });
  },
  // encoding is an optional parameter - wrap() will only translate if one is provided
  encrypt(buffer, encoding) {
    buffer = dcodeIO.ByteBuffer.wrap(buffer, encoding).toArrayBuffer();
    return Internal.SessionLock.queueJobForNumber(this.remoteAddress.toString(), function() {
      if (!(buffer instanceof ArrayBuffer)) {
          throw new Error('Expected buffer to be an ArrayBuffer');
      }

      const address = this.remoteAddress.toString();
      let ourIdentityKey; let myRegistrationId; let record; let session; let chain;

      const msg = new Internal.protobuf.WhisperMessage();

      return Promise.all([
          this.storage.getIdentityKeyPair(),
          this.storage.getLocalRegistrationId(),
          this.getRecord(address),
      ]).then(function(results) {
          ourIdentityKey   = results[0];
          myRegistrationId = results[1];
          record           = results[2];
          if (!record) {
              throw new Error(`No record for ${  address}`);
          }
          session = record.getOpenSession();
          if (!session) {
              throw new Error(`No session to encrypt message for ${  address}`);
          }

          msg.ephemeralKey = util.toArrayBuffer(
              session.currentRatchet.ephemeralKeyPair.pubKey
          );
          chain = session[util.toString(msg.ephemeralKey)];
          if (chain.chainType === Internal.ChainType.RECEIVING) {
              throw new Error('Tried to encrypt on a receiving chain');
          }

          return this.fillMessageKeys(chain, chain.chainKey.counter + 1);
      }.bind(this)).then(function() {
          return Internal.HKDF(
              util.toArrayBuffer(chain.messageKeys[chain.chainKey.counter]),
              new ArrayBuffer(32), 'WhisperMessageKeys');
      }).then(function(keys) {
          delete chain.messageKeys[chain.chainKey.counter];
          msg.counter = chain.chainKey.counter;
          msg.previousCounter = session.currentRatchet.previousCounter;
          if (msg.previousCounter < 0) {
              msg.previousCounter = 0;
          }

          return Internal.crypto.encrypt(
              keys[0], buffer, keys[2].slice(0, 16)
          ).then(function(ciphertext) {
              msg.ciphertext = ciphertext;
              const encodedMsg = msg.toArrayBuffer();

              const ourIdentityKeyBuffer = util.toArrayBuffer(ourIdentityKey.pubKey);
              const theirIdentityKey = util.toArrayBuffer(session.indexInfo.remoteIdentityKey);
              const macInput = new Uint8Array(encodedMsg.byteLength + 33*2 + 1);
              macInput.set(new Uint8Array(ourIdentityKeyBuffer));
              macInput.set(new Uint8Array(theirIdentityKey), 33);
              macInput[33*2] = (3 << 4) | 3;
              macInput.set(new Uint8Array(encodedMsg), 33*2 + 1);

              return Internal.crypto.sign(keys[1], macInput.buffer).then(function(mac) {
                  const result = new Uint8Array(encodedMsg.byteLength + 9);
                  result[0] = (3 << 4) | 3;
                  result.set(new Uint8Array(encodedMsg), 1);
                  result.set(new Uint8Array(mac, 0, 8), encodedMsg.byteLength + 1);

                  return this.storage.isTrustedIdentity(
                      this.remoteAddress.getName(), theirIdentityKey, this.storage.Direction.SENDING
                  ).then(function(trusted) {
                      if (!trusted) {
                          throw new Error('Identity key changed');
                      }
                  }).then(function() {
                      return this.storage.saveIdentity(this.remoteAddress.toString(), theirIdentityKey);
                  }.bind(this)).then(function() {
                      record.updateSessionState(session);
                      return this.storage.storeSession(address, record.serialize()).then(function() {
                          return result;
                      });
                  }.bind(this));
              }.bind(this));
          }.bind(this));
      }.bind(this)).then(function(message) {
          if (session.pendingPreKey !== undefined) {
              const preKeyMsg = new Internal.protobuf.PreKeyWhisperMessage();
              preKeyMsg.identityKey = util.toArrayBuffer(ourIdentityKey.pubKey);
              preKeyMsg.registrationId = myRegistrationId;

              preKeyMsg.baseKey = util.toArrayBuffer(session.pendingPreKey.baseKey);
              if (session.pendingPreKey.preKeyId) {
                  preKeyMsg.preKeyId = session.pendingPreKey.preKeyId;
              }
              preKeyMsg.signedPreKeyId = session.pendingPreKey.signedKeyId;

              preKeyMsg.message = message;
              const result = String.fromCharCode((3 << 4) | 3) + util.toString(preKeyMsg.encode());
              return {
                  type           : 3,
                  body           : result,
                  registrationId : session.registrationId,
              };

          } 
              return {
                  type           : 1,
                  body           : util.toString(message),
                  registrationId : session.registrationId,
              };
          
      });
    }.bind(this));
  },
  decryptWithSessionList(buffer, sessionList, errors) {
    // Iterate recursively through the list, attempting to decrypt
    // using each one at a time. Stop and return the result if we get
    // a valid result
    if (sessionList.length === 0) {
        let error = errors[0];
        if (!error) {
            error = new Error('decryptWithSessionList: list is empty, but no errors in array');
        }
        if (errors.length > 1) {
            errors.forEach((item, index) => {
                const stackString = error && error.stack ? error.stack : error;
                const extraString = error && error.extra ? JSON.stringify(error.extra) : '';
                console.error(`decryptWithSessionList: Error at index ${index}: ${extraString} ${stackString}`);
            });
        }
        return Promise.reject(error);
    }

    const session = sessionList.pop();
    return this.doDecryptWhisperMessage(buffer, session).then(function(plaintext) {
        return { plaintext, session };
    }).catch(function(e) {
        if (e.name === 'MessageCounterError') {
            return Promise.reject(e);
        }

        errors.push(e);
        return this.decryptWithSessionList(buffer, sessionList, errors);
    }.bind(this));
  },
  decryptWhisperMessage(buffer, encoding) {
      buffer = dcodeIO.ByteBuffer.wrap(buffer, encoding).toArrayBuffer();
      return Internal.SessionLock.queueJobForNumber(this.remoteAddress.toString(), function() {
        const address = this.remoteAddress.toString();
        return this.getRecord(address).then(function(record) {
            if (!record) {
                throw new Error(`No record for device ${  address}`);
            }

            // Only used for printing out debug information when errors happen
            const messageProto = buffer.slice(1, buffer.byteLength - 8);
            const message = Internal.protobuf.WhisperMessage.decode(messageProto);
            const byEphemeralKey = record.getSessionByRemoteEphemeralKey(util.toString(message.ephemeralKey));

            const errors = [];
            return this.decryptWithSessionList(buffer, record.getSessions(), errors).then(function(result) {
                return this.getRecord(address).then(function(record) {
                    const openSession = record.getOpenSession();
                    if (!openSession) {
                      record.archiveCurrentState();
                      record.promoteState(result.session);
                    }

                    return this.storage.isTrustedIdentity(
                        this.remoteAddress.getName(), util.toArrayBuffer(result.session.indexInfo.remoteIdentityKey), this.storage.Direction.RECEIVING
                    ).then(function(trusted) {
                        if (!trusted) {
                            throw new Error('Identity key changed');
                        }
                    }).then(function() {
                        return this.storage.saveIdentity(this.remoteAddress.toString(), result.session.indexInfo.remoteIdentityKey);
                    }.bind(this)).then(function() {
                        record.updateSessionState(result.session);
                        return this.storage.storeSession(address, record.serialize()).then(function() {
                            return result.plaintext;
                        });
                    }.bind(this));
                }.bind(this));
            }.bind(this)).catch(function(error) {
                try {
                    error.extra = error.extra || {};
                    error.extra.foundMatchingSession = Boolean(byEphemeralKey);

                    if (byEphemeralKey) {
                        const receivingChainInfo = {};
                        const entries = Object.entries(byEphemeralKey);                     
                    
                        entries.forEach(([key, item]) => {
                            if (item && item.chainType === Internal.ChainType.RECEIVING && item.chainKey) {
                                const hexKey = dcodeIO.ByteBuffer.wrap(key, 'binary').toString('hex');
                                receivingChainInfo[hexKey] = {
                                    counter: item.chainKey.counter,
                                };
                            }
                        });

                        error.extra.receivingChainInfo = receivingChainInfo;
                    }
                } catch (innerError) {
                    console.error(
                        'decryptWhisperMessage: Problem collecting extra information:', 
                        innerError && innerError.stack ? innerError.stack : innerError
                    );
                }

                throw error;
            });
        }.bind(this));
      }.bind(this));
  },
  decryptPreKeyWhisperMessage(buffer, encoding) {
      buffer = dcodeIO.ByteBuffer.wrap(buffer, encoding);
      const version = buffer.readUint8();
      if ((version & 0xF) > 3 || (version >> 4) < 3) {  // min version > 3 or max version < 3
          throw new Error('Incompatible version number on PreKeyWhisperMessage');
      }
      return Internal.SessionLock.queueJobForNumber(this.remoteAddress.toString(), function() {
          const address = this.remoteAddress.toString();
          return this.getRecord(address).then(function(record) {
              const preKeyProto = Internal.protobuf.PreKeyWhisperMessage.decode(buffer);
              if (!record) {
                  if (preKeyProto.registrationId === undefined) {
                      throw new Error('No registrationId');
                  }
                  record = new Internal.SessionRecord(
                      preKeyProto.registrationId
                  );
              }
              const builder = new SessionBuilder(this.storage, this.remoteAddress);
              // isTrustedIdentity is called within processV3, no need to call it here
              return builder.processV3(record, preKeyProto).then(function(preKeyId) {
                  const session = record.getSessionByBaseKey(preKeyProto.baseKey);
                  return this.doDecryptWhisperMessage(
                      preKeyProto.message.toArrayBuffer(), session
                  ).then(function(plaintext) {
                      record.updateSessionState(session);
                      return this.storage.storeSession(address, record.serialize()).then(function() {
                          if (preKeyId !== undefined && preKeyId !== null) {
                              return this.storage.removePreKey(preKeyId);
                          }
                      }.bind(this)).then(function() {
                          return plaintext;
                      });
                  }.bind(this));
              }.bind(this));
          }.bind(this));
      }.bind(this));
  },
  doDecryptWhisperMessage(messageBytes, session) {
    if (!(messageBytes instanceof ArrayBuffer)) {
        throw new Error('Expected messageBytes to be an ArrayBuffer');
    }
    const version = (new Uint8Array(messageBytes))[0];
    if ((version & 0xF) > 3 || (version >> 4) < 3) {  // min version > 3 or max version < 3
        throw new Error('Incompatible version number on WhisperMessage');
    }
    const messageProto = messageBytes.slice(1, messageBytes.byteLength- 8);
    const mac = messageBytes.slice(messageBytes.byteLength - 8, messageBytes.byteLength);

    const message = Internal.protobuf.WhisperMessage.decode(messageProto);
    const remoteEphemeralKey = message.ephemeralKey.toArrayBuffer();

    if (session === undefined) {
        const error = new Error(`No session found to decrypt message from ${  this.remoteAddress.toString()}`);
        error.extra = {
            messageCounter: message.counter,
            ratchetKey: message.ephemeralKey.toString('hex'),
        };
        return Promise.reject(error);
    }
    if (session.indexInfo.closed != -1) {
        console.log('decrypting message for closed session');
    }

    return this.maybeStepRatchet(session, remoteEphemeralKey, message.previousCounter).then(function() {
        const chain = session[util.toString(message.ephemeralKey)];
        if (chain.chainType === Internal.ChainType.SENDING) {
            throw new Error('Tried to decrypt on a sending chain');
        }

        return this.fillMessageKeys(chain, message.counter).then(function() {
            const messageKey = chain.messageKeys[message.counter];
            if (messageKey === undefined) {
                const e = new Error(`Message key not found. Counter ${message.counter} was repeated or the key was not filled.`);
                e.name = 'MessageCounterError';
                throw e;
            }
            delete chain.messageKeys[message.counter];
            return Internal.HKDF(util.toArrayBuffer(messageKey), new ArrayBuffer(32), 'WhisperMessageKeys');
        });
    }.bind(this)).then(function(keys) {
        return this.storage.getIdentityKeyPair().then(function(ourIdentityKey) {
            const remoteIdentityKey = util.toArrayBuffer(session.indexInfo.remoteIdentityKey);
            const ourPubKey = util.toArrayBuffer(ourIdentityKey.pubKey);

            const macInput = new Uint8Array(messageProto.byteLength + 33*2 + 1);
            macInput.set(new Uint8Array(remoteIdentityKey));
            macInput.set(new Uint8Array(ourPubKey), 33);
            macInput[33*2] = (3 << 4) | 3;
            macInput.set(new Uint8Array(messageProto), 33*2 + 1);

            return Internal.verifyMAC(macInput.buffer, keys[1], mac, 8);
        }).then(function() {
            return Internal.crypto.decrypt(keys[0], message.ciphertext.toArrayBuffer(), keys[2].slice(0, 16));
        });
    }.bind(this)).then(function(plaintext) {
        delete session.pendingPreKey;
        return plaintext;
    }).catch(function(error) {
        error.extra = {
            messageCounter: message.counter,
            ratchetKey: message.ephemeralKey.toString('hex'),
        };
        throw error;
    });
  },
  fillMessageKeys(chain, counter) {
      if (chain.chainKey.counter >= counter) {
          return Promise.resolve(); // Already calculated
      }

      let limit = 5000;
      if (this.options.messageKeysLimit === false) {
          // noop
      } else {
          if (this.options.messageKeysLimit > 0) {
              limit = this.options.messageKeysLimit;
          }

          if (counter - chain.chainKey.counter > limit) {
              throw new Error(`Over ${  limit  } messages into the future! New: ${  counter  }, Existing: ${  chain.chainKey.counter}`);
          }
      }


      if (chain.chainKey.key === undefined) {
          throw new Error('Got invalid request to extend chain after it was already closed');
      }

      const key = util.toArrayBuffer(chain.chainKey.key);
      const byteArray = new Uint8Array(1);
      byteArray[0] = 1;
      return Internal.crypto.sign(key, byteArray.buffer).then(function(mac) {
          byteArray[0] = 2;
          return Internal.crypto.sign(key, byteArray.buffer).then(function(key) {
              chain.messageKeys[chain.chainKey.counter + 1] = mac;
              chain.chainKey.key = key;
              chain.chainKey.counter += 1;
              return this.fillMessageKeys(chain, counter);
          }.bind(this));
      }.bind(this));
  },
  maybeStepRatchet(session, remoteKey, previousCounter) {
      if (session[util.toString(remoteKey)] !== undefined) {
          return Promise.resolve();
      }

      console.log('New remote ephemeral key');
      const ratchet = session.currentRatchet;

      return Promise.resolve().then(function() {
          const previousRatchet = session[util.toString(ratchet.lastRemoteEphemeralKey)];
          if (previousRatchet !== undefined) {
              return this.fillMessageKeys(previousRatchet, previousCounter).then(function() {
                  delete previousRatchet.chainKey.key;
                  session.oldRatchetList[session.oldRatchetList.length] = {
                      added        : Date.now(),
                      ephemeralKey : ratchet.lastRemoteEphemeralKey,
                  };
              });
          }
      }.bind(this)).then(function() {
          return this.calculateRatchet(session, remoteKey, false).then(function() {
              // Now swap the ephemeral key and calculate the new sending chain
              const previousRatchet = util.toString(ratchet.ephemeralKeyPair.pubKey);
              if (session[previousRatchet] !== undefined) {
                  ratchet.previousCounter = session[previousRatchet].chainKey.counter;
                  delete session[previousRatchet];
              }

              return Internal.crypto.createKeyPair().then(function(keyPair) {
                  ratchet.ephemeralKeyPair = keyPair;
                  return this.calculateRatchet(session, remoteKey, true).then(function() {
                      ratchet.lastRemoteEphemeralKey = remoteKey;
                  });
              }.bind(this));
          }.bind(this));
      }.bind(this));
  },
  calculateRatchet(session, remoteKey, sending) {
      const ratchet = session.currentRatchet;

      return Internal.crypto.ECDHE(remoteKey, util.toArrayBuffer(ratchet.ephemeralKeyPair.privKey)).then(function(sharedSecret) {
          return Internal.HKDF(sharedSecret, util.toArrayBuffer(ratchet.rootKey), 'WhisperRatchet').then(function(masterKey) {
              let ephemeralPublicKey;
              if (sending) {
                  ephemeralPublicKey = ratchet.ephemeralKeyPair.pubKey;
              }
              else {
                  ephemeralPublicKey = remoteKey;
              }
              session[util.toString(ephemeralPublicKey)] = {
                  messageKeys: {},
                  chainKey: { counter: -1, key: masterKey[1] },
                  chainType: sending ? Internal.ChainType.SENDING : Internal.ChainType.RECEIVING,
              };
              ratchet.rootKey = masterKey[0];
          });
      });
  },
  getSessionVersion() {
    return Internal.SessionLock.queueJobForNumber(this.remoteAddress.toString(), function() {
      return this.getRecord(this.remoteAddress.toString()).then(function(record) {
          if (record === undefined) {
              return undefined;
          }
          const openSession = record.getOpenSession();
          if (openSession === undefined || openSession.indexInfo === undefined) {
              return null;
          }
          return openSession.indexInfo.baseKeyType;
      });
    }.bind(this));
  },
  getRemoteRegistrationId() {
    return Internal.SessionLock.queueJobForNumber(this.remoteAddress.toString(), function() {
      return this.getRecord(this.remoteAddress.toString()).then(function(record) {
          if (record === undefined) {
              return undefined;
          }
          const openSession = record.getOpenSession();
          if (openSession === undefined) {
              return null;
          }
          return openSession.registrationId;
      });
    }.bind(this));
  },
  hasOpenSession() {
    return Internal.SessionLock.queueJobForNumber(this.remoteAddress.toString(), function() {
      return this.getRecord(this.remoteAddress.toString()).then(function(record) {
          if (record === undefined) {
              return false;
          }
          return record.haveOpenSession();
      });
    }.bind(this));
  },
  closeOpenSessionForDevice() {
    const address = this.remoteAddress.toString();
    return Internal.SessionLock.queueJobForNumber(address, function() {
      return this.getRecord(address).then(function(record) {
        if (record === undefined || record.getOpenSession() === undefined) {
            return;
        }

        record.archiveCurrentState();
        return this.storage.storeSession(address, record.serialize());
      }.bind(this));
    }.bind(this));
  },
  deleteAllSessionsForDevice() {
    // Used in session reset scenarios, where we really need to delete
    const address = this.remoteAddress.toString();
    return Internal.SessionLock.queueJobForNumber(address, function() {
      return this.getRecord(address).then(function(record) {
        if (record === undefined) {
            return;
        }

        record.deleteAllSessions();
        return this.storage.storeSession(address, record.serialize());
      }.bind(this));
    }.bind(this));
  },
};

libsignal.SessionCipher = function(storage, remoteAddress) {
    const cipher = new SessionCipher(storage, remoteAddress);

    // returns a Promise that resolves to a ciphertext object
    this.encrypt = cipher.encrypt.bind(cipher);
    this.getRecord = cipher.getRecord.bind(cipher);

    // returns a Promise that inits a session if necessary and resolves
    // to a decrypted plaintext array buffer
    this.decryptPreKeyWhisperMessage = cipher.decryptPreKeyWhisperMessage.bind(cipher);

    // returns a Promise that resolves to decrypted plaintext array buffer
    this.decryptWhisperMessage = cipher.decryptWhisperMessage.bind(cipher);

    this.getRemoteRegistrationId = cipher.getRemoteRegistrationId.bind(cipher);
    this.hasOpenSession = cipher.hasOpenSession.bind(cipher);
    this.closeOpenSessionForDevice = cipher.closeOpenSessionForDevice.bind(cipher);
    this.deleteAllSessionsForDevice = cipher.deleteAllSessionsForDevice.bind(cipher);
};

function wrapWithPromise(fn) {
  return (...args) => Promise.resolve(fn(...args));
}
const externalCurve = {
  generateKeyPair: () => {
    const privKey = client.PrivateKey.generate();
    const pubKey = privKey.getPublicKey();

    return {
      privKey: privKey.serialize().buffer,
      pubKey: pubKey.serialize().buffer,
    };
  },
  createKeyPair: incomingKey => {
    const incomingKeyBuffer = Buffer.from(incomingKey);

    if (incomingKeyBuffer.length !== 32) {
      throw new Error('key must be 32 bytes long');
    }

    // eslint-disable-next-line no-bitwise
    incomingKeyBuffer[0] &= 248;
    // eslint-disable-next-line no-bitwise
    incomingKeyBuffer[31] &= 127;
    // eslint-disable-next-line no-bitwise
    incomingKeyBuffer[31] |= 64;

    const privKey = client.PrivateKey.deserialize(incomingKeyBuffer);
    const pubKey = privKey.getPublicKey();

    return {
      privKey: privKey.serialize().buffer,
      pubKey: pubKey.serialize().buffer,
    };
  },
  calculateAgreement: (pubKey, privKey) => {
    const pubKeyBuffer = Buffer.from(pubKey);
    const privKeyBuffer = Buffer.from(privKey);

    const pubKeyObj = client.PublicKey.deserialize(
      Buffer.concat([
        Buffer.from([0x05]),
        externalCurve.validatePubKeyFormat(pubKeyBuffer),
      ])
    );
    const privKeyObj = client.PrivateKey.deserialize(privKeyBuffer);
    const sharedSecret = privKeyObj.agree(pubKeyObj);
    return sharedSecret.buffer;
  },
  verifySignature: (pubKey, message, signature) => {
    const pubKeyBuffer = Buffer.from(pubKey);
    const messageBuffer = Buffer.from(message);
    const signatureBuffer = Buffer.from(signature);

    const pubKeyObj = client.PublicKey.deserialize(pubKeyBuffer);
    const result = !pubKeyObj.verify(messageBuffer, signatureBuffer);

    return result;
  },
  calculateSignature: (privKey, message) => {
    const privKeyBuffer = Buffer.from(privKey);
    const messageBuffer = Buffer.from(message);

    const privKeyObj = client.PrivateKey.deserialize(privKeyBuffer);
    const signature = privKeyObj.sign(messageBuffer);
    return signature.buffer;
  },
  validatePubKeyFormat: pubKey => {
    if (
      pubKey === undefined ||
      ((pubKey.byteLength !== 33 || new Uint8Array(pubKey)[0] !== 5) &&
        pubKey.byteLength !== 32)
    ) {
      throw new Error('Invalid public key');
    }
    if (pubKey.byteLength === 33) {
      return pubKey.slice(1);
    }

    return pubKey;
  },
};

externalCurve.ECDHE = externalCurve.calculateAgreement;
externalCurve.Ed25519Sign = externalCurve.calculateSignature;
externalCurve.Ed25519Verify = externalCurve.verifySignature;
const externalCurveAsync = {
  generateKeyPair: wrapWithPromise(externalCurve.generateKeyPair),
  createKeyPair: wrapWithPromise(externalCurve.createKeyPair),
  calculateAgreement: wrapWithPromise(externalCurve.calculateAgreement),
  verifySignature: async (...args) => {
    // The async verifySignature function has a different signature than the
    //   sync function
    const verifyFailed = externalCurve.verifySignature(...args);
    if (verifyFailed) {
      throw new Error('Invalid signature');
    }
  },
  calculateSignature: wrapWithPromise(externalCurve.calculateSignature),
  validatePubKeyFormat: wrapWithPromise(externalCurve.validatePubKeyFormat),
  ECDHE: wrapWithPromise(externalCurve.ECDHE),
  Ed25519Sign: wrapWithPromise(externalCurve.Ed25519Sign),
  Ed25519Verify: wrapWithPromise(externalCurve.Ed25519Verify),
};

Internal.Curve = externalCurve;
Internal.Curve.async = externalCurveAsync;
libsignal.Curve = externalCurve;
libsignal.Curve.async = externalCurveAsync;

libsignal.HKDF = {
  deriveSecrets: (input, salt, info) => {
    const hkdf = client.HKDF.new(3);
    const output = hkdf.deriveSecrets(
      3 * 32,
      Buffer.from(input),
      Buffer.from(info),
      Buffer.from(salt)
    );
    return [output.slice(0, 32), output.slice(32, 64), output.slice(64, 96)];
  },
};

export { libsignal };
