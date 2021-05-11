import ByteBufferClass from 'bytebuffer';
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
} from '../../dist/protobufs';

const convertBuffers = (message) => {
  for (const prop in message) {
    if (message.hasOwnProperty(prop)) {
      if (message[prop] instanceof Uint8Array) {
        message[prop] = ByteBufferClass.wrap(message[prop]);
      } else if (typeof message[prop] === 'object' && message[prop] !== null) {
        message[prop] = convertBuffers(message[prop]);
      }
    }
  }
  return message;
}

export function onLoad(callback) {
    callback();
}

export class AccessControl extends AccessControlOrig {
  static decode(data, encoding) {
    return AccessControlOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return AccessControlOrig.encode(this).finish().buffer;
  }
}

export class AccountRecord extends AccountRecordOrig {
  static decode(data, encoding) {
    return AccountRecordOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return AccountRecordOrig.encode(this).finish().buffer;
  }
}

export class AttachmentPointer extends AttachmentPointerOrig {
  static decode(data, encoding) {
    return AttachmentPointerOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return AttachmentPointerOrig.encode(this).finish().buffer;
  }
}

export class AvatarUploadAttributes extends AvatarUploadAttributesOrig {
  static decode(data, encoding) {
    return AvatarUploadAttributesOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return AvatarUploadAttributesOrig.encode(this).finish().buffer;
  }
}

export class CallingMessage extends CallingMessageOrig {
  static decode(data, encoding) {
    return CallingMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return CallingMessageOrig.encode(this).finish().buffer;
  }
}

export class ContactDetails extends ContactDetailsOrig {
  static decode(data, encoding) {
    return ContactDetailsOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return ContactDetailsOrig.encode(this).finish().buffer;
  }
}

export class ContactRecord extends ContactRecordOrig {
  static decode(data, encoding) {
    return ContactRecordOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return ContactRecordOrig.encode(this).finish().buffer;
  }
}

export class Content extends ContentOrig {
  static decode(data, encoding) {
    return ContentOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return ContentOrig.encode(this).finish().buffer;
  }
}

export class DataMessage extends DataMessageOrig {
  static decode(data, encoding) {
    return DataMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return DataMessageOrig.encode(this).finish().buffer;
  }
}
export class DeviceName extends DeviceNameOrig {
  static decode(data, encoding) {
    return DeviceNameOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return DeviceNameOrig.encode(this).finish().buffer;
  }
}

export class Envelope extends EnvelopeOrig {
  static decode(data, encoding) {
    return EnvelopeOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return EnvelopeOrig.encode(this).finish().buffer;
  }
}

export class Group extends GroupOrig {
  static decode(data, encoding) {
    return GroupOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return GroupOrig.encode(this).finish().buffer;
  }
}

export class GroupAttributeBlob extends GroupAttributeBlobOrig {
  static decode(data, encoding) {
    return GroupAttributeBlobOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return GroupAttributeBlobOrig.encode(this).finish().buffer;
  }
}

export class GroupChange extends GroupChangeOrig {
  static decode(data, encoding) {
    return GroupChangeOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return GroupChangeOrig.encode(this).finish().buffer;
  }
}

export class GroupChanges extends GroupChangesOrig {
  static decode(data, encoding) {
    return GroupChangesOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return GroupChangesOrig.encode(this).finish().buffer;
  }
}

export class GroupContext extends GroupContextOrig {
  static decode(data, encoding) {
    return GroupContextOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return GroupContextOrig.encode(this).finish().buffer;
  }
}

export class GroupContextV2 extends GroupContextV2Orig {
  static decode(data, encoding) {
    return GroupContextV2Orig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return GroupContextV2Orig.encode(this).finish().buffer;
  }
}

export class GroupDetails extends GroupDetailsOrig {
  static decode(data, encoding) {
    return GroupDetailsOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return GroupDetailsOrig.encode(this).finish().buffer;
  }
}

export class GroupExternalCredential extends GroupExternalCredentialOrig {
  static decode(data, encoding) {
    return GroupExternalCredentialOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return GroupExternalCredentialOrig.encode(this).finish().buffer;
  }
}

export class GroupInviteLink extends GroupInviteLinkOrig {
  static decode(data, encoding) {
    return GroupInviteLinkOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return GroupInviteLinkOrig.encode(this).finish().buffer;
  }
}

export class GroupJoinInfo extends GroupJoinInfoOrig {
  static decode(data, encoding) {
    return GroupJoinInfoOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return GroupJoinInfoOrig.encode(this).finish().buffer;
  }
}

export class GroupV1Record extends GroupV1RecordOrig {
  static decode(data, encoding) {
    return GroupV1RecordOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return GroupV1RecordOrig.encode(this).finish().buffer;
  }
}

export class GroupV2Record extends GroupV2RecordOrig {
  static decode(data, encoding) {
    return GroupV2RecordOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return GroupV2RecordOrig.encode(this).finish().buffer;
  }
}

export class KeyExchangeMessage extends KeyExchangeMessageOrig {
  static decode(data, encoding) {
    return KeyExchangeMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return KeyExchangeMessageOrig.encode(this).finish().buffer;
  }
}

export class ManifestRecord extends ManifestRecordOrig {
  static decode(data, encoding) {
    return ManifestRecordOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return ManifestRecordOrig.encode(this).finish().buffer;
  }
}

export class Member extends MemberOrig {
  static decode(data, encoding) {
    return MemberOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return MemberOrig.encode(this).finish().buffer;
  }
}

export class MemberPendingAdminApproval extends MemberPendingAdminApprovalOrig {
  static decode(data, encoding) {
    return MemberPendingAdminApprovalOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return MemberPendingAdminApprovalOrig.encode(this).finish().buffer;
  }
}

export class MemberPendingProfileKey extends MemberPendingProfileKeyOrig {
  static decode(data, encoding) {
    return MemberPendingProfileKeyOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return MemberPendingProfileKeyOrig.encode(this).finish().buffer;
  }
}

export class NullMessage extends NullMessageOrig {
  static decode(data, encoding) {
    return NullMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return NullMessageOrig.encode(this).finish().buffer;
  }
}

export class PreKeyWhisperMessage extends PreKeyWhisperMessageOrig {
  static decode(data, encoding) {
    return PreKeyWhisperMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return PreKeyWhisperMessageOrig.encode(this).finish().buffer;
  }
}

export class ProvisionEnvelope extends ProvisionEnvelopeOrig {
  static decode(data, encoding) {
    return ProvisionEnvelopeOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return ProvisionEnvelopeOrig.encode(this).finish().buffer;
  }
}

export class ProvisioningUuid extends ProvisioningUuidOrig {
  static decode(data, encoding) {
    return ProvisioningUuidOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return ProvisioningUuidOrig.encode(this).finish().buffer;
  }
}

export class ProvisionMessage extends ProvisionMessageOrig {
  static decode(data, encoding) {
    return ProvisionMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return ProvisionMessageOrig.encode(this).finish().buffer;
  }
}

export const ProvisioningVersion = {
  ...ProvisioningVersionOrig,
  decode(data, encoding) {
    return ProvisioningVersionOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  },
  encode() {
    return this;
  },
  toArrayBuffer() {
    return ProvisioningVersionOrig.encode(this).finish().buffer;
  },
}

export class ReadOperation extends ReadOperationOrig {
  static decode(data, encoding) {
    return ReadOperationOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return ReadOperationOrig.encode(this).finish().buffer;
  }
}

export class ReceiptMessage extends ReceiptMessageOrig {
  static decode(data, encoding) {
    return ReceiptMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return ReceiptMessageOrig.encode(this).finish().buffer;
  }
}

export class SenderCertificate extends SenderCertificateOrig {
  static decode(data, encoding) {
    return SenderCertificateOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return SenderCertificateOrig.encode(this).finish().buffer;
  }
}

export class ServerCertificate extends ServerCertificateOrig {
  static decode(data, encoding) {
    return ServerCertificateOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return ServerCertificateOrig.encode(this).finish().buffer;
  }
}

export class StickerPack extends StickerPackOrig {
  static decode(data, encoding) {
    return StickerPackOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return StickerPackOrig.encode(this).finish().buffer;
  }
}

export class StorageItem extends StorageItemOrig {
  static decode(data, encoding) {
    return StorageItemOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return StorageItemOrig.encode(this).finish().buffer;
  }
}

export class StorageItems extends StorageItemsOrig {
  static decode(data, encoding) {
    return StorageItemsOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return StorageItemsOrig.encode(this).finish().buffer;
  }
}

export class StorageManifest extends StorageManifestOrig {
  static decode(data, encoding) {
    return StorageManifestOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return StorageManifestOrig.encode(this).finish().buffer;
  }
}

export class StorageRecord extends StorageRecordOrig {
  static decode(data, encoding) {
    return StorageRecordOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return StorageRecordOrig.encode(this).finish().buffer;
  }
}

export class SyncMessage extends SyncMessageOrig {
  static decode(data, encoding) {
    return SyncMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return SyncMessageOrig.encode(this).finish().buffer;
  }
}

export class TypingMessage extends TypingMessageOrig {
  static decode(data, encoding) {
    return TypingMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return TypingMessageOrig.encode(this).finish().buffer;
  }
}

export class UnidentifiedSenderMessage extends UnidentifiedSenderMessageOrig {
  static decode(data, encoding) {
    return UnidentifiedSenderMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return UnidentifiedSenderMessageOrig.encode(this).finish().buffer;
  }
}

export class Verified extends VerifiedOrig {
  static decode(data, encoding) {
    return VerifiedOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return VerifiedOrig.encode(this).finish().buffer;
  }
}

export class WebSocketMessage extends WebSocketMessageOrig {
  static decode(data, encoding) {
    const message = WebSocketMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
    return convertBuffers(message);
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return WebSocketMessageOrig.encode(this).finish().buffer;
  }
}

export class WebSocketRequestMessage extends WebSocketRequestMessageOrig {
  static decode(data, encoding) {
    return WebSocketRequestMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return WebSocketRequestMessageOrig.encode(this).finish().buffer;
  }
}

export class WebSocketResponseMessage extends WebSocketResponseMessageOrig {
  static decode(data, encoding) {
    return WebSocketResponseMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return WebSocketResponseMessageOrig.encode(this).finish().buffer;
  }
}

export class WhisperMessage extends WhisperMessageOrig {
  static decode(data, encoding) {
    return WhisperMessageOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return WhisperMessageOrig.encode(this).finish().buffer;
  }
}

export class WriteOperation extends WriteOperationOrig {
  static decode(data, encoding) {
    return WriteOperationOrig.decode(new Uint8Array(data instanceof ByteBufferClass ? data.buffer : data));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return WriteOperationOrig.encode(this).finish().buffer;
  }
}
