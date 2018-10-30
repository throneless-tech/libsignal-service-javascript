var libsignal = require("signal-protocol");
var helpers = require("../src/helpers.js");
var ByteBuffer = require("bytebuffer");
var LocalStorage = require("node-localstorage").LocalStorage;

var TIMESTAMP_THRESHOLD = 5 * 1000; // 5 seconds

var VerifiedStatus = {
  DEFAULT: 0,
  VERIFIED: 1,
  UNVERIFIED: 2
};

// create a random group id that we haven't seen before.
function generateNewGroupId() {
  var groupId = getString(libsignal.crypto.getRandomBytes(16));
  return storage.protocol.getGroup(groupId).then(function(group) {
    if (group === undefined) {
      return groupId;
    } else {
      console.warn("group id collision"); // probably a bad sign.
      return generateNewGroupId();
    }
  });
}
function validateVerifiedStatus(status) {
  if (
    status === VerifiedStatus.DEFAULT ||
    status === VerifiedStatus.VERIFIED ||
    status === VerifiedStatus.UNVERIFIED
  ) {
    return true;
  }
  return false;
}

var StaticByteBufferProto = new ByteBuffer().__proto__;
var StaticArrayBufferProto = new ArrayBuffer().__proto__;
var StaticUint8ArrayProto = new Uint8Array().__proto__;

function isStringable(thing) {
  return (
    thing === Object(thing) &&
    (thing.__proto__ == StaticArrayBufferProto ||
      thing.__proto__ == StaticUint8ArrayProto ||
      thing.__proto__ == StaticByteBufferProto)
  );
}
function convertToArrayBuffer(thing) {
  if (thing === undefined) {
    return undefined;
  }
  if (thing === Object(thing)) {
    if (thing.__proto__ == StaticArrayBufferProto) {
      return thing;
    }
    //TODO: Several more cases here...
  }

  if (thing instanceof Array) {
    // Assuming Uint16Array from curve25519
    var res = new ArrayBuffer(thing.length * 2);
    var uint = new Uint16Array(res);
    for (var i = 0; i < thing.length; i++) {
      uint[i] = thing[i];
    }
    return res;
  }

  var str;
  if (isStringable(thing)) {
    str = stringObject(thing);
  } else if (typeof thing == "string") {
    str = thing;
  } else {
    throw new Error(
      "Tried to convert a non-stringable thing of type " +
        typeof thing +
        " to an array buffer"
    );
  }
  var res = new ArrayBuffer(str.length);
  var uint = new Uint8Array(res);
  for (var i = 0; i < str.length; i++) {
    uint[i] = str.charCodeAt(i);
  }
  return res;
}

function equalArrayBuffers(ab1, ab2) {
  if (!(ab1 instanceof ArrayBuffer && ab2 instanceof ArrayBuffer)) {
    return false;
  }
  if (ab1.byteLength !== ab2.byteLength) {
    return false;
  }
  var result = 0;
  var ta1 = new Uint8Array(ab1);
  var ta2 = new Uint8Array(ab2);
  for (var i = 0; i < ab1.byteLength; ++i) {
    result = result | (ta1[i] ^ ta2[i]);
  }
  return result === 0;
}

function IdentityRecord(
  id,
  publicKey,
  firstUse,
  timestamp,
  verified,
  nonblockingApproval
) {
  this.id = id;
  this.publicKey = publicKey;
  this.firstUse = firstUse;
  this.timestamp = timestamp;
  this.verified = verified;
  this.nonblockingApproval;
}

IdentityRecord.prototype = {
  constructor: IdentityRecord
};

function Session(id, record, deviceId, number) {
  this.id = id;
  this.record = record;
  this.deviceId = deviceId;
  this.number = number;
}

Session.prototype = {
  constructor: Session
};

function SignalProtocolStore(path) {
  this.store = new LocalStorage(path);
}

SignalProtocolStore.prototype = {
  Direction: {
    SENDING: 1,
    RECEIVING: 2
  },

  getIdentityKeyPair: function() {
    var identityKey = this.get("identityKey");
    if (!(identityKey.pubKey instanceof ArrayBuffer)) {
      identityKey.pubKey = convertToArrayBuffer(identityKey.pubKey);
    }
    if (!(identityKey.privKey instanceof ArrayBuffer)) {
      identityKey.privKey = convertToArrayBuffer(identityKey.privKey);
    }
    return Promise.resolve(identityKey);
  },
  getLocalRegistrationId: function() {
    return Promise.resolve(this.get("registrationId"));
  },
  put: function(key, value) {
    if (value === undefined) throw new Error("Tried to store undefined");
    this.store.setItem("" + key, helpers.jsonThing(value));
    //localStorage.setItem("" + key, value);
  },

  get: function(key, defaultValue) {
    var value = this.store.getItem("" + key);
    if (value === null) return defaultValue;
    return JSON.parse(value);
    //return value;
  },

  remove: function(key) {
    this.store.removeItem("" + key);
  },
  clear: function() {
    this.store = {};
  },
  isTrustedIdentity: function(identifier, identityKey, direction) {
    if (identifier === null || identifier === undefined) {
      throw new Error("tried to check identity key for undefined/null key");
    }
    if (!(identityKey instanceof ArrayBuffer)) {
      throw new Error("Expected identityKey to be an ArrayBuffer");
    }
    var trusted = this.get("identityKey" + identifier);
    if (trusted === undefined) {
      return Promise.resolve(true);
    }
    return Promise.resolve(
      helpers.getString(identityKey) === helpers.getString(trusted.publicKey)
    );
  },
  loadIdentityKey: function(identifier) {
    if (identifier === null || identifier === undefined)
      throw new Error("Tried to get identity key for undefined/null key");
    var identityRecord = this.get("identityKey" + identifier, null);
    if (identityRecord !== null) {
      return Promise.resolve(identityRecord.publicKey);
    } else {
      return Promise.resolve(null);
    }
  },
  saveIdentity: function(identifier, identityKey, nonblockingApproval) {
    if (identifier === null || identifier === undefined)
      throw new Error("Tried to put identity key for undefined/null key");
    if (!(identityKey instanceof ArrayBuffer)) {
      identityKey = convertToArrayBuffer(identityKey);
    }
    if (typeof nonblockingApproval !== "boolean") {
      nonblockingApproval = false;
    }
    var number = helpers.unencodeNumber(identifier)[0];
    var identityRecord = new IdentityRecord({ id: number });

    var existing = this.get("identityKey" + identifier, null);
    if (existing === null) {
      console.debug("Saving new identity...");
      identityRecord.publicKey = identityKey;
      identityRecord.firstUse = true;
      identityRecord.timestamp = Date.now();
      identityRecord.verified = VerifiedStatus.DEFAULT;
      identityRecord.nonblockingApproval = nonblockingApproval;
      this.put("identityKey" + identifier, identityRecord);
      return Promise.resolve(false);
    } else if (!equalArrayBuffers(existing.publicKey, identityKey)) {
      console.debug("Replacing existing identity...");
      var verifiedStatus;
      if (
        existing.verifiedStatus === VerifiedStatus.VERIFIED ||
        existing.verifiedStatus === VerifiedStatus.UNVERIFIED
      ) {
        verifiedStatus = VerifiedStatus.UNVERIFIED;
      } else {
        verifiedStatus = VerifiedStatus.DEFAULT;
      }
      identityRecord.publicKey = identityKey;
      identityRecord.firstUse = false;
      identityRecord.timestamp = Date.now();
      identityRecord.verified = verifiedStatus;
      identityRecord.nonblockingApproval = nonblockingApproval;
      this.put("identityKey" + identifier, identityRecord);
      this.archiveSiblingSessions(identifier);
      return Promise.resolve(true);
    } else if (
      existing !== null &&
      this.isNonBlockingApprovalRequired(existing)
    ) {
      console.debug("Setting approval status...");
      existing.nonblockingApproval = true;
      this.put("identityKey" + identifier, existing);
      return Promise.resolve(true);
    } else {
      return Promise.resolve(false);
    }
  },
  isNonBlockingApprovalRequired: function(identityRecord) {
    return (
      !(
        identityRecord.firstUse === null ||
        identityRecord.firstUse === undefined
      ) &&
      Date.now() - identityRecord.timestamp < TIMESTAMP_THRESHOLD &&
      identityRecord.nonblockingApproval
    );
  },
  saveIdentityWithAttributes: function(identifier, attributes) {
    if (identifier === null || identifier === undefined) {
      throw new Error("Tried to put identity key for undefined/null key");
    }
    var number = helpers.unencodeNumber(identifier)[0];
    var identityRecord = new IdentityRecord({ id: number });
    Object.assign(identityRecord, attributes);
    this.put("identityKey" + identifier, identityRecord);
    return Promise.resolve();
  },
  /* Returns a prekeypair object or undefined */
  loadPreKey: function(keyId) {
    var res = this.get("25519KeypreKey" + keyId);
    if (res !== undefined) {
      if (!(res.pubKey instanceof ArrayBuffer)) {
        res.pubKey = convertToArrayBuffer(res.pubKey);
      }
      if (!(res.privKey instanceof ArrayBuffer)) {
        res.privKey = convertToArrayBuffer(res.privKey);
      }
      res = { pubKey: res.pubKey, privKey: res.privKey };
    }
    return Promise.resolve(res);
  },
  storePreKey: function(keyId, keyPair) {
    return Promise.resolve(this.put("25519KeypreKey" + keyId, keyPair));
  },
  removePreKey: function(keyId) {
    return Promise.resolve(this.remove("25519KeypreKey" + keyId));
  },
  clearPreKeyStore: function() {
    for (let id of Object.keys(this.store)) {
      if (id.startsWith("25519KeypreKey")) {
        this.remove(id);
      }
    }
    return Promise.resolve();
  },

  /* Returns a signed keypair object or undefined */
  loadSignedPreKey: function(keyId) {
    var res = this.get("25519KeysignedKey" + keyId);
    if (res !== undefined) {
      if (!(res.pubKey instanceof ArrayBuffer)) {
        res.pubKey = convertToArrayBuffer(res.pubKey);
      }
      if (!(res.privKey instanceof ArrayBuffer)) {
        res.privKey = convertToArrayBuffer(res.privKey);
      }
      res = { pubKey: res.pubKey, privKey: res.privKey };
    }
    return Promise.resolve(res);
  },
  loadSignedPreKeys: function() {
    var signedPreKeys = [];
    for (let id of Object.keys(this.store)) {
      if (id.startsWith("25519KeysignedKey")) {
        var prekey = this.get(id);
        if (!(prekey.pubKey instanceof ArrayBuffer)) {
          prekey.pubKey = convertToArrayBuffer(prekey.pubKey);
        }
        if (!(prekey.privKey instanceof ArrayBuffer)) {
          prekey.privKey = convertToArrayBuffer(prekey.privKey);
        }
        //signedPreKeys.push({
        //  pubkey:       prekey.pubkey,
        //  privkey:      prekey.privkey,
        //  created_at:   prekey.created_at,
        //  keyId:        prekey.id,
        //  confirmed:    prekey.confirmed
        //});
        signedPreKeys.push(prekey);
      }
    }
    return Promise.resolve(signedPreKeys);
  },
  storeSignedPreKey: function(keyId, keyPair) {
    return Promise.resolve(this.put("25519KeysignedKey" + keyId, keyPair));
  },
  removeSignedPreKey: function(keyId) {
    return Promise.resolve(this.remove("25519KeysignedKey" + keyId));
  },
  clearSignedPreKeysStore: function() {
    for (let id of Object.keys(this.store)) {
      if (id.startsWith("25519KeysignedKey")) {
        this.remove(id);
      }
    }
    return Promise.resolve();
  },
  getDeviceIds: function(number) {
    if (number === null || number === undefined) {
      throw new Error("Tried to get device ids for undefined/null number");
    }
    var collection = [];
    for (let id of Object.keys(this.store)) {
      if (id.startsWith("session" + number)) {
        collection.push(this.get(id).deviceId);
      }
    }
    return Promise.resolve(collection);
  },
  loadSession: function(identifier) {
    console.debug("Trying to get session for identifier: " + identifier);
    var session = this.get("session" + identifier, { record: undefined });
    return Promise.resolve(session.record);
  },
  storeSession: function(identifier, record) {
    var number = helpers.unencodeNumber(identifier)[0];
    var deviceId = parseInt(helpers.unencodeNumber(identifier)[1]);
    var session = new Session(identifier, record, deviceId, number);
    return Promise.resolve(this.put("session" + identifier, session));
  },
  removeSession: function(identifier) {
    return Promise.resolve(this.remove("session" + identifier));
  },
  removeAllSessions: function(identifier) {
    console.debug("Removing sessions starting with " + identifier);
    for (let id of Object.keys(this.store)) {
      if (id.startsWith("session" + identifier)) {
        this.remove(id);
      }
    }
    return Promise.resolve();
  },
  archiveSiblingSessions: function(identifier) {
    console.debug("archiveSiblingSessions identifier: " + identifier);
    var address = libsignal.SignalProtocolAddress.fromString(identifier);
    var ourDeviceId = address.getDeviceId();
    return this.getDeviceIds(address.getName()).then(function(deviceIds) {
      return Promise.all(
        deviceIds.map(function(deviceId) {
          if (deviceId !== ourDeviceId) {
            var sibling = new libsignal.SignalProtocolAddress(
              address.getName(),
              deviceId
            );
            console.debug("closing session for", sibling.toString());
            var sessionCipher = new libsignal.SessionCipher(
              storage.protocol,
              sibling
            );
            return sessionCipher.closeOpenSessionForDevice();
          } else {
            return;
          }
        })
      );
    });
  },
  clearSessionStore: function() {
    return Promise.resolve(this.removeAllSessions(""));
  },

  // Groups
  getGroup: function(groupId) {
    if (groupId === null || groupId === undefined) {
      throw new Error("Tried to get group for undefined/null id");
    }
    return Promise.resolve(this.get("group" + groupId));
  },
  putGroup: function(groupId, group) {
    if (groupId === null || groupId === undefined) {
      throw new Error("Tried to put group key for undefined/null id");
    }
    if (group === null || group === undefined) {
      throw new Error("Tried to put undefined/null group object");
    }
    return Promise.resolve(this.put("group" + groupId, group));
  },
  removeGroup: function(groupId) {
    if (groupId === null || groupId === undefined) {
      throw new Error("Tried to remove group key for undefined/null id");
    }
    return Promise.resolve(this.remove("group" + groupId));
  },

  // Not yet processed messages - for resiliency
  getAllUnprocessed: function() {
    var collection = [];
    for (let id of Object.keys(this.store)) {
      if (id.startsWith("unprocessed")) {
        collection.push(this.get(id));
      }
    }
    return Promise.resolve(collection);
  },
  addUnprocessed: function(data) {
    return Promise.resolve(this.put("unprocessed" + data.id, data));
  },
  updateUnprocessed: function(id, updates) {
    var unprocessed = this.get("unprocessed" + id, { id: id });
    Object.assign(unprocessed, updates);
    return Promise.resolve(this.put("unprocessed" + id, unprocessed));
  },
  removeUnprocessed: function(id) {
    return Promise.resolve(this.remove("unprocessed" + id));
  },
  // USER STORAGE
  userSetNumberAndDeviceId: function(number, deviceId, deviceName) {
    this.put("number_id", number + "." + deviceId);
    if (deviceName) {
      this.put("device_name", deviceName);
    }
  },
  userGetNumber: function(key, defaultValue) {
    var number_id = this.get("number_id");
    if (number_id === undefined) return undefined;
    return helpers.unencodeNumber(number_id)[0];
  },

  userGetDeviceId: function(key) {
    var number_id = this.get("number_id");
    if (number_id === undefined) return undefined;
    return helpers.unencodeNumber(number_id)[1];
  },

  userGetDeviceName: function(key) {
    return this.get("device_name");
  },
  // GROUP STORAGE
  groupsCreateNewGroup: function(numbers, groupId) {
    var groupId = groupId;
    return new Promise(function(resolve) {
      if (groupId !== undefined) {
        resolve(
          this.getGroup(groupId).then(function(group) {
            if (group !== undefined) {
              throw new Error("Tried to recreate group");
            }
          })
        );
      } else {
        resolve(
          generateNewGroupId().then(function(newGroupId) {
            groupId = newGroupId;
          })
        );
      }
    }).then(function() {
      var me = storage.user.getNumber();
      var haveMe = false;
      var finalNumbers = [];
      for (i of numbers) {
        var number = numbers[i];
        if (!helpers.isNumberSane(number))
          throw new Error("Invalid number in group");
        if (number == me) haveMe = true;
        if (finalNumbers.indexOf(number) < 0) finalNumbers.push(number);
      }

      if (!haveMe) finalNumbers.push(me);

      var groupObject = { numbers: finalNumbers, numberRegistrationIds: {} };
      for (i of finalNumbers)
        groupObject.numberRegistrationIds[finalNumbers[i]] = {};

      this.putGroup(groupId, groupObject).then(function() {
        return { id: groupId, numbers: finalNumbers };
      });
    });
  },

  groupsGetNumbers: function(groupId) {
    this.getGroup(groupId).then(function(group) {
      if (group === undefined) return undefined;

      return group.numbers;
    });
  },

  groupsRemoveNumber: function(groupId, number) {
    this.getGroup(groupId).then(function(group) {
      if (group === undefined) return undefined;

      var me = storage.user.getNumber();
      if (number == me)
        throw new Error(
          "Cannot remove ourselves from a group, leave the group instead"
        );

      var i = group.numbers.indexOf(number);
      if (i > -1) {
        group.numbers.splice(i, 1);
        delete group.numberRegistrationIds[number];
        this.putGroup(groupId, group).then(function() {
          return group.numbers;
        });
      }

      return group.numbers;
    });
  },

  groupsAddNumbers: function(groupId, numbers) {
    this.getGroup(groupId).then(function(group) {
      if (group === undefined) return undefined;

      for (i of numbers) {
        var number = numbers[i];
        if (!helpers.isNumberSane(number))
          throw new Error("Invalid number in set to add to group");
        if (group.numbers.indexOf(number) < 0) {
          group.numbers.push(number);
          group.numberRegistrationIds[number] = {};
        }
      }

      this.putGroup(groupId, group).then(function() {
        return group.numbers;
      });
    });
  },

  groupsDeleteGroup: function(groupId) {
    return this.removeGroup(groupId);
  },

  groupsGetGroup: function(groupId) {
    this.getGroup(groupId).then(function(group) {
      if (group === undefined) return undefined;

      return { id: groupId, numbers: group.numbers };
    });
  },

  groupsUpdateNumbers: function(groupId, numbers) {
    this.getGroup(groupId).then(function(group) {
      if (group === undefined)
        throw new Error("Tried to update numbers for unknown group");

      if (numbers.filter(helpers.isNumberSane).length < numbers.length)
        throw new Error("Invalid number in new group members");

      var added = numbers.filter(function(number) {
        return group.numbers.indexOf(number) < 0;
      });

      return this.groupsAddNumbers(groupId, added);
    });
  }
};

exports = module.exports = SignalProtocolStore;
