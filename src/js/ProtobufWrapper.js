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
      } else if (typeof message[prop] === 'object' && message[prop] !== null && !(message[prop] instanceof ByteBufferClass)) {
        message[prop] = convertBuffers(message[prop]);
      }
    }
  }
  return message;
}

const b2ab = (buffer) => {
  if (buffer instanceof ArrayBuffer) return buffer;
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export function onLoad(callback) {
    callback();
}

export class AccessControl extends AccessControlOrig {
  static decode(data, encoding) {
    return convertBuffers(AccessControlOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(AccessControlOrig.encode(this).finish());
  }
}

export class AccountRecord extends AccountRecordOrig {
  static decode(data, encoding) {
    return convertBuffers(AccountRecordOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(AccountRecordOrig.encode(this).finish());
  }
}

export class AttachmentPointer extends AttachmentPointerOrig {
  static decode(data, encoding) {
    return convertBuffers(AttachmentPointerOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(AttachmentPointerOrig.encode(this).finish());
  }
}

export class AvatarUploadAttributes extends AvatarUploadAttributesOrig {
  static decode(data, encoding) {
    return convertBuffers(AvatarUploadAttributesOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(AvatarUploadAttributesOrig.encode(this).finish());
  }
}

export class CallingMessage extends CallingMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(CallingMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(CallingMessageOrig.encode(this).finish());
  }
}

export class ContactDetails extends ContactDetailsOrig {
  static decode(data, encoding) {
    return convertBuffers(ContactDetailsOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(ContactDetailsOrig.encode(this).finish());
  }
}

export class ContactRecord extends ContactRecordOrig {
  static decode(data, encoding) {
    return convertBuffers(ContactRecordOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(ContactRecordOrig.encode(this).finish());
  }
}

export class Content extends ContentOrig {
  static decode(data, encoding) {
    return convertBuffers(ContentOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(ContentOrig.encode(this).finish());
  }
}

export class DataMessage extends DataMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(DataMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(DataMessageOrig.encode(this).finish());
  }
}
export class DeviceName extends DeviceNameOrig {
  static decode(data, encoding) {
    return convertBuffers(DeviceNameOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(DeviceNameOrig.encode(this).finish());
  }
}

export class Envelope extends EnvelopeOrig {
  static decode(data, encoding) {
    return convertBuffers(EnvelopeOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(EnvelopeOrig.encode(this).finish());
  }
}

export class Group extends GroupOrig {
  static decode(data, encoding) {
    return convertBuffers(GroupOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(GroupOrig.encode(this).finish());
  }
}

export class GroupAttributeBlob extends GroupAttributeBlobOrig {
  static decode(data, encoding) {
    return convertBuffers(GroupAttributeBlobOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(GroupAttributeBlobOrig.encode(this).finish());
  }
}

export class GroupChange extends GroupChangeOrig {
  static decode(data, encoding) {
    return convertBuffers(GroupChangeOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(GroupChangeOrig.encode(this).finish());
  }
}

export class GroupChanges extends GroupChangesOrig {
  static decode(data, encoding) {
    return convertBuffers(GroupChangesOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(GroupChangesOrig.encode(this).finish());
  }
}

export class GroupContext extends GroupContextOrig {
  static decode(data, encoding) {
    return convertBuffers(GroupContextOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(GroupContextOrig.encode(this).finish());
  }
}

export class GroupContextV2 extends GroupContextV2Orig {
  static decode(data, encoding) {
    return convertBuffers(GroupContextV2Orig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(GroupContextV2Orig.encode(this).finish());
  }
}

export class GroupDetails extends GroupDetailsOrig {
  static decode(data, encoding) {
    return convertBuffers(GroupDetailsOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(GroupDetailsOrig.encode(this).finish());
  }
}

export class GroupExternalCredential extends GroupExternalCredentialOrig {
  static decode(data, encoding) {
    return convertBuffers(GroupExternalCredentialOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(GroupExternalCredentialOrig.encode(this).finish());
  }
}

export class GroupInviteLink extends GroupInviteLinkOrig {
  static decode(data, encoding) {
    return convertBuffers(GroupInviteLinkOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(GroupInviteLinkOrig.encode(this).finish());
  }
}

export class GroupJoinInfo extends GroupJoinInfoOrig {
  static decode(data, encoding) {
    return convertBuffers(GroupJoinInfoOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(GroupJoinInfoOrig.encode(this).finish());
  }
}

export class GroupV1Record extends GroupV1RecordOrig {
  static decode(data, encoding) {
    return convertBuffers(GroupV1RecordOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(GroupV1RecordOrig.encode(this).finish());
  }
}

export class GroupV2Record extends GroupV2RecordOrig {
  static decode(data, encoding) {
    return convertBuffers(GroupV2RecordOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(GroupV2RecordOrig.encode(this).finish());
  }
}

export class KeyExchangeMessage extends KeyExchangeMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(KeyExchangeMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(KeyExchangeMessageOrig.encode(this).finish());
  }
}

export class ManifestRecord extends ManifestRecordOrig {
  static decode(data, encoding) {
    return convertBuffers(ManifestRecordOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(ManifestRecordOrig.encode(this).finish());
  }
}

export class Member extends MemberOrig {
  static decode(data, encoding) {
    return convertBuffers(MemberOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(MemberOrig.encode(this).finish());
  }
}

export class MemberPendingAdminApproval extends MemberPendingAdminApprovalOrig {
  static decode(data, encoding) {
    return convertBuffers(MemberPendingAdminApprovalOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(MemberPendingAdminApprovalOrig.encode(this).finish());
  }
}

export class MemberPendingProfileKey extends MemberPendingProfileKeyOrig {
  static decode(data, encoding) {
    return convertBuffers(MemberPendingProfileKeyOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(MemberPendingProfileKeyOrig.encode(this).finish());
  }
}

export class NullMessage extends NullMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(NullMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(NullMessageOrig.encode(this).finish());
  }
}

export class PreKeyWhisperMessage extends PreKeyWhisperMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(PreKeyWhisperMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(PreKeyWhisperMessageOrig.encode(this).finish());
  }
}

export class ProvisionEnvelope extends ProvisionEnvelopeOrig {
  static decode(data, encoding) {
    return convertBuffers(ProvisionEnvelopeOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(ProvisionEnvelopeOrig.encode(this).finish());
  }
}

export class ProvisioningUuid extends ProvisioningUuidOrig {
  static decode(data, encoding) {
    return convertBuffers(ProvisioningUuidOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(ProvisioningUuidOrig.encode(this).finish());
  }
}

export class ProvisionMessage extends ProvisionMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(ProvisionMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(ProvisionMessageOrig.encode(this).finish());
  }
}

export const ProvisioningVersion = {
  ...ProvisioningVersionOrig,
  decode(data, encoding) {
    return convertBuffers(ProvisioningVersionOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  },
  encode() {
    return this;
  },
  toArrayBuffer() {
    return b2ab(ProvisioningVersionOrig.encode(this).finish());
  },
}

export class ReadOperation extends ReadOperationOrig {
  static decode(data, encoding) {
    return convertBuffers(ReadOperationOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(ReadOperationOrig.encode(this).finish());
  }
}

export class ReceiptMessage extends ReceiptMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(ReceiptMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(ReceiptMessageOrig.encode(this).finish());
  }
}

export class SenderCertificate extends SenderCertificateOrig {
  static decode(data, encoding) {
    return convertBuffers(SenderCertificateOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(SenderCertificateOrig.encode(this).finish());
  }
}

export class ServerCertificate extends ServerCertificateOrig {
  static decode(data, encoding) {
    return convertBuffers(ServerCertificateOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(ServerCertificateOrig.encode(this).finish());
  }
}

export class StickerPack extends StickerPackOrig {
  static decode(data, encoding) {
    return convertBuffers(StickerPackOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(StickerPackOrig.encode(this).finish());
  }
}

export class StorageItem extends StorageItemOrig {
  static decode(data, encoding) {
    return convertBuffers(StorageItemOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(StorageItemOrig.encode(this).finish());
  }
}

export class StorageItems extends StorageItemsOrig {
  static decode(data, encoding) {
    return convertBuffers(StorageItemsOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(StorageItemsOrig.encode(this).finish());
  }
}

export class StorageManifest extends StorageManifestOrig {
  static decode(data, encoding) {
    return convertBuffers(StorageManifestOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(StorageManifestOrig.encode(this).finish());
  }
}

export class StorageRecord extends StorageRecordOrig {
  static decode(data, encoding) {
    return convertBuffers(StorageRecordOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(StorageRecordOrig.encode(this).finish());
  }
}

export class SyncMessage extends SyncMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(SyncMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(SyncMessageOrig.encode(this).finish());
  }
}

export class TypingMessage extends TypingMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(TypingMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(TypingMessageOrig.encode(this).finish());
  }
}

export class UnidentifiedSenderMessage extends UnidentifiedSenderMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(UnidentifiedSenderMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(UnidentifiedSenderMessageOrig.encode(this).finish());
  }
}

export class Verified extends VerifiedOrig {
  static decode(data, encoding) {
    return convertBuffers(VerifiedOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(VerifiedOrig.encode(this).finish());
  }
}

export class WebSocketMessage extends WebSocketMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(WebSocketMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(WebSocketMessageOrig.encode(this).finish());
  }
}

export class WebSocketRequestMessage extends WebSocketRequestMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(WebSocketRequestMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(WebSocketRequestMessageOrig.encode(this).finish());
  }
}

export class WebSocketResponseMessage extends WebSocketResponseMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(WebSocketResponseMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(WebSocketResponseMessageOrig.encode(this).finish());
  }
}

export class WhisperMessage extends WhisperMessageOrig {
  static decode(data, encoding) {
    return convertBuffers(WhisperMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(WhisperMessageOrig.encode(this).finish());
  }
}

export class WriteOperation extends WriteOperationOrig {
  static decode(data, encoding) {
    return convertBuffers(WriteOperationOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return this;
  }

  toArrayBuffer() {
    return b2ab(WriteOperationOrig.encode(this).finish());
  }
}
