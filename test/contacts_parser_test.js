"use strict";
var assert = require("chai").assert;
var ByteBuffer = require("bytebuffer");
var protobuf = require("../src/protobufs.js");
var ContactDetails = protobuf.lookupType("signalservice.ContactDetails");
var GroupDetails = protobuf.lookupType("signalservice.GroupDetails");
var ContactBuffer = protobuf.ContactBuffer;
var GroupBuffer = protobuf.GroupBuffer;
var assertEqualArrayBuffers = require("./_test.js").assertEqualArrayBuffers;
var helpers = require("../src/helpers.js");

describe("ContactBuffer", function() {
  function getTestBuffer() {
    var buffer = new ByteBuffer();
    var avatarBuffer = new ByteBuffer();
    var avatarLen = 255;
    for (var i = 0; i < avatarLen; i += 1) {
      avatarBuffer.writeUint8(i);
    }
    avatarBuffer.limit = avatarBuffer.offset;
    avatarBuffer.offset = 0;
    var contactInfo = ContactDetails.create({
      name: "Zero Cool",
      number: "+10000000000",
      avatar: { contentType: "image/jpeg", length: avatarLen }
    });
    var contactInfoBuffer = ContactDetails.encode(contactInfo).finish();

    for (var i = 0; i < 3; i += 1) {
      buffer.writeVarint32(contactInfoBuffer.byteLength);
      buffer.append(contactInfoBuffer);
      buffer.append(avatarBuffer.clone());
    }

    buffer.limit = buffer.offset;
    buffer.offset = 0;
    return buffer.toArrayBuffer();
  }

  it("parses an array buffer of contacts", function() {
    var arrayBuffer = getTestBuffer();
    var contactBuffer = new ContactBuffer(arrayBuffer);
    var contact = contactBuffer.next();
    var count = 0;
    while (contact !== undefined) {
      count += 1;
      assert.strictEqual(contact.name, "Zero Cool");
      assert.strictEqual(contact.number, "+10000000000");
      assert.strictEqual(contact.avatar.contentType, "image/jpeg");
      assert.strictEqual(contact.avatar.length, 255);
      assert.strictEqual(contact.avatar.data.byteLength, 255);
      var avatarBytes = new Uint8Array(contact.avatar.data);
      for (var j = 0; j < 255; j += 1) {
        assert.strictEqual(avatarBytes[j], j);
      }
      contact = contactBuffer.next();
    }
    assert.strictEqual(count, 3);
  });
});

describe("GroupBuffer", function() {
  function getTestBuffer() {
    var buffer = new ByteBuffer();
    var avatarBuffer = new ByteBuffer();
    var avatarLen = 255;
    for (var i = 0; i < avatarLen; i += 1) {
      avatarBuffer.writeUint8(i);
    }
    avatarBuffer.limit = avatarBuffer.offset;
    avatarBuffer.offset = 0;
    var groupInfo = GroupDetails.create({
      id: new Uint8Array([1, 3, 3, 7]),
      name: "Hackers",
      members: ["cereal", "burn", "phreak", "joey"],
      avatar: { contentType: "image/jpeg", length: avatarLen }
    });
    var groupInfoBuffer = GroupDetails.encode(groupInfo).finish();

    for (var i = 0; i < 3; i += 1) {
      buffer.writeVarint32(groupInfoBuffer.byteLength);
      buffer.append(groupInfoBuffer);
      buffer.append(avatarBuffer.clone());
    }

    buffer.limit = buffer.offset;
    buffer.offset = 0;
    return buffer.toArrayBuffer();
  }

  it("parses an array buffer of groups", function() {
    var arrayBuffer = getTestBuffer();
    var groupBuffer = new GroupBuffer(arrayBuffer);
    var group = groupBuffer.next();
    var count = 0;
    while (group !== undefined) {
      count += 1;
      assert.strictEqual(group.name, "Hackers");
      assert.sameMembers(group.members, ["cereal", "burn", "phreak", "joey"]);
      assert.strictEqual(group.avatar.contentType, "image/jpeg");
      assert.strictEqual(group.avatar.length, 255);
      assert.strictEqual(group.avatar.data.byteLength, 255);
      assertEqualArrayBuffers(group.id, new Uint8Array([1, 3, 3, 7]).buffer);
      var avatarBytes = new Uint8Array(group.avatar.data);
      for (var j = 0; j < 255; j += 1) {
        assert.strictEqual(avatarBytes[j], j);
      }
      group = groupBuffer.next();
    }
    assert.strictEqual(count, 3);
  });
});
