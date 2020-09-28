/*
 * vim: ts=2:sw=2:expandtab
 */



const helpers = require('./helpers.js');
const protobuf = require('./protobufs.js');

const DataMessage = protobuf.lookupType('signalservice.DataMessage');
const DataMessageQuote = protobuf.lookupType('signalservice.DataMessage.Quote');
const DataMessageSticker = protobuf.lookupType(
  'signalservice.DataMessage.Sticker'
);
const DataMessagePreview = protobuf.lookupType(
  'signalservice.DataMessage.Preview'
);
const GroupContext = protobuf.lookupType('signalservice.GroupContext');

/* eslint-disable more/no-then, no-bitwise */

class Message {
  constructor(options) {
    this.attachments = options.attachments || [];
    this.body = options.body;
    this.expireTimer = options.expireTimer;
    this.flags = options.flags;
    this.group = options.group;
    this.needsSync = options.needsSync;
    this.preview = options.preview;
    this.profileKey = options.profileKey;
    this.quote = options.quote;
    this.recipients = options.recipients;
    this.sticker = options.sticker;
    this.reaction = options.reaction;
    this.timestamp = options.timestamp;

    if (!(this.recipients instanceof Array)) {
      throw new Error('Invalid recipient list');
    }

    if (!this.group && this.recipients.length !== 1) {
      throw new Error('Invalid recipient list for non-group');
    }

    if (typeof this.timestamp !== 'number') {
      throw new Error('Invalid timestamp');
    }

    if (this.expireTimer !== undefined && this.expireTimer !== null) {
      if (typeof this.expireTimer !== 'number' || !(this.expireTimer >= 0)) {
        throw new Error('Invalid expireTimer');
      }
    }

    if (this.attachments) {
      if (!(this.attachments instanceof Array)) {
        throw new Error('Invalid message attachments');
      }
    }
    if (this.flags !== undefined) {
      if (typeof this.flags !== 'number') {
        throw new Error('Invalid message flags');
      }
    }
    if (this.isEndSession()) {
      if (
        this.body !== null
        || this.group !== null
        || this.attachments.length !== 0
      ) {
        throw new Error('Invalid end session message');
      }
    } else {
      if (
        typeof this.timestamp !== 'number'
        || (this.body && typeof this.body !== 'string')
      ) {
        throw new Error('Invalid message body');
      }
      if (this.group) {
        if (
          typeof this.group.id !== 'string'
          || typeof this.group.type !== 'number'
        ) {
          throw new Error('Invalid group context');
        }
      }
    }
  }

  isEndSession() {
    return this.flags & DataMessage.Flags.END_SESSION;
  }

  toProto() {
    if (
      this.dataMessage !== undefined
      && this.dataMessage.$type === DataMessage
    ) {
      return this.dataMessage;
    }
    const proto = DataMessage.create({});

    proto.timestamp = this.timestamp;
    proto.attachments = this.attachmentPointers;

    if (this.body) {
      proto.body = this.body;
    }
    if (this.flags) {
      proto.flags = this.flags;
    }
    if (this.group) {
      proto.group = GroupContext.create();
      proto.group.id = new Uint8Array(helpers.stringToArrayBuffer(this.group.id));
      proto.group.type = this.group.type;
    }
    if (this.sticker) {
      proto.sticker = DataMessageSticker.create();
      proto.sticker.packId = new Uint8Array(
        helpers.hexStringToArrayBuffer(this.sticker.packId)
      );
      proto.sticker.packKey = new Uint8Array(
        helpers.base64ToArrayBuffer(this.sticker.packKey)
      );
      proto.sticker.stickerId = this.sticker.stickerId;

      if (this.sticker.attachmentPointer) {
        proto.sticker.data = this.sticker.attachmentPointer;
      }

      if (this.reaction) {
        proto.reaction = this.reaction;
      }
    }
    if (Array.isArray(this.preview)) {
      proto.preview = this.preview.map(preview => {
        const item = DataMessagePreview.create();
        item.title = preview.title;
        item.url = preview.url;
        item.image = preview.image || null;
        return item;
      });
    }
    if (this.quote) {
      const { QuotedAttachment } = DataMessageQuote;
      const { Quote } = DataMessage;

      proto.quote = Quote.create();
      const { quote } = proto;

      quote.id = this.quote.id;
      quote.author = this.quote.author;
      quote.text = this.quote.text;
      quote.attachments = (this.quote.attachments || []).map(attachment => {
        const quotedAttachment = QuotedAttachment.create();

        quotedAttachment.contentType = attachment.contentType;
        quotedAttachment.fileName = attachment.fileName;
        if (attachment.attachmentPointer) {
          quotedAttachment.thumbnail = attachment.attachmentPointer;
        }

        return quotedAttachment;
      });
    }
    if (this.expireTimer) {
      proto.expireTimer = this.expireTimer;
    }

    if (this.profileKey) {
      proto.profileKey = this.profileKey;
    }

    this.dataMessage = proto;
    return proto;
  }

  toArrayBuffer() {
    return DataMessage.encode(this.toProto()).finish();
  }
}

exports = module.exports = Message;
