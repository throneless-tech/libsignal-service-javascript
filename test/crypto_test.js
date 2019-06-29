var ByteBuffer = require("bytebuffer");
var crypto = require("../src/crypto.js");
var assert = require("assert");
var assertEqualArrayBuffers = require("./_test.js").assertEqualArrayBuffers;

describe("encrypting and decrypting profile data", function() {
  var NAME_PADDED_LENGTH = 26;
  describe("encrypting and decrypting profile names", function() {
    it("pads, encrypts, decrypts, and unpads a short string", function() {
      var name = "Alice";
      var buffer = ByteBuffer.wrap(name).toArrayBuffer();
      var key = crypto.getRandomBytes(32);

      return crypto.encryptProfileName(buffer, key).then(function(encrypted) {
        assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
        return crypto
          .decryptProfileName(encrypted, key)
          .then(function(decrypted) {
            assert.strictEqual(
              ByteBuffer.wrap(decrypted).toString("utf8"),
              "Alice"
            );
          });
      });
    });
    it("works for empty string", function() {
      var name = ByteBuffer.wrap("").toArrayBuffer();
      var key = crypto.getRandomBytes(32);

      return crypto
        .encryptProfileName(name.buffer, key)
        .then(function(encrypted) {
          assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
          return crypto
            .decryptProfileName(encrypted, key)
            .then(function(decrypted) {
              assert.strictEqual(decrypted.byteLength, 0);
              assert.strictEqual(
                ByteBuffer.wrap(decrypted).toString("utf8"),
                ""
              );
            });
        });
    });
  });
  describe("encrypting and decrypting profile avatars", function() {
    it("encrypts and decrypts", function() {
      var buffer = ByteBuffer.wrap("This is an avatar").toArrayBuffer();
      var key = crypto.getRandomBytes(32);

      return crypto.encryptProfile(buffer, key).then(function(encrypted) {
        assert(encrypted.byteLength === buffer.byteLength + 16 + 12);
        return crypto.decryptProfile(encrypted, key).then(function(decrypted) {
          assertEqualArrayBuffers(buffer, decrypted);
        });
      });
    });
    it("throws when decrypting with the wrong key", function() {
      var buffer = ByteBuffer.wrap("This is an avatar").toArrayBuffer();
      var key = crypto.getRandomBytes(32);
      var badKey = crypto.getRandomBytes(32);

      return crypto.encryptProfile(buffer, key).then(function(encrypted) {
        assert(encrypted.byteLength === buffer.byteLength + 16 + 12);
        return crypto.decryptProfile(encrypted, badKey).catch(function(error) {
          assert.strictEqual(error.name, "ProfileDecryptError");
        });
      });
    });
  });
});
