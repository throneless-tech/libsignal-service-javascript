/*
 * vim: ts=2:sw=2:expandtab
 */

"use strict";
var EventTarget = require("event-target-shim");
var MessageReceiver = require("./message_receiver.js");
var MessageSender = require("./sendmessage.js");

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names

class SyncRequest extends EventTarget {
  constructor(sender, receiver) {
    if (
      !(sender instanceof MessageSender) ||
      !(receiver instanceof MessageReceiver)
    ) {
      throw new Error(
        "Tried to construct a SyncRequest without MessageSender and MessageReceiver"
      );
    }
    this.receiver = receiver;

    this.oncontact = this.onContactSyncComplete.bind(this);
    receiver.addEventListener("contactsync", this.oncontact);

    this.ongroup = this.onGroupSyncComplete.bind(this);
    receiver.addEventListener("groupsync", this.ongroup);

    console.info("SyncRequest created. Sending contact sync message...");
    sender
      .sendRequestContactSyncMessage()
      .then(() => {
        console.info("SyncRequest now sending group sync messsage...");
        return sender.sendRequestGroupSyncMessage();
      })
      .catch(error => {
        console.error(
          "SyncRequest error:",
          error && error.stack ? error.stack : error
        );
      });
    this.timeout = setTimeout(this.onTimeout.bind(this), 60000);
  }

  onContactSyncComplete() {
    this.contactSync = true;
    this.update();
  }

  onGroupSyncComplete() {
    this.groupSync = true;
    this.update();
  }

  update() {
    if (this.contactSync && this.groupSync) {
      this.dispatchEvent(new Event("success"));
      this.cleanup();
    }
  }

  onTimeout() {
    if (this.contactSync || this.groupSync) {
      this.dispatchEvent(new Event("success"));
    } else {
      this.dispatchEvent(new Event("timeout"));
    }
    this.cleanup();
  }

  cleanup() {
    clearTimeout(this.timeout);
    this.receiver.removeEventListener("contactsync", this.oncontact);
    this.receiver.removeEventListener("groupSync", this.ongroup);
    delete this.listeners;
  }
}

exports = module.exports = SyncRequest;
