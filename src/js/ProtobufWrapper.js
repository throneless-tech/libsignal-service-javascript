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

const decodeBuffers = (message) => {
  for (const prop in message) {
    if (message.hasOwnProperty(prop)) {
      if (message[prop] instanceof Uint8Array) {
        message[prop] = ByteBufferClass.wrap(message[prop]);
      } else if (typeof message[prop] === 'object' && message[prop] !== null && !(message[prop] instanceof ByteBufferClass)) {
        message[prop] = decodeBuffers(message[prop]);
      }
    }
  }
  return message;
}

const encodeBuffers = (message) => {
  for (const prop in message) {
    if (message.hasOwnProperty(prop)) {
      if (message[prop] instanceof ArrayBuffer) {
        message[prop] = new Uint8Array(message[prop]);
      } else if (typeof message[prop] === 'object' && message[prop] !== null && !(message[prop] instanceof Uint8Array)) {
        message[prop] = encodeBuffers(message[prop]);
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
    return decodeBuffers(AccessControlOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(AccessControlOrig.encode(encodeBuffers(this)).finish());
  }
}

export class AccountRecord extends AccountRecordOrig {
  static decode(data, encoding) {
    return decodeBuffers(AccountRecordOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(AccountRecordOrig.encode(encodeBuffers(this)).finish());
  }
}

export class AttachmentPointer extends AttachmentPointerOrig {
  static decode(data, encoding) {
    return decodeBuffers(AttachmentPointerOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(AttachmentPointerOrig.encode(encodeBuffers(this)).finish());
  }
}

export class AvatarUploadAttributes extends AvatarUploadAttributesOrig {
  static decode(data, encoding) {
    return decodeBuffers(AvatarUploadAttributesOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(AvatarUploadAttributesOrig.encode(encodeBuffers(this)).finish());
  }
}

export class CallingMessage extends CallingMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(CallingMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(CallingMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export class ContactDetails extends ContactDetailsOrig {
  static decode(data, encoding) {
    return decodeBuffers(ContactDetailsOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(ContactDetailsOrig.encode(encodeBuffers(this)).finish());
  }
}

export class ContactRecord extends ContactRecordOrig {
  static decode(data, encoding) {
    return decodeBuffers(ContactRecordOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(ContactRecordOrig.encode(encodeBuffers(this)).finish());
  }
}

export class Content extends ContentOrig {
  static decode(data, encoding) {
    return decodeBuffers(ContentOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(ContentOrig.encode(encodeBuffers(this)).finish());
  }
}

export class DataMessage extends DataMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(DataMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(DataMessageOrig.encode(encodeBuffers(this)).finish());
  }
}
export class DeviceName extends DeviceNameOrig {
  static decode(data, encoding) {
    return decodeBuffers(DeviceNameOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(DeviceNameOrig.encode(encodeBuffers(this)).finish());
  }
}

export class Envelope extends EnvelopeOrig {
  static decode(data, encoding) {
    return decodeBuffers(EnvelopeOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(EnvelopeOrig.encode(encodeBuffers(this)).finish());
  }
}

export class Group extends GroupOrig {
  static decode(data, encoding) {
    return decodeBuffers(GroupOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(GroupOrig.encode(encodeBuffers(this)).finish());
  }
}

export class GroupAttributeBlob extends GroupAttributeBlobOrig {
  static decode(data, encoding) {
    return decodeBuffers(GroupAttributeBlobOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(GroupAttributeBlobOrig.encode(encodeBuffers(this)).finish());
  }
}

export class GroupChange extends GroupChangeOrig {
  static decode(data, encoding) {
    return decodeBuffers(GroupChangeOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(GroupChangeOrig.encode(encodeBuffers(this)).finish());
  }
}

export class GroupChanges extends GroupChangesOrig {
  static decode(data, encoding) {
    return decodeBuffers(GroupChangesOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(GroupChangesOrig.encode(encodeBuffers(this)).finish());
  }
}

export class GroupContext extends GroupContextOrig {
  static decode(data, encoding) {
    return decodeBuffers(GroupContextOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(GroupContextOrig.encode(encodeBuffers(this)).finish());
  }
}

export class GroupContextV2 extends GroupContextV2Orig {
  static decode(data, encoding) {
    return decodeBuffers(GroupContextV2Orig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(GroupContextV2Orig.encode(encodeBuffers(this)).finish());
  }
}

export class GroupDetails extends GroupDetailsOrig {
  static decode(data, encoding) {
    return decodeBuffers(GroupDetailsOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(GroupDetailsOrig.encode(encodeBuffers(this)).finish());
  }
}

export class GroupExternalCredential extends GroupExternalCredentialOrig {
  static decode(data, encoding) {
    return decodeBuffers(GroupExternalCredentialOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(GroupExternalCredentialOrig.encode(encodeBuffers(this)).finish());
  }
}

export class GroupInviteLink extends GroupInviteLinkOrig {
  static decode(data, encoding) {
    return decodeBuffers(GroupInviteLinkOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(GroupInviteLinkOrig.encode(encodeBuffers(this)).finish());
  }
}

export class GroupJoinInfo extends GroupJoinInfoOrig {
  static decode(data, encoding) {
    return decodeBuffers(GroupJoinInfoOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(GroupJoinInfoOrig.encode(encodeBuffers(this)).finish());
  }
}

export class GroupV1Record extends GroupV1RecordOrig {
  static decode(data, encoding) {
    return decodeBuffers(GroupV1RecordOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(GroupV1RecordOrig.encode(encodeBuffers(this)).finish());
  }
}

export class GroupV2Record extends GroupV2RecordOrig {
  static decode(data, encoding) {
    return decodeBuffers(GroupV2RecordOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(GroupV2RecordOrig.encode(encodeBuffers(this)).finish());
  }
}

export class KeyExchangeMessage extends KeyExchangeMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(KeyExchangeMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(KeyExchangeMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export class ManifestRecord extends ManifestRecordOrig {
  static decode(data, encoding) {
    return decodeBuffers(ManifestRecordOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(ManifestRecordOrig.encode(encodeBuffers(this)).finish());
  }
}

export class Member extends MemberOrig {
  static decode(data, encoding) {
    return decodeBuffers(MemberOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(MemberOrig.encode(encodeBuffers(this)).finish());
  }
}

export class MemberPendingAdminApproval extends MemberPendingAdminApprovalOrig {
  static decode(data, encoding) {
    return decodeBuffers(MemberPendingAdminApprovalOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(MemberPendingAdminApprovalOrig.encode(encodeBuffers(this)).finish());
  }
}

export class MemberPendingProfileKey extends MemberPendingProfileKeyOrig {
  static decode(data, encoding) {
    return decodeBuffers(MemberPendingProfileKeyOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(MemberPendingProfileKeyOrig.encode(encodeBuffers(this)).finish());
  }
}

export class NullMessage extends NullMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(NullMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(NullMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export class PreKeyWhisperMessage extends PreKeyWhisperMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(PreKeyWhisperMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(PreKeyWhisperMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export class ProvisionEnvelope extends ProvisionEnvelopeOrig {
  static decode(data, encoding) {
    return decodeBuffers(ProvisionEnvelopeOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(ProvisionEnvelopeOrig.encode(encodeBuffers(this)).finish());
  }
}

export class ProvisioningUuid extends ProvisioningUuidOrig {
  static decode(data, encoding) {
    return decodeBuffers(ProvisioningUuidOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(ProvisioningUuidOrig.encode(encodeBuffers(this)).finish());
  }
}

export class ProvisionMessage extends ProvisionMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(ProvisionMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(ProvisionMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export const ProvisioningVersion = {
  ...ProvisioningVersionOrig,
  decode(data, encoding) {
    return decodeBuffers(ProvisioningVersionOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  },
  encode() {
    return encodeBuffers(this);
  },
  toArrayBuffer() {
    return b2ab(ProvisioningVersionOrig.encode(encodeBuffers(this)).finish());
  },
}

export class ReadOperation extends ReadOperationOrig {
  static decode(data, encoding) {
    return decodeBuffers(ReadOperationOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(ReadOperationOrig.encode(encodeBuffers(this)).finish());
  }
}

export class ReceiptMessage extends ReceiptMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(ReceiptMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(ReceiptMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export class SenderCertificate extends SenderCertificateOrig {
  static decode(data, encoding) {
    return decodeBuffers(SenderCertificateOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(SenderCertificateOrig.encode(encodeBuffers(this)).finish());
  }
}

export class ServerCertificate extends ServerCertificateOrig {
  static decode(data, encoding) {
    return decodeBuffers(ServerCertificateOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(ServerCertificateOrig.encode(encodeBuffers(this)).finish());
  }
}

export class StickerPack extends StickerPackOrig {
  static decode(data, encoding) {
    return decodeBuffers(StickerPackOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(StickerPackOrig.encode(encodeBuffers(this)).finish());
  }
}

export class StorageItem extends StorageItemOrig {
  static decode(data, encoding) {
    return decodeBuffers(StorageItemOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(StorageItemOrig.encode(encodeBuffers(this)).finish());
  }
}

export class StorageItems extends StorageItemsOrig {
  static decode(data, encoding) {
    return decodeBuffers(StorageItemsOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(StorageItemsOrig.encode(encodeBuffers(this)).finish());
  }
}

export class StorageManifest extends StorageManifestOrig {
  static decode(data, encoding) {
    return decodeBuffers(StorageManifestOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(StorageManifestOrig.encode(encodeBuffers(this)).finish());
  }
}

export class StorageRecord extends StorageRecordOrig {
  static decode(data, encoding) {
    return decodeBuffers(StorageRecordOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(StorageRecordOrig.encode(encodeBuffers(this)).finish());
  }
}

export class SyncMessage extends SyncMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(SyncMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(SyncMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export class TypingMessage extends TypingMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(TypingMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(TypingMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export class UnidentifiedSenderMessage extends UnidentifiedSenderMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(UnidentifiedSenderMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(UnidentifiedSenderMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export class Verified extends VerifiedOrig {
  static decode(data, encoding) {
    return decodeBuffers(VerifiedOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(VerifiedOrig.encode(encodeBuffers(this)).finish());
  }
}

export class WebSocketMessage extends WebSocketMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(WebSocketMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(WebSocketMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export class WebSocketRequestMessage extends WebSocketRequestMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(WebSocketRequestMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(WebSocketRequestMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export class WebSocketResponseMessage extends WebSocketResponseMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(WebSocketResponseMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(WebSocketResponseMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export class WhisperMessage extends WhisperMessageOrig {
  static decode(data, encoding) {
    return decodeBuffers(WhisperMessageOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(WhisperMessageOrig.encode(encodeBuffers(this)).finish());
  }
}

export class WriteOperation extends WriteOperationOrig {
  static decode(data, encoding) {
    return decodeBuffers(WriteOperationOrig.decode(new Uint8Array(ByteBufferClass.isByteBuffer(data) ? data.toArrayBuffer() : b2ab(data))));
  }

  encode() {
    return encodeBuffers(this);
  }

  toArrayBuffer() {
    return b2ab(WriteOperationOrig.encode(encodeBuffers(this)).finish());
  }
}
