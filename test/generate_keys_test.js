"use strict";

var api = require("../src/index.js");
var storage = require("./InMemorySignalProtocolStore.js");
var protocolStore = new api.ProtocolStore(new storage());
var USERNAME = "+15555555";
var PASSWORD = "password";
var assert = require("chai").assert;
var assertEqualArrayBuffers = require("./_test.js").assertEqualArrayBuffers;

describe("Key generation", function thisNeeded() {
  var count = 10;
  this.timeout(count * 2000);

  function validateStoredKeyPair(keyPair) {
    /* Ensure the keypair matches the format used internally by libsignal-protocol */
    assert.isObject(keyPair, "Stored keyPair is not an object");
    assert.instanceOf(keyPair.pubKey, ArrayBuffer);
    assert.instanceOf(keyPair.privKey, ArrayBuffer);
    assert.strictEqual(keyPair.pubKey.byteLength, 33);
    assert.strictEqual(new Uint8Array(keyPair.pubKey)[0], 5);
    assert.strictEqual(keyPair.privKey.byteLength, 32);
  }
  function itStoresPreKey(keyId) {
    it("prekey " + keyId + " is valid", function() {
      return protocolStore.loadPreKey(keyId).then(function(keyPair) {
        validateStoredKeyPair(keyPair);
      });
    });
  }
  function itStoresSignedPreKey(keyId) {
    it("signed prekey " + keyId + " is valid", function() {
      return protocolStore.loadSignedPreKey(keyId).then(function(keyPair) {
        validateStoredKeyPair(keyPair);
      });
    });
  }
  function validateResultKey(resultKey) {
    return protocolStore.loadPreKey(resultKey.keyId).then(function(keyPair) {
      assertEqualArrayBuffers(resultKey.publicKey, keyPair.pubKey);
    });
  }
  function validateResultSignedKey(resultSignedKey) {
    return protocolStore
      .loadSignedPreKey(resultSignedKey.keyId)
      .then(function(keyPair) {
        assertEqualArrayBuffers(resultSignedKey.publicKey, keyPair.pubKey);
      });
  }

  before(done => {
    protocolStore
      .removeAllData()
      .then(() => api.KeyHelper.generateIdentityKeyPair())
      .then(keyPair => protocolStore.setIdentityKeyPair(keyPair))
      .then(() => done());
  });

  describe("the first time", function() {
    var result;
    /* result should have this format
     * {
     *   preKeys: [ { keyId, publicKey }, ... ],
     *   signedPreKey: { keyId, publicKey, signature },
     *   identityKey: <ArrayBuffer>
     * }
     */
    before(function() {
      var accountManager = new api.AccountManager(
        USERNAME,
        PASSWORD,
        protocolStore
      );
      return accountManager.generateKeys(count).then(function(res) {
        result = res;
      });
    });
    for (var i = 1; i <= count; i += 1) {
      itStoresPreKey(i);
    }
    itStoresSignedPreKey(1);

    it("result contains " + count + " preKeys", function() {
      assert.isArray(result.preKeys);
      assert.lengthOf(result.preKeys, count);
      for (var i = 0; i < count; i += 1) {
        assert.isObject(result.preKeys[i]);
      }
    });
    it("result contains the correct keyIds", function() {
      for (var i = 0; i < count; i += 1) {
        assert.strictEqual(result.preKeys[i].keyId, i + 1);
      }
    });
    it("result contains the correct public keys", function() {
      return Promise.all(result.preKeys.map(validateResultKey));
    });
    it("returns a signed prekey", function() {
      assert.strictEqual(result.signedPreKey.keyId, 1);
      assert.instanceOf(result.signedPreKey.signature, ArrayBuffer);
      return validateResultSignedKey(result.signedPreKey);
    });
  });
  describe("the second time", function() {
    var result;
    before(function() {
      var accountManager = new api.AccountManager(
        USERNAME,
        PASSWORD,
        protocolStore
      );
      return accountManager.generateKeys(count).then(function(res) {
        result = res;
      });
    });
    for (var i = 1; i <= 2 * count; i += 1) {
      itStoresPreKey(i);
    }
    itStoresSignedPreKey(1);
    itStoresSignedPreKey(2);
    it("result contains " + count + " preKeys", function() {
      assert.isArray(result.preKeys);
      assert.lengthOf(result.preKeys, count);
      for (var i = 0; i < count; i += 1) {
        assert.isObject(result.preKeys[i]);
      }
    });
    it("result contains the correct keyIds", function() {
      for (var i = 1; i <= count; i += 1) {
        assert.strictEqual(result.preKeys[i - 1].keyId, i + count);
      }
    });
    it("result contains the correct public keys", function() {
      return Promise.all(result.preKeys.map(validateResultKey));
    });
    it("returns a signed prekey", function() {
      assert.strictEqual(result.signedPreKey.keyId, 2);
      assert.instanceOf(result.signedPreKey.signature, ArrayBuffer);
      return validateResultSignedKey(result.signedPreKey);
    });
  });
  describe("the third time", function() {
    var result;
    before(function() {
      var accountManager = new api.AccountManager(
        USERNAME,
        PASSWORD,
        protocolStore
      );
      return accountManager.generateKeys(count).then(function(res) {
        result = res;
      });
    });
    for (var i = 1; i <= 3 * count; i += 1) {
      itStoresPreKey(i);
    }
    itStoresSignedPreKey(2);
    itStoresSignedPreKey(3);
    it("result contains " + count + " preKeys", function() {
      assert.isArray(result.preKeys);
      assert.lengthOf(result.preKeys, count);
      for (var i = 0; i < count; i += 1) {
        assert.isObject(result.preKeys[i]);
      }
    });
    it("result contains the correct keyIds", function() {
      for (var i = 1; i <= count; i += 1) {
        assert.strictEqual(result.preKeys[i - 1].keyId, i + 2 * count);
      }
    });
    it("result contains the correct public keys", function() {
      return Promise.all(result.preKeys.map(validateResultKey));
    });
    it("result contains a signed prekey", function() {
      assert.strictEqual(result.signedPreKey.keyId, 3);
      assert.instanceOf(result.signedPreKey.signature, ArrayBuffer);
      return validateResultSignedKey(result.signedPreKey);
    });
  });
});
