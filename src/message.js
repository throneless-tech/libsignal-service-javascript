const protobuf = require("./protobufs.js");
const DataMessage = protobuf.lookupType("signalservice.DataMessage");
const GroupContext = protobuf.lookupType("signalservice.DataMessage");

/* eslint-disable more/no-then, no-bitwise */

function stringToArrayBuffer(str) {
  if (typeof str !== "string") {
    throw new Error("Passed non-string to stringToArrayBuffer");
  }
  const res = new ArrayBuffer(str.length);
  const uint = new Uint8Array(res);
  for (let i = 0; i < str.length; i += 1) {
    uint[i] = str.charCodeAt(i);
  }
  return res;
}

class Message {
  constructor(options) {
    this.body = options.body;
    this.attachments = options.attachments || [];
    this.quote = options.quote;
    this.group = options.group;
    this.flags = options.flags;
    this.recipients = options.recipients;
    this.timestamp = options.timestamp;
    this.needsSync = options.needsSync;
    this.expireTimer = options.expireTimer;
    this.profileKey = options.profileKey;

    if (!(this.recipients instanceof Array) || this.recipients.length < 1) {
      throw new Error("Invalid recipient list");
    }

    if (!this.group && this.recipients.length > 1) {
      throw new Error("Invalid recipient list for non-group");
    }

    if (typeof this.timestamp !== "number") {
      throw new Error("Invalid timestamp");
    }

    if (this.expireTimer !== undefined && this.expireTimer !== null) {
      if (typeof this.expireTimer !== "number" || !(this.expireTimer >= 0)) {
        throw new Error("Invalid expireTimer");
      }
    }

    if (this.attachments) {
      if (!(this.attachments instanceof Array)) {
        throw new Error("Invalid message attachments");
      }
    }
    if (this.flags !== undefined) {
      if (typeof this.flags !== "number") {
        throw new Error("Invalid message flags");
      }
    }
    if (this.isEndSession()) {
      if (
        this.body !== null ||
        this.group !== null ||
        this.attachments.length !== 0
      ) {
        throw new Error("Invalid end session message");
      }
    } else {
      if (
        typeof this.timestamp !== "number" ||
        (this.body && typeof this.body !== "string")
      ) {
        throw new Error("Invalid message body");
      }
      if (this.group) {
        if (
          typeof this.group.id !== "string" ||
          typeof this.group.type !== "number"
        ) {
          throw new Error("Invalid group context");
        }
      }
    }
  }

  isEndSession() {
    return this.flags & DataMessage.Flags.END_SESSION;
  }

  toProto() {
    if (this.dataMessage instanceof DataMessage) {
      return this.dataMessage;
    }
    const proto = new DataMessage();
    if (this.body) {
      proto.body = this.body;
    }
    proto.attachments = this.attachmentPointers;
    if (this.flags) {
      proto.flags = this.flags;
    }
    if (this.group) {
      proto.group = new GroupContext();
      proto.group.id = stringToArrayBuffer(this.group.id);
      proto.group.type = this.group.type;
    }
    if (this.quote) {
      const { QuotedAttachment } = DataMessage.Quote;
      const { Quote } = DataMessage;

      proto.quote = new Quote();
      const { quote } = proto;

      quote.id = this.quote.id;
      quote.author = this.quote.author;
      quote.text = this.quote.text;
      quote.attachments = (this.quote.attachments || []).map(attachment => {
        const quotedAttachment = new QuotedAttachment();

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
    return this.toProto().toArrayBuffer();
  }
}

exports = module.exports = Message;
