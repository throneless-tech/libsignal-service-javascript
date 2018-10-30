/*
 * vim: ts=2:sw=2:expandtab
 */
var libsignal = require("@throneless/libsignal-protocol");
var crypto = require("./crypto.js");
var errors = require("./errors.js");
var OutgoingMessage = require("./outgoing_message.js");
var createTaskWithTimeout = require("./task_with_timeout.js");
var Message = require("./message.js");
var protobuf = require("./protobufs.js");
var AttachmentPointer = protobuf.lookupType("signalservice.AttachmentPointer");
var Content = protobuf.lookupType("signalservice.Content");
var DataMessage = protobuf.lookupType("signalservice.DataMessage");
var GroupContext = protobuf.lookupType("signalservice.GroupContext");
var NullMessage = protobuf.lookupType("signalservice.NullMessage");
var ReceiptMessage = protobuf.lookupType("signalservice.ReceiptMessage");
var SyncMessageRequest = protobuf.lookupType(
  "signalservice.SyncMessage.Request"
);
var SyncMessageSent = protobuf.lookupType("signalservice.SyncMessage.Sent");
var Verified = protobuf.lookupType("signalservice.Verified");
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

class MessageSender {
  constructor(username, password, store) {
    this.server = this.constructor.WebAPI.connect({ username, password });
    this.pendingMessages = {};
    this.store = store;
  }

  //  makeAttachmentPointer :: Attachment -> Promise AttachmentPointerProto
  makeAttachmentPointer(attachment) {
    if (typeof attachment !== "object" || attachment == null) {
      return Promise.resolve(undefined);
    }

    if (
      !(attachment.data instanceof ArrayBuffer) &&
      !ArrayBuffer.isView(attachment.data)
    ) {
      return Promise.reject(
        new TypeError(
          `\`attachment.data\` must be an \`ArrayBuffer\` or \`ArrayBufferView\`; got: ${typeof attachment.data}`
        )
      );
    }

    const proto = new AttachmentPointer();
    proto.key = libsignal.crypto.getRandomBytes(64);

    const iv = libsignal.crypto.getRandomBytes(16);
    return crypto
      .encryptAttachment(attachment.data, proto.key, iv)
      .then(result =>
        this.server.putAttachment(result.ciphertext).then(id => {
          proto.id = id;
          proto.contentType = attachment.contentType;
          proto.digest = result.digest;
          if (attachment.fileName) {
            proto.fileName = attachment.fileName;
          }
          if (attachment.size) {
            proto.size = attachment.size;
          }
          if (attachment.flags) {
            proto.flags = attachment.flags;
          }
          return proto;
        })
      );
  }

  retransmitMessage(number, jsonData, timestamp) {
    const outgoing = new OutgoingMessage(this.server);
    return outgoing.transmitMessage(number, jsonData, timestamp);
  }

  validateRetryContentMessage(content) {
    // We want at least one field set, but not more than one
    let count = 0;
    count += content.syncMessage ? 1 : 0;
    count += content.dataMessage ? 1 : 0;
    count += content.callMessage ? 1 : 0;
    count += content.nullMessage ? 1 : 0;
    if (count !== 1) {
      return false;
    }

    // It's most likely that dataMessage will be populated, so we look at it in detail
    const data = content.dataMessage;
    if (
      data &&
      !data.attachments.length &&
      !data.body &&
      !data.expireTimer &&
      !data.flags &&
      !data.group
    ) {
      return false;
    }

    return true;
  }

  getRetryProto(message, timestamp) {
    // If message was sent before v0.41.3 was released on Aug 7, then it was most
    //   certainly a DataMessage
    //
    // var d = new Date('2017-08-07T07:00:00.000Z');
    // d.getTime();
    const august7 = 1502089200000;
    if (timestamp < august7) {
      return DataMessage.decode(message);
    }

    // This is ugly. But we don't know what kind of proto we need to decode...
    try {
      // Simply decoding as a Content message may throw
      const proto = Content.decode(message);

      // But it might also result in an invalid object, so we try to detect that
      if (this.validateRetryContentMessage(proto)) {
        return proto;
      }

      return DataMessage.decode(message);
    } catch (e) {
      // If this call throws, something has really gone wrong, we'll fail to send
      return DataMessage.decode(message);
    }
  }

  tryMessageAgain(number, encodedMessage, timestamp) {
    const proto = this.getRetryProto(encodedMessage, timestamp);
    return this.sendIndividualProto(number, proto, timestamp);
  }

  queueJobForNumber(number, runJob) {
    const taskWithTimeout = createTaskWithTimeout(
      runJob,
      `queueJobForNumber ${number}`
    );

    const runPrevious = this.pendingMessages[number] || Promise.resolve();
    this.pendingMessages[number] = runPrevious.then(
      taskWithTimeout,
      taskWithTimeout
    );

    const runCurrent = this.pendingMessages[number];
    runCurrent.then(() => {
      if (this.pendingMessages[number] === runCurrent) {
        delete this.pendingMessages[number];
      }
    });
  }

  uploadAttachments(message) {
    return Promise.all(
      message.attachments.map(this.makeAttachmentPointer.bind(this))
    )
      .then(attachmentPointers => {
        // eslint-disable-next-line no-param-reassign
        message.attachmentPointers = attachmentPointers;
      })
      .catch(error => {
        if (error instanceof Error && error.name === "HTTPError") {
          throw new errors.MessageError(message, error);
        } else {
          throw error;
        }
      });
  }

  uploadThumbnails(message) {
    const makePointer = this.makeAttachmentPointer.bind(this);
    const { quote } = message;

    if (!quote || !quote.attachments || quote.attachments.length === 0) {
      return Promise.resolve();
    }

    return Promise.all(
      quote.attachments.map(attachment => {
        const { thumbnail } = attachment;
        if (!thumbnail) {
          return null;
        }

        return makePointer(thumbnail).then(pointer => {
          // eslint-disable-next-line no-param-reassign
          attachment.attachmentPointer = pointer;
        });
      })
    ).catch(error => {
      if (error instanceof Error && error.name === "HTTPError") {
        throw new errors.MessageError(message, error);
      } else {
        throw error;
      }
    });
  }

  sendMessage(attrs) {
    const message = new Message(attrs);
    return Promise.all([
      this.uploadAttachments(message),
      this.uploadThumbnails(message)
    ]).then(
      () =>
        new Promise((resolve, reject) => {
          this.sendMessageProto(
            message.timestamp,
            message.recipients,
            message.toProto(),
            res => {
              res.dataMessage = message.toArrayBuffer();
              if (res.errors.length > 0) {
                reject(res);
              } else {
                resolve(res);
              }
            }
          );
        })
    );
  }

  sendMessageProto(timestamp, numbers, message, callback, silent) {
    const rejections = this.store.get("signedKeyRotationRejected", 0);
    if (rejections > 5) {
      throw new errors.SignedPreKeyRotationError(
        numbers,
        message.toArrayBuffer(),
        timestamp
      );
    }

    const outgoing = new OutgoingMessage(
      this.server,
      this.store,
      timestamp,
      numbers,
      message,
      silent,
      callback
    );

    numbers.forEach(number => {
      this.queueJobForNumber(number, () => outgoing.sendToNumber(number));
    });
  }

  retrySendMessageProto(numbers, encodedMessage, timestamp) {
    const proto = DataMessage.decode(encodedMessage);
    return new Promise((resolve, reject) => {
      this.sendMessageProto(timestamp, numbers, proto, res => {
        if (res.errors.length > 0) {
          reject(res);
        } else {
          resolve(res);
        }
      });
    });
  }

  sendIndividualProto(number, proto, timestamp, silent) {
    return new Promise((resolve, reject) => {
      const callback = res => {
        if (res.errors.length > 0) {
          reject(res);
        } else {
          resolve(res);
        }
      };
      this.sendMessageProto(timestamp, [number], proto, callback, silent);
    });
  }

  createSyncMessage() {
    const syncMessage = new SyncMessage();

    // Generate a random int from 1 and 512
    const buffer = libsignal.crypto.getRandomBytes(1);
    const paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    syncMessage.padding = libsignal.crypto.getRandomBytes(paddingLength);

    return syncMessage;
  }

  sendSyncMessage(
    encodedDataMessage,
    timestamp,
    destination,
    expirationStartTimestamp
  ) {
    const myNumber = this.store.userGetNumber();
    const myDevice = this.store.userGetDeviceId();
    if (myDevice === 1 || myDevice === "1") {
      return Promise.resolve();
    }

    const dataMessage = DataMessage.decode(encodedDataMessage);
    const sentMessage = new SyncMessage.Sent();
    sentMessage.timestamp = timestamp;
    sentMessage.message = dataMessage;
    if (destination) {
      sentMessage.destination = destination;
    }
    if (expirationStartTimestamp) {
      sentMessage.expirationStartTimestamp = expirationStartTimestamp;
    }
    const syncMessage = this.createSyncMessage();
    syncMessage.sent = sentMessage;
    const contentMessage = new Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      Date.now(),
      silent
    );
  }

  getProfile(number) {
    return this.server.getProfile(number);
  }
  getAvatar(path) {
    return this.server.getAvatar(path);
  }

  sendRequestConfigurationSyncMessage() {
    const myNumber = this.store.userGetNumber();
    const myDevice = this.store.userGetDeviceId();
    if (myDevice !== 1 && myDevice !== "1") {
      const request = new SyncMessage.Request();
      request.type = SyncMessage.Request.Type.CONFIGURATION;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = new Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent
      );
    }

    return Promise.resolve();
  }
  sendRequestGroupSyncMessage() {
    const myNumber = this.store.userGetNumber();
    const myDevice = this.store.userGetDeviceId();
    if (myDevice !== 1 && myDevice !== "1") {
      const request = new SyncMessage.Request();
      request.type = SyncMessage.Request.Type.GROUPS;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = new Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent
      );
    }

    return Promise.resolve();
  }

  sendRequestContactSyncMessage() {
    const myNumber = this.store.userGetNumber();
    const myDevice = this.store.userGetDeviceId();
    if (myDevice !== 1 && myDevice !== "1") {
      const request = new SyncMessage.Request();
      request.type = SyncMessage.Request.Type.CONTACTS;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = new Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent
      );
    }

    return Promise.resolve();
  }
  sendReadReceipts(sender, timestamps) {
    const receiptMessage = new ReceiptMessage();
    receiptMessage.type = ReceiptMessage.Type.READ;
    receiptMessage.timestamp = timestamps;

    const contentMessage = new Content();
    contentMessage.receiptMessage = receiptMessage;

    const silent = true;
    return this.sendIndividualProto(sender, contentMessage, Date.now(), silent);
  }
  syncReadMessages(reads) {
    const myNumber = this.store.userGetNumber();
    const myDevice = this.store.userGetDeviceId();
    if (myDevice !== 1 && myDevice !== "1") {
      const syncMessage = this.createSyncMessage();
      syncMessage.read = [];
      for (let i = 0; i < reads.length; i += 1) {
        const read = new SyncMessage.Read();
        read.timestamp = reads[i].timestamp;
        read.sender = reads[i].sender;
        syncMessage.read.push(read);
      }
      const contentMessage = new Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent
      );
    }

    return Promise.resolve();
  }
  syncVerification(destination, state, identityKey) {
    const myNumber = this.store.userGetNumber();
    const myDevice = this.store.userGetDeviceId();
    const now = Date.now();

    if (myDevice === 1 || myDevice === "1") {
      return Promise.resolve();
    }

    // First send a null message to mask the sync message.
    const nullMessage = new NullMessage();

    // Generate a random int from 1 and 512
    const buffer = libsignal.crypto.getRandomBytes(1);
    const paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    nullMessage.padding = libsignal.crypto.getRandomBytes(paddingLength);

    const contentMessage = new Content();
    contentMessage.nullMessage = nullMessage;

    // We want the NullMessage to look like a normal outgoing message; not silent
    const promise = this.sendIndividualProto(destination, contentMessage, now);

    return promise.then(() => {
      const verified = new Verified();
      verified.state = state;
      verified.destination = destination;
      verified.identityKey = identityKey;
      verified.nullMessage = nullMessage.padding;

      const syncMessage = this.createSyncMessage();
      syncMessage.verified = verified;

      const secondMessage = new Content();
      secondMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(myNumber, secondMessage, now, silent);
    });
  }

  sendGroupProto(providedNumbers, proto, timestamp = Date.now()) {
    const me = this.store.userGetNumber();
    const numbers = providedNumbers.filter(number => number !== me);
    if (numbers.length === 0) {
      return Promise.reject(new Error("No other members in the group"));
    }

    return new Promise((resolve, reject) => {
      const silent = true;
      const callback = res => {
        res.dataMessage = proto.toArrayBuffer();
        if (res.errors.length > 0) {
          reject(res);
        } else {
          resolve(res);
        }
      };

      this.sendMessageProto(timestamp, numbers, proto, callback, silent);
    });
  }

  sendMessageToNumber(
    number,
    messageText,
    attachments,
    quote,
    timestamp,
    expireTimer,
    profileKey
  ) {
    return this.sendMessage({
      recipients: [number],
      body: messageText,
      timestamp,
      attachments,
      quote,
      needsSync: true,
      expireTimer,
      profileKey
    });
  }

  resetSession(number, timestamp) {
    console.info("resetting secure session");
    const proto = new DataMessage();
    proto.body = "TERMINATE";
    proto.flags = DataMessage.Flags.END_SESSION;

    const logError = prefix => error => {
      console.error(prefix, error && error.stack ? error.stack : error);
      throw error;
    };
    const deleteAllSessions = targetNumber =>
      this.store.getDeviceIds(targetNumber).then(deviceIds =>
        Promise.all(
          deviceIds.map(deviceId => {
            const address = new libsignal.SignalProtocolAddress(
              targetNumber,
              deviceId
            );
            console.info("deleting sessions for", address.toString());
            const sessionCipher = new libsignal.SessionCipher(
              this.store,
              address
            );
            return sessionCipher.deleteAllSessionsForDevice();
          })
        )
      );

    const sendToContact = deleteAllSessions(number)
      .catch(logError("resetSession/deleteAllSessions1 error:"))
      .then(() => {
        console.info("finished closing local sessions, now sending to contact");
        return this.sendIndividualProto(number, proto, timestamp).catch(
          logError("resetSession/sendToContact error:")
        );
      })
      .then(() =>
        deleteAllSessions(number).catch(
          logError("resetSession/deleteAllSessions2 error:")
        )
      );

    const buffer = proto.toArrayBuffer();
    const sendSync = this.sendSyncMessage(buffer, timestamp, number).catch(
      logError("resetSession/sendSync error:")
    );

    return Promise.all([sendToContact, sendSync]);
  }

  sendMessageToGroup(
    groupId,
    messageText,
    attachments,
    quote,
    timestamp,
    expireTimer,
    profileKey
  ) {
    return this.store.groupsGetNumbers(groupId).then(targetNumbers => {
      if (targetNumbers === undefined) {
        return Promise.reject(new Error("Unknown Group"));
      }

      const me = this.store.userGetNumber();
      const numbers = targetNumbers.filter(number => number !== me);
      if (numbers.length === 0) {
        return Promise.reject(new Error("No other members in the group"));
      }

      return this.sendMessage({
        recipients: numbers,
        body: messageText,
        timestamp,
        attachments,
        quote,
        needsSync: true,
        expireTimer,
        profileKey,
        group: {
          id: groupId,
          type: GroupContext.Type.DELIVER
        }
      });
    });
  }

  createGroup(targetNumbers, name, avatar) {
    const proto = new DataMessage();
    proto.group = new GroupContext();

    return this.store.groupsCreateNewGroup(targetNumbers).then(group => {
      proto.group.id = stringToArrayBuffer(group.id);
      const { numbers } = group;

      proto.group.type = GroupContext.Type.UPDATE;
      proto.group.members = numbers;
      proto.group.name = name;

      return this.makeAttachmentPointer(avatar).then(attachment => {
        proto.group.avatar = attachment;
        return this.sendGroupProto(numbers, proto).then(() => proto.group.id);
      });
    });
  }

  updateGroup(groupId, name, avatar, targetNumbers) {
    const proto = new DataMessage();
    proto.group = new GroupContext();

    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = GroupContext.Type.UPDATE;
    proto.group.name = name;

    return this.store.groupsAddNumbers(groupId, targetNumbers).then(numbers => {
      if (numbers === undefined) {
        return Promise.reject(new Error("Unknown Group"));
      }
      proto.group.members = numbers;

      return this.makeAttachmentPointer(avatar).then(attachment => {
        proto.group.avatar = attachment;
        return this.sendGroupProto(numbers, proto).then(() => proto.group.id);
      });
    });
  }

  addNumberToGroup(groupId, number) {
    const proto = new DataMessage();
    proto.group = new GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = GroupContext.Type.UPDATE;

    return this.store.groupsAddNumbers(groupId, [number]).then(numbers => {
      if (numbers === undefined)
        return Promise.reject(new Error("Unknown Group"));
      proto.group.members = numbers;

      return this.sendGroupProto(numbers, proto);
    });
  }

  setGroupName(groupId, name) {
    const proto = new DataMessage();
    proto.group = new GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = GroupContext.Type.UPDATE;
    proto.group.name = name;

    return this.store.groupsGetNumbers(groupId).then(numbers => {
      if (numbers === undefined)
        return Promise.reject(new Error("Unknown Group"));
      proto.group.members = numbers;

      return this.sendGroupProto(numbers, proto);
    });
  }

  setGroupAvatar(groupId, avatar) {
    const proto = new DataMessage();
    proto.group = new GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = GroupContext.Type.UPDATE;

    return this.store.groupsGetNumbers(groupId).then(numbers => {
      if (numbers === undefined)
        return Promise.reject(new Error("Unknown Group"));
      proto.group.members = numbers;

      return this.makeAttachmentPointer(avatar).then(attachment => {
        proto.group.avatar = attachment;
        return this.sendGroupProto(numbers, proto);
      });
    });
  }

  leaveGroup(groupId) {
    const proto = new DataMessage();
    proto.group = new GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = GroupContext.Type.QUIT;

    return this.store.groupsGetNumbers(groupId).then(numbers => {
      if (numbers === undefined)
        return Promise.reject(new Error("Unknown Group"));
      return this.store
        .groupsDeleteGroup(groupId)
        .then(() => this.sendGroupProto(numbers, proto));
    });
  }

  sendExpirationTimerUpdateToGroup(
    groupId,
    expireTimer,
    timestamp,
    profileKey
  ) {
    return this.store.groupsGetNumbers(groupId).then(targetNumbers => {
      if (targetNumbers === undefined)
        return Promise.reject(new Error("Unknown Group"));

      const me = this.store.userGetNumber();
      const numbers = targetNumbers.filter(number => number !== me);
      if (numbers.length === 0) {
        return Promise.reject(new Error("No other members in the group"));
      }
      return this.sendMessage({
        recipients: numbers,
        timestamp,
        needsSync: true,
        expireTimer,
        profileKey,
        flags: DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
        group: {
          id: groupId,
          type: GroupContext.Type.DELIVER
        }
      });
    });
  }

  sendExpirationTimerUpdateToNumber(
    number,
    expireTimer,
    timestamp,
    profileKey
  ) {
    return this.sendMessage({
      recipients: [number],
      timestamp,
      needsSync: true,
      expireTimer,
      profileKey,
      flags: DataMessage.Flags.EXPIRATION_TIMER_UPDATE
    });
  }
}

exports = module.exports = WebAPI => {
  MessageSender.WebAPI = WebAPI;
  return MessageSender;
};
