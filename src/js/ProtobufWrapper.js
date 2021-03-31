export * from '../../dist/compiled.js';
import {
  AccessControl as AccessControlOrig,
  AccountRecord as AccountRecordOrig,
  AttachmentPointer as AttachmentPointerOrig,
  AvatarUploadAttributes as AvatarUploadAttributesOrig,
  CallingMessage as CallingMessageOrig,
  ContactDetails as ContactDetailsOrig,
  ContactRecord as ContactRecordOrig,
  Content as ContentOrig,
  DataMessage as DataMessageOrig,
  DeviceName as DeviceNameOrig,
  Envelope as EnvelopeOrig,
  Group as GroupOrig,
  GroupAttributeBlob as GroupAttributeBlobOrig,
  GroupChange as GroupChangeOrig,
  GroupChanges as GroupChangesOrig,
  GroupContext as GroupContextOrig,
  GroupContextV2 as GroupContextV2Orig,
  GroupDetails as GroupDetailsOrig,
  GroupExternalCredential as GroupExternalCredentialOrig,
  GroupInviteLink as GroupInviteLinkOrig,
  GroupJoinInfo as GroupJoinInfoOrig,
  GroupV1Record as GroupV1RecordOrig,
  GroupV2Record as GroupV2RecordOrig,
  KeyExchangeMessage as KeyExchangeMessageOrig,
  ManifestRecord as ManifestRecordOrig,
  Member as MemberOrig,
  MemberPendingAdminApproval as MemberPendingAdminApprovalOrig,
  MemberPendingProfileKey as MemberPendingProfileKeyOrig,
  NullMessage as NullMessageOrig,
  PreKeyWhisperMessage as PreKeyWhisperMessageOrig,
  ProvisionEnvelope as ProvisionEnvelopeOrig,
  ProvisioningUuid as ProvisioningUuidOrig,
  ProvisionMessage as ProvisionMessageOrig,
  ProvisioningVersion as ProvisioningVersionOrig,
  ReadOperation as ReadOperationOrig,
  ReceiptMessage as ReceiptMessageOrig,
  SenderCertificate as SenderCertificateOrig,
  ServerCertificate as ServerCertificateOrig,
  StickerPack as StickerPackOrig,
  StorageItem as StorageItemOrig,
  StorageItems as StorageItemsOrig,
  StorageManifest as StorageManifestOrig,
  StorageRecord as StorageRecordOrig,
  SyncMessage as SyncMessageOrig,
  TypingMessage as TypingMessageOrig,
  UnidentifiedSenderMessage as UnidentifiedSenderMessageOrig,
  Verified as VerifiedOrig,
  WebSocketMessage as WebSocketMessageOrig,
  WebSocketRequestMessage as WebSocketRequestMessageOrig,
  WebSocketResponseMessage as WebSocketResponseMessageOrig,
  WhisperMessage as WhisperMessageOrig,
  WriteOperation as WriteOperationOrig,
} from '../../dist/compiled.js';

export function onLoad(callback) {
    callback();
}

export const AccessControl = {
  ...AccessControlOrig.prototype,
  decode(data, encoding) {
    return AccessControlOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return AccessControlOrig.encode(this).finish().buffer;
  }
}

export const AccountRecord = {
  ...AccountRecordOrig.prototype,
  decode(data, encoding) {
    return AccountRecordOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return AccountRecordOrig.encode(this).finish().buffer;
  }
}

export const AttachmentPointer = {
  ...AttachmentPointerOrig.prototype,
  decode(data, encoding) {
    return AttachmentPointerOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return AttachmentPointerOrig.encode(this).finish().buffer;
  }
}

export const AvatarUploadAttributes = {
  ...AvatarUploadAttributesOrig.prototype,
  decode(data, encoding) {
    return AvatarUploadAttributesOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return AvatarUploadAttributesOrig.encode(this).finish().buffer;
  }
}

export const CallingMessage = {
  ...CallingMessageOrig.prototype,
  decode(data, encoding) {
    return CallingMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return CallingMessageOrig.encode(this).finish().buffer;
  }
}

export const ContactDetails = {
  ...ContactDetailsOrig.prototype,
  decode(data, encoding) {
    return ContactDetailsOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return ContactDetailsOrig.encode(this).finish().buffer;
  }
}

export const ContactRecord = {
  ...ContactRecordOrig.prototype,
  decode(data, encoding) {
    return ContactRecordOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return ContactRecordOrig.encode(this).finish().buffer;
  }
}

export const Content = {
  ...ContentOrig.prototype,
  decode(data, encoding) {
    return ContentOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return ContentOrig.encode(this).finish().buffer;
  }
}

export const DataMessage = {
  ...DataMessageOrig.prototype,
  decode(data, encoding) {
    return DataMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return DataMessageOrig.encode(this).finish().buffer;
  }
}

export const DeviceName = {
  ...DeviceNameOrig.prototype,
  decode(data, encoding) {
    return DeviceNameOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return DeviceNameOrig.encode(this).finish().buffer;
  }
}

export const Envelope = {
  ...EnvelopeOrig.prototype,
  decode(data, encoding) {
    return EnvelopeOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return EnvelopeOrig.encode(this).finish().buffer;
  }
}

export const Group = {
  ...GroupOrig.prototype,
  decode(data, encoding) {
    return GroupOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return GroupOrig.encode(this).finish().buffer;
  }
}

export const GroupAttributeBlob = {
  ...GroupAttributeBlobOrig.prototype,
  decode(data, encoding) {
    return GroupAttributeBlobOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return GroupAttributeBlobOrig.encode(this).finish().buffer;
  }
}

export const GroupChange = {
  ...GroupChangeOrig.prototype,
  decode(data, encoding) {
    return GroupChangeOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return GroupChangeOrig.encode(this).finish().buffer;
  }
}

export const GroupChanges = {
  ...GroupChangesOrig.prototype,
  decode(data, encoding) {
    return GroupChangesOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return GroupChangesOrig.encode(this).finish().buffer;
  }
}

export const GroupContext = {
  ...GroupContextOrig.prototype,
  decode(data, encoding) {
    return GroupContextOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return GroupContextOrig.encode(this).finish().buffer;
  }
}

export const GroupContextV2 = {
  ...GroupContextV2Orig.prototype,
  decode(data, encoding) {
    return GroupContextV2Orig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return GroupContextV2Orig.encode(this).finish().buffer;
  }
}

export const GroupDetails = {
  ...GroupDetailsOrig.prototype,
  decode(data, encoding) {
    return GroupDetailsOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return GroupDetailsOrig.encode(this).finish().buffer;
  }
}

export const GroupExternalCredential = {
  ...GroupExternalCredentialOrig.prototype,
  decode(data, encoding) {
    return GroupExternalCredentialOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return GroupExternalCredentialOrig.encode(this).finish().buffer;
  }
}

export const GroupInviteLink = {
  ...GroupInviteLinkOrig.prototype,
  decode(data, encoding) {
    return GroupInviteLinkOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return GroupInviteLinkOrig.encode(this).finish().buffer;
  }
}

export const GroupJoinInfo = {
  ...GroupJoinInfoOrig.prototype,
  decode(data, encoding) {
    return GroupJoinInfoOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return GroupJoinInfoOrig.encode(this).finish().buffer;
  }
}

export const GroupV1Record = {
  ...GroupV1RecordOrig.prototype,
  decode(data, encoding) {
    return GroupV1RecordOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return GroupV1RecordOrig.encode(this).finish().buffer;
  }
}

export const GroupV2Record = {
  ...GroupV2RecordOrig.prototype,
  decode(data, encoding) {
    return GroupV2RecordOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return GroupV2RecordOrig.encode(this).finish().buffer;
  }
}

export const KeyExchangeMessage = {
  ...KeyExchangeMessageOrig.prototype,
  decode(data, encoding) {
    return KeyExchangeMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return KeyExchangeMessageOrig.encode(this).finish().buffer;
  }
}

export const ManifestRecord = {
  ...ManifestRecordOrig.prototype,
  decode(data, encoding) {
    return ManifestRecordOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return ManifestRecordOrig.encode(this).finish().buffer;
  }
}

export const Member = {
  ...MemberOrig.prototype,
  decode(data, encoding) {
    return MemberOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return MemberOrig.encode(this).finish().buffer;
  }
}

export const MemberPendingAdminApproval = {
  ...MemberPendingAdminApprovalOrig.prototype,
  decode(data, encoding) {
    return MemberPendingAdminApprovalOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return MemberPendingAdminApprovalOrig.encode(this).finish().buffer;
  }
}

export const MemberPendingProfileKey = {
  ...MemberPendingProfileKeyOrig.prototype,
  decode(data, encoding) {
    return MemberPendingProfileKeyOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return MemberPendingProfileKeyOrig.encode(this).finish().buffer;
  }
}

export const NullMessage = {
  ...NullMessageOrig.prototype,
  decode(data, encoding) {
    return NullMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return NullMessageOrig.encode(this).finish().buffer;
  }
}

export const PreKeyWhisperMessage = {
  ...PreKeyWhisperMessageOrig.prototype,
  decode(data, encoding) {
    return PreKeyWhisperMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return PreKeyWhisperMessageOrig.encode(this).finish().buffer;
  }
}

export const ProvisionEnvelope = {
  ...ProvisionEnvelopeOrig.prototype,
  decode(data, encoding) {
    return ProvisionEnvelopeOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return ProvisionEnvelopeOrig.encode(this).finish().buffer;
  }
}

export const ProvisioningUuid = {
  ...ProvisioningUuidOrig.prototype,
  decode(data, encoding) {
    return ProvisioningUuidOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return ProvisioningUuidOrig.encode(this).finish().buffer;
  }
}

export const ProvisionMessage = {
  ...ProvisionMessageOrig.prototype,
  decode(data, encoding) {
    return ProvisionMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return ProvisionMessageOrig.encode(this).finish().buffer;
  }
}

export const ProvisioningVersion = {
  ...ProvisioningVersionOrig.prototype,
  decode(data, encoding) {
    return ProvisioningVersionOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return ProvisioningVersionOrig.encode(this).finish().buffer;
  }
}

export const ReadOperation = {
  ...ReadOperationOrig.prototype,
  decode(data, encoding) {
    return ReadOperationOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return ReadOperationOrig.encode(this).finish().buffer;
  }
}

export const ReceiptMessage = {
  ...ReceiptMessageOrig.prototype,
  decode(data, encoding) {
    return ReceiptMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return ReceiptMessageOrig.encode(this).finish().buffer;
  }
}

export const SenderCertificate = {
  ...SenderCertificateOrig.prototype,
  decode(data, encoding) {
    return SenderCertificateOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return SenderCertificateOrig.encode(this).finish().buffer;
  }
}

export const ServerCertificate = {
  ...ServerCertificateOrig.prototype,
  decode(data, encoding) {
    return ServerCertificateOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return ServerCertificateOrig.encode(this).finish().buffer;
  }
}

export const StickerPack = {
  ...StickerPackOrig.prototype,
  decode(data, encoding) {
    return StickerPackOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return StickerPackOrig.encode(this).finish().buffer;
  }
}

export const StorageItem = {
  ...StorageItemOrig.prototype,
  decode(data, encoding) {
    return StorageItemOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return StorageItemOrig.encode(this).finish().buffer;
  }
}

export const StorageItems = {
  ...StorageItemsOrig.prototype,
  decode(data, encoding) {
    return StorageItemsOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return StorageItemsOrig.encode(this).finish().buffer;
  }
}

export const StorageManifest = {
  ...StorageManifestOrig.prototype,
  decode(data, encoding) {
    return StorageManifestOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return StorageManifestOrig.encode(this).finish().buffer;
  }
}

export const StorageRecord = {
  ...StorageRecordOrig.prototype,
  decode(data, encoding) {
    return StorageRecordOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return StorageRecordOrig.encode(this).finish().buffer;
  }
}

export const SyncMessage = {
  ...SyncMessageOrig.prototype,
  decode(data, encoding) {
    return SyncMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return SyncMessageOrig.encode(this).finish().buffer;
  }
}

export const TypingMessage = {
  ...TypingMessageOrig.prototype,
  decode(data, encoding) {
    return TypingMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return TypingMessageOrig.encode(this).finish().buffer;
  }
}

export const UnidentifiedSenderMessage = {
  ...UnidentifiedSenderMessageOrig.prototype,
  decode(data, encoding) {
    return UnidentifiedSenderMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return UnidentifiedSenderMessageOrig.encode(this).finish().buffer;
  }
}

export const Verified = {
  ...VerifiedOrig.prototype,
  decode(data, encoding) {
    return VerifiedOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return VerifiedOrig.encode(this).finish().buffer;
  }
}

export const WebSocketMessage = {
  ...WebSocketMessageOrig.prototype,
  decode(data, encoding) {
    return WebSocketMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return WebSocketMessageOrig.encode(this).finish().buffer;
  }
}

export const WebSocketRequestMessage = {
  ...WebSocketRequestMessageOrig.prototype,
  decode(data, encoding) {
    return WebSocketRequestMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return WebSocketRequestMessageOrig.encode(this).finish().buffer;
  }
}

export const WebSocketResponseMessage = {
  ...WebSocketResponseMessageOrig.prototype,
  decode(data, encoding) {
    return WebSocketResponseMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return WebSocketResponseMessageOrig.encode(this).finish().buffer;
  }
}

export const WhisperMessage = {
  ...WhisperMessageOrig.prototype,
  decode(data, encoding) {
    return WhisperMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return WhisperMessageOrig.encode(this).finish().buffer;
  }
}

export const WriteOperation = {
  ...WriteOperationOrig.prototype,
  decode(data, encoding) {
    return WriteOperationOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  toArrayBuffer() {
    return WriteOperationOrig.encode(this).finish().buffer;
  }
}
