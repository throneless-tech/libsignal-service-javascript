"use strict";
var assert = require("assert");
var ProtocolStore = require("./InMemorySignalProtocolStore.js");
var protocolStore = new ProtocolStore();
var api = require("../src/index.js");
var libsignal = require("signal-protocol");

describe("Protocol Wrapper", function() {
  var identifier = "+5558675309";
  var another_identifier = "+5555590210";
  var prekeys, identityKey, testKey;
  this.timeout(5000);
  before(function(done) {
    //localStorage.clear();
    api.KeyHelper.generateIdentityKeyPair()
      .then(function(identityKey) {
        return protocolStore.saveIdentity(identifier, identityKey.pubKey);
      })
      .then(function() {
        done();
      });
  });
  describe("processPreKey", function() {
    it("rejects if the identity key changes", function() {
      var address = new libsignal.SignalProtocolAddress(identifier, 1);
      var builder = new libsignal.SessionBuilder(protocolStore, address);
      return builder
        .processPreKey({
          identityKey: api.KeyHelper.getRandomBytes(33),
          encodedNumber: address.toString()
        })
        .then(function() {
          throw new Error("Allowed to overwrite identity key");
        })
        .catch(function(e) {
          assert.strictEqual(e.message, "Identity key changed");
        });
    });
  });
});
