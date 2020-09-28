/*
 * vim: ts=2:sw=2:expandtab
 */



const debug = require('debug')('libsignal-service:protobuf');
const ByteBuffer = require('bytebuffer');
const protobufjs = require('protobufjs');
const path = require('path');
const helpers = require('./helpers.js');

const protobuf = protobufjs.loadSync([
  path.join(__dirname, '..', 'protos', 'SubProtocol.proto'),
  path.join(__dirname, '..', 'protos', 'DeviceMessages.proto'),
  path.join(__dirname, '..', 'protos', 'SignalService.proto'),
  path.join(__dirname, '..', 'protos', 'Stickers.proto'),
  path.join(__dirname, '..', 'protos', 'DeviceName.proto'),
  path.join(__dirname, '..', 'protos', 'UnidentifiedDelivery.proto'),
]).root;

// Add contacts_parser.js extended types
const ContactDetails = protobuf.lookupType('signalservice.ContactDetails');
const GroupDetails = protobuf.lookupType('signalservice.GroupDetails');

class ProtoParser {
  constructor(arrayBuffer, proto) {
    this.protobuf = proto;
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

      // if (proto.profileKey) {
      // proto.profileKey = proto.profileKey.toArrayBuffer();
      // }

      if (proto.uuid) {
        helpers.normalizeUuids(
          proto,
          ['uuid'],
          'ProtoParser::next (proto.uuid)'
        );
      }

      if (proto.members) {
        helpers.normalizeUuids(
          proto,
          proto.members.map((_member, i) => `members.${i}.uuid`),
          'ProtoParser::next (proto.members)'
        );
      }

      return proto;
    } catch (error) {
      debug(
        'ProtoParser.next error:',
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

exports = module.exports = protobuf;

module.exports.GroupBuffer = GroupBuffer;
module.exports.ContactBuffer = ContactBuffer;
