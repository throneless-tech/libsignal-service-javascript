var ByteBuffer = require("bytebuffer");
var crypto = require("../src/crypto.js");
var assert = require("assert");
var assertEqualArrayBuffers = require("./_test.js").assertEqualArrayBuffers;

describe("encrypting and decrypting profile data", function() {
  var NAME_PADDED_LENGTH = 53;
  describe("encrypting and decrypting profile names", function() {
    it("pads, encrypts, decrypts, and unpads a short string", function() {
      var name = "Alice";
      var buffer = ByteBuffer.wrap(name).toArrayBuffer();
      var key = crypto.getRandomBytes(32);

      return crypto.encryptProfileName(buffer, key).then(encrypted => {
        assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
        return crypto
          .decryptProfileName(encrypted, key)
          .then(({ given, family }) => {
            assert.strictEqual(family, null);
            assert.strictEqual(
              ByteBuffer.wrap(given).toString("utf8"),
              "Alice"
            );
          });
      });
    });
    it("handles a given name of the max, 53 characters", () => {
      const name = "01234567890123456789012345678901234567890123456789123";
      const buffer = ByteBuffer.wrap(name).toArrayBuffer();
      const key = crypto.getRandomBytes(32);

      return crypto.encryptProfileName(buffer, key).then(encrypted => {
        assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
        return crypto
          .decryptProfileName(encrypted, key)
          .then(({ given, family }) => {
            assert.strictEqual(ByteBuffer.wrap(given).toString("utf8"), name);
            assert.strictEqual(family, null);
          });
      });
    });
    it("handles family/given name of the max, 53 characters", () => {
      const name = "01234567890123456789\u000001234567890123456789012345678912";
      const buffer = ByteBuffer.wrap(name).toArrayBuffer();
      const key = crypto.getRandomBytes(32);

      return crypto.encryptProfileName(buffer, key).then(encrypted => {
        assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
        return crypto
          .decryptProfileName(encrypted, key)
          .then(({ given, family }) => {
            assert.strictEqual(
              ByteBuffer.wrap(given).toString("utf8"),
              "01234567890123456789"
            );
            assert.strictEqual(
              ByteBuffer.wrap(family).toString("utf8"),
              "01234567890123456789012345678912"
            );
          });
      });
    });
    it("handles a string with family/given name", () => {
      const name = "Alice\0Jones";
      const buffer = ByteBuffer.wrap(name).toArrayBuffer();
      const key = crypto.getRandomBytes(32);

      return crypto.encryptProfileName(buffer, key).then(encrypted => {
        assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
        return crypto
          .decryptProfileName(encrypted, key)
          .then(({ given, family }) => {
            assert.strictEqual(
              ByteBuffer.wrap(given).toString("utf8"),
              "Alice"
            );
            assert.strictEqual(
              ByteBuffer.wrap(family).toString("utf8"),
              "Jones"
            );
          });
      });
    });

    it("works for empty string", function() {
      var name = ByteBuffer.wrap("").toArrayBuffer();
      var key = crypto.getRandomBytes(32);

      return crypto.encryptProfileName(name.buffer, key).then(encrypted => {
        assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
        return crypto
          .decryptProfileName(encrypted, key)
          .then(({ given, family }) => {
            assert.strictEqual(family, null);
            assert.strictEqual(given.byteLength, 0);
            assert.strictEqual(ByteBuffer.wrap(given).toString("utf8"), "");
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
