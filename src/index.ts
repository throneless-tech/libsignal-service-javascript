// external
import  _ from 'lodash';
import ByteBuffer from 'bytebuffer';
import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber';

// upstream
import { textsecure } from '../lib/ts/textsecure/index';
import * as Crypto from '../lib/ts/Crypto';

// types
import './types/ByteBufferExtended';
import { StorageType } from './types/libsignal';
import { fromBits, fromString } from './types/LongExtended';

// shims
import { createTaskWithTimeout } from './shims';
import { crypto } from './shims';
import { libsignal } from './js/libsignal';
import { WebAPI } from './js/WebAPI';
import * as log from './shims/log';
import * as protobuf from './js/ProtobufWrapper';

// other implementations
import { Storage, StorageImpl, StorageConversations, StorageUser, StorageUnprocessed } from './StorageWrapper';
import { SignalProtocolStore } from './LibSignalStore';
import { AccountManager } from './AccountManager';
import { MessageReceiver } from './MessageReceiver';
import { MessageSender } from './SendMessage';
import { ConversationController } from './ConversationController';

// build-time initialization of globals that libtextsecure needs
window.log = log;

window.libphonenumber = PhoneNumberUtil.getInstance();
window.libphonenumber.PhoneNumberFormat = PhoneNumberFormat;
import '../lib/js/libphonenumber-util.js';

window.crypto = crypto;

window.dcodeIO = {
  ByteBuffer: ByteBuffer,
  Long: {
    fromBits,
    fromString,
  },
};

window.isValidGuid = (maybeGuid: string) =>
  /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(
    maybeGuid
  );
// https://stackoverflow.com/a/23299989
window.isValidE164 = (maybeE164: string) => /^\+?[1-9]\d{1,14}$/.test(maybeE164);

window.normalizeUuids = (obj: object, paths: string[], context: string) => {
  if (!obj) {
    return;
  }
  paths.forEach((path: string) => {
    const val = _.get(obj, path);
    if (val) {
      if (!val || !window.isValidGuid(val)) {
        window.log.warn(
          `Normalizing invalid uuid: ${val} at path ${path} in context "${context}"`
        );
      }
      if (val && val.toLowerCase) {
        _.set(obj, path, val.toLowerCase());
      }
    }
  });
};

window.reduxActions = {
  expiration: {
    hydrateExpirationStatus: (status: boolean) => status
  }
}

window.Signal = { Crypto };

// run-time initialization of globals that libtextsecure needs
const initStorage = async (storage: StorageType) => {
  // Why do we interact with storage in several places via different interfaces?
  window.storage = new Storage(storage);
  window.Signal.Data = storage;
  textsecure.storage.impl = new StorageImpl(window.storage);
  window.textsecure = {
    ...textsecure,
    createTaskWithTimeout: createTaskWithTimeout,
    storage: {
      ...textsecure.storage,
      protocol: new SignalProtocolStore(),
      user: new StorageUser(window.storage),
      unprocessed: new StorageUnprocessed(storage)
    },
    protobuf: {
      ...protobuf,
      //DataMessage: {
      //  ...protobuf.DataMessage,
      //  Flags: protobuf.DataMessage.prototype.flags,
      //},
      ProvisioningUuid: protobuf.ProvisioningUuid,
    }
  };
  window.ConversationController = new ConversationController(new StorageConversations(storage));
  window.libsignal = libsignal;
  window.WebAPI = WebAPI;
  await Promise.all([
    window.storage.fetch(),
    window.textsecure.storage.protocol.hydrateCaches(),
    window.ConversationController.load(),
  ]);
}

export { initStorage, AccountManager, MessageSender, MessageReceiver };
