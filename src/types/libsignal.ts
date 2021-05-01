export * from '../../lib/ts/libsignal';
import {
  LibSignalType as LibSignalTypeOrig,
  //SessionCipherClass as SessionCipherClassOrig,
  PreKeyType,
  SignalProtocolAddressClass,
  SignedPreKeyType,
} from '../../lib/ts/libsignal';
import {
  UnprocessedType,
} from '../../lib/ts/textsecure.d';

import { ConversationModel } from '../Conversation';
import { StorageProtocolType } from './textsecure';

// re-declared from upstream libsignal.d.ts
type DeviceType = {
  deviceId: number;
  identityKey: ArrayBuffer;
  registrationId: number;
  signedPreKey: {
    keyId: number;
    publicKey: ArrayBuffer;
    signature: ArrayBuffer;
  };
  preKey?: {
    keyId: number;
    publicKey: ArrayBuffer;
  };
};

type IdentityKeyType = {
  firstUse: boolean;
  id: string;
  nonblockingApproval: boolean;
  publicKey: ArrayBuffer;
  timestamp: number;
  verified: number;
};

type SessionType = {
  conversationId: string;
  deviceId: number;
  id: string;
  record: string;
};

type ItemType = any;

export type StorageType = {
  // IdentityKeys
  createOrUpdateIdentityKey: (data: IdentityKeyType) => Promise<void>;
  getIdentityKeyById: (id: string) => Promise<IdentityKeyType | undefined>;
  bulkAddIdentityKeys: (array: Array<IdentityKeyType>) => Promise<void>;
  removeIdentityKeyById: (id: string) => Promise<void>;
  removeAllIdentityKeys: () => Promise<void>;
  getAllIdentityKeys: () => Promise<Array<IdentityKeyType>>;

  // Items
  createOrUpdateItem: (data: ItemType) => Promise<void>;
  getItemById: (id: string) => Promise<ItemType | undefined>;
  bulkAddItems: (array: Array<ItemType>) => Promise<void>;
  removeItemById: (id: string) => Promise<void>;
  removeAllItems: () => Promise<void>;
  getAllItems: () => Promise<Array<ItemType>>;

  // PreKeys
  createOrUpdatePreKey: (data: PreKeyType) => Promise<void>;
  getPreKeyById: (id: number) => Promise<PreKeyType | undefined>;
  bulkAddPreKeys: (array: Array<PreKeyType>) => Promise<void>;
  removePreKeyById: (id: number) => Promise<void>;
  removeAllPreKeys: () => Promise<void>;
  getAllPreKeys: () => Promise<Array<PreKeyType>>;

  // Sessions
  createOrUpdateSession: (data: SessionType) => Promise<void>;
  getSessionById: (id: string) => Promise<SessionType | undefined>;
  //getSessionsById: (conversationId: string) => Promise<Array<SessionType>>;
  bulkAddSessions: (array: Array<SessionType>) => Promise<void>;
  removeSessionById: (id: string) => Promise<void>;
  removeSessionsByConversation: (conversationId: string) => Promise<void>;
  removeAllSessions: () => Promise<void>;
  getAllSessions: () => Promise<Array<SessionType>>;

  // SignedPreKeys
  createOrUpdateSignedPreKey: (data: SignedPreKeyType) => Promise<void>;
  getSignedPreKeyById: (id: number) => Promise<SignedPreKeyType | undefined>;
  bulkAddSignedPreKeys: (array: Array<SignedPreKeyType>) => Promise<void>;
  removeSignedPreKeyById: (id: number) => Promise<void>;
  removeAllSignedPreKeys: () => Promise<void>;
  getAllSignedPreKeys: () => Promise<Array<SignedPreKeyType>>;

  // Unprocessed
  getUnprocessedById: (id: string) => Promise<UnprocessedType | undefined>;
  getUnprocessedCount: () => Promise<number>;
  saveUnprocessed: (
    data: UnprocessedType,
    options?: { forceSave?: boolean }
  ) => Promise<number>;
  saveUnprocesseds: (
    arrayOfUnprocessed: Array<UnprocessedType>,
    options?: { forceSave?: boolean }
  ) => Promise<void>;
  updateUnprocessedAttempts: (id: string, attempts: number) => Promise<void>;
  updateUnprocessedWithData: (
    id: string,
    data: UnprocessedType
  ) => Promise<void>;
  updateUnprocessedsWithData: (array: Array<Partial<UnprocessedType>>) => Promise<void>;
  removeUnprocessed: (id: string | Array<string>) => Promise<void>;
  removeAllUnprocessed: () => Promise<void>;
  getAllUnprocessed: () => Promise<Array<UnprocessedType>>;

  // Conversations
  createOrUpdateConversation: (data: ConversationModel) => Promise<void>;
  getConversationsByMember: (memberId: string) => Promise<Array<ConversationModel>>;
  removeConversationById: (id: string) => Promise<void>;
  removeAllConversations: () => Promise<void>;
  getAllConversations: () => Promise<Array<ConversationModel>>;

}

// re-declared from upstream libsignal.d.ts
type RecordType = {
  archiveCurrentState: () => void;
  deleteAllSessions: () => void;
  getOpenSession: () => void;
  getSessionByBaseKey: () => void;
  getSessions: () => void;
  haveOpenSession: () => void;
  promoteState: () => void;
  serialize: () => void;
  updateSessionState: () => void;
};

// re-declared from upstream libsignal.d.ts
declare class SessionBuilderClass {
  constructor(storage: StorageProtocolType, remoteAddress: SignalProtocolAddressClass);
  processPreKey: (device: DeviceType) => Promise<void>;
  processV3: (record: RecordType, message: any) => Promise<void>;
}

// re-declared from upstream libsignal.d.ts
export declare class SessionCipherClass {
  constructor(
    storage: StorageProtocolType,
    remoteAddress: SignalProtocolAddressClass | string,
    options?: { messageKeysLimit?: number | boolean }
  );
  closeOpenSessionForDevice: () => Promise<void>;
  decryptPreKeyWhisperMessage: (
    buffer: ArrayBuffer,
    encoding?: string
  ) => Promise<ArrayBuffer>;
  decryptWhisperMessage: (
    buffer: ArrayBuffer,
    encoding?: string
  ) => Promise<ArrayBuffer>;
  deleteAllSessionsForDevice: () => Promise<void>;
  encrypt: (
    buffer: ArrayBuffer | Uint8Array,
    encoding?: string
  ) => Promise<{
    type: number;
    registrationId: number;
    body: string;
  }>;
  getRecord: () => Promise<RecordType>;
  getSessionVersion: () => Promise<number>;
  getRemoteRegistrationId: () => Promise<number>;
  hasOpenSession: () => Promise<boolean>;
}

export type LibSignalType = Omit<LibSignalTypeOrig, 'SessionBuilder' | 'SessionCipher'> & {
  SessionBuilder: typeof SessionBuilderClass;
  SessionCipher: typeof SessionCipherClass;
};
