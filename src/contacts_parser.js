/*
 * vim: ts=2:sw=2:expandtab
 */

const ByteBuffer = require("bytebuffer");
const protobuf = require("./protobufs.js");
const ContactDetails = protobuf.lookupType("signalservice.ContactDetails");
const GroupDetails = protobuf.lookupType("signalservice.GroupDetails");

class ProtoParser {
  constructor(arrayBuffer, protobuf) {
    this.protobuf = protobuf;
    this.buffer = new ByteBuffer();
    this.buffer.append(arrayBuffer);
    this.buffer.offset = 0;
    this.buffer.limit = arrayBuffer.byteLength;
  }
  next() {
    try {
      if (this.buffer.limit === this.buffer.offset) {
        return undefined; // eof
      }
      const len = this.buffer.readVarint32();
      const nextBuffer = this.buffer
        .slice(this.buffer.offset, this.buffer.offset + len)
        .toArrayBuffer();
      // TODO: de-dupe ByteBuffer.js includes in libaxo/libts
      // then remove this toArrayBuffer call.

      const proto = this.protobuf.decode(new Uint8Array(nextBuffer));
      this.buffer.skip(len);

      if (proto.avatar) {
        const attachmentLen = proto.avatar.length;
        proto.avatar.data = this.buffer
          .slice(this.buffer.offset, this.buffer.offset + attachmentLen)
          .toArrayBuffer();
        this.buffer.skip(attachmentLen);
      }

      //if (proto.profileKey) {
      //proto.profileKey = proto.profileKey.toArrayBuffer();
      //}

      return proto;
    } catch (error) {
      console.error(
        "ProtoParser.next error:",
        error && error.stack ? error.stack : error
      );
    }

    return null;
  }
}

class GroupBuffer extends ProtoParser {
  constructor(arrayBuffer) {
    super(arrayBuffer, GroupDetails);
  }
}

class ContactBuffer extends ProtoParser {
  constructor(arrayBuffer) {
    super(arrayBuffer, ContactDetails);
  }
}

module.exports.GroupBuffer = GroupBuffer;
module.exports.ContactBuffer = ContactBuffer;
