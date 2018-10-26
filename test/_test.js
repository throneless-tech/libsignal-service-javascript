/*
 * global helpers for tests
 */
var assert = require("assert");

module.exports.assertEqualArrayBuffers = function(ab1, ab2) {
  assert.deepStrictEqual(new Uint8Array(ab1), new Uint8Array(ab2));
};

module.exports.hexToArrayBuffer = function(str) {
  var ret = new ArrayBuffer(str.length / 2);
  var array = new Uint8Array(ret);
  for (var i = 0; i < str.length / 2; i++)
    array[i] = parseInt(str.substr(i * 2, 2), 16);
  return ret;
};

var KeyHelper = require("../src/index.js").KeyHelper;

module.exports.generateIdentity = function(store) {
  return Promise.all([
    KeyHelper.generateIdentityKeyPair(),
    KeyHelper.generateRegistrationId()
  ]).then(function(result) {
    store.put("identityKey", result[0]);
    store.put("registrationId", result[1]);
  });
};

module.exports.generatePreKeyBundle = function(
  store,
  preKeyId,
  signedPreKeyId
) {
  return Promise.all([
    store.getIdentityKeyPair(),
    store.getLocalRegistrationId()
  ]).then(function(result) {
    var identity = result[0];
    var registrationId = result[1];

    return Promise.all([
      KeyHelper.generatePreKey(preKeyId),
      KeyHelper.generateSignedPreKey(identity, signedPreKeyId)
    ]).then(function(keys) {
      var preKey = keys[0];
      var signedPreKey = keys[1];

      store.storePreKey(preKeyId, preKey.keyPair);
      store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);

      return {
        identityKey: identity.pubKey,
        registrationId: registrationId,
        preKey: {
          keyId: preKeyId,
          publicKey: preKey.keyPair.pubKey
        },
        signedPreKey: {
          keyId: signedPreKeyId,
          publicKey: signedPreKey.keyPair.pubKey,
          signature: signedPreKey.signature
        }
      };
    });
  });
};
