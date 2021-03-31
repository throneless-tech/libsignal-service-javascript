export * from '../../lib/ts/textsecure.d';
import {
  StorageProtocolType as StorageProtocolTypeOrig,
  TextSecureType as TextSecureTypeOrig,
  UnprocessedType,
} from '../../lib/ts/textsecure.d';
import SendMessage from '../../lib/ts/textsecure/SendMessage';
import { KeyPairType } from '../../lib/ts/libsignal';

type IdentityKeyType = {
  firstUse: boolean;
  id?: string;
  nonblockingApproval: boolean;
  publicKey: ArrayBuffer;
  timestamp: number;
  verified: number;
};

type OuterSignedPrekeyType = {
  confirmed: boolean;
  // eslint-disable-next-line camelcase
  created_at: number;
  keyId: number;
  privKey: ArrayBuffer;
  pubKey: ArrayBuffer;
};

export type StorageProtocolType = Omit<StorageProtocolTypeOrig, 'isTrustedIdentity' | 'loadPreKey' | 'loadSignedPreKey' | 'saveIdentity' | 'loadSignedPreKeys' | 'saveIdentityWithAttributes'> & {
  isTrustedIdentity: (encodedAddress: string, publicKey: ArrayBuffer, direction: number) => Promise<boolean>;
  loadPreKey: (keyId: string | number) => Promise<KeyPairType | undefined>;
  loadSignedPreKey: (keyId: number) => Promise<OuterSignedPrekeyType | undefined>;
  saveIdentity: (encodedAddress: string, publicKey: ArrayBuffer, nonblockingApproval: boolean) => Promise<boolean>;
  loadSignedPreKeys: () => Promise<Array<OuterSignedPrekeyType>>;
  saveIdentityWithAttributes: (encodedAddress: string, attributes: IdentityKeyType) => Promise<void>;
};

export type TextSecureType = Omit<TextSecureTypeOrig,'messageReceiver' | 'messageSender' | 'messaging' | 'storage'> & {
  messaging?: SendMessage;
  storage: {
    user: {
      getNumber: () => string | undefined;
      getUuid: () => string | undefined;
      getDeviceId: () => number | string | undefined;
      getDeviceName: () => string;
      getDeviceNameEncrypted: () => boolean;
      setDeviceNameEncrypted: () => Promise<void>;
      getSignalingKey: () => ArrayBuffer;
      setNumberAndDeviceId: (
        number: string,
        deviceId: number,
        deviceName?: string | null
      ) => Promise<void>;
      setUuidAndDeviceId: (uuid: string, deviceId: number) => Promise<void>;
    };
    unprocessed: {
      batchAdd: (dataArray: Array<UnprocessedType>) => Promise<void>;
      remove: (id: string | Array<string>) => Promise<void>;
      getCount: () => Promise<number>;
      removeAll: () => Promise<void>;
      getAll: () => Promise<Array<UnprocessedType>>;
      updateAttempts: (id: string, attempts: number) => Promise<void>;
      addDecryptedDataToList: (
        array: Array<Partial<UnprocessedType>>
      ) => Promise<void>;
    };
    get: (key: string, defaultValue?: unknown) => any;
    put: (key: string, value: any) => void | Promise<void>;
    remove: (key: string) => void | Promise<void>;
    protocol: StorageProtocolType;
  };
};
