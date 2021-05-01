import { compact } from 'lodash';
import { v4 as getGuid } from 'uuid';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  deriveAccessKey,
  fromEncodedBinaryToArrayBuffer,
  getRandomBytes,
} from '../lib/ts/Crypto';
//import { isConversationUnregistered } from '../lib/ts/util/isConversationUnregistered';
import { deriveProfileKeyVersion } from '../lib/ts/util/zkgroup';
import { CallbackResultType } from '../lib/ts/textsecure/SendMessage';
import {
  WhatIsThis
} from './types/window';


export const SEALED_SENDER = {
  UNKNOWN: 0,
  ENABLED: 1,
  DISABLED: 2,
  UNRESTRICTED: 3,
};

export interface ConversationModel {
  id: string;
  uuid: string;
  e164: string;
  draft: string;
  groupId: string;
  groupVersion?: number;
  type: string;
  accessKey?: string;
  sealedSender: number;
  members?: any[];
  membersV2?: any[];
  pendingMembersV2?: any[];
  ourNumber?: string;
  ourUuid?: string;
  version: number;
  profileKeyVersion?: string;
  about?: string;
  isTemporary?: boolean;
  contactCollection?: Conversation[];
}

export class Conversation implements ConversationModel {
  id: string;
  uuid: string;
  e164: string;
  draft: string;
  groupId: string;
  groupVersion?: number;
  type: string;
  accessKey?: string;
  sealedSender: number;
  members?: any[];
  membersV2?: any[];
  pendingMembersV2?: any[];
  ourNumber?: string;
  ourUuid?: string;
  version: number;
  profileKeyVersion?: string;
  about?: string;
  isTemporary?: boolean;
  contactCollection?: Conversation[];

  constructor(attributes: Partial<ConversationModel> = {}) {
    this.sealedSender = SEALED_SENDER.UNKNOWN;
    Object.assign(this, attributes);
    if (window.isValidE164(attributes.id)) {
      this.id = getGuid();
      this.e164 = attributes.id;
    }

    this.ourNumber = window.textsecure.storage.user.getNumber();
    this.ourUuid = window.textsecure.storage.user.getUuid();

    this.contactCollection = [];
  }

  get attributes(): ConversationModel {
    return {
      id: this.id,
      uuid: this.uuid,
      e164: this.e164,
      draft: this.draft,
      groupId: this.groupId,
      groupVersion: this.groupVersion,
      type: this.type,
      accessKey: this.accessKey,
      sealedSender: this.sealedSender,
      members: this.members,
      membersV2: this.membersV2,
      pendingMembersV2: this.pendingMembersV2,
      ourNumber: this.ourNumber,
      ourUuid: this.ourUuid,
      version: this.version,
      profileKeyVersion: this.profileKeyVersion,
      about: this.about,
      isTemporary: this.isTemporary,
      contactCollection: this.contactCollection,
    };
  }

  get(prop: string) {
    return this[prop];
  }

  set(attributes: Partial<ConversationModel>) {
    Object.assign(this, attributes);
  }

  idForLogging(): string {
    if (this.isPrivate()) {
      const uuid = this.uuid;
      const e164 = this.e164;
      return `${uuid || e164} (${this.id})`;
    }
    if (this.isGroupV2()) {
      return `groupv2(${this.groupId})`;
    }

    return `group(${this.groupId})`;
  }

  isMe(): boolean {
    const e164 = this.e164;
    const uuid = this.uuid;
    return Boolean(
      (e164 && e164 === this.ourNumber) || (uuid && uuid === this.ourUuid)
    );
  }

  isGroupV1(): boolean {
    const groupId = this.groupId;
    if (!groupId) {
      return false;
    }

    const buffer = fromEncodedBinaryToArrayBuffer(groupId);
    return buffer.byteLength === window.Signal.Groups.ID_V1_LENGTH;
  }

  isGroupV2(): boolean {
    const groupId = this.groupId;
    if (!groupId) {
      return false;
    }

    const groupVersion = this.groupVersion || 0;

    try {
      return (
        groupVersion === 2 &&
        base64ToArrayBuffer(groupId).byteLength ===
          window.Signal.Groups.ID_LENGTH
      );
    } catch (error) {
      window.log.error('isGroupV2: Failed to process groupId in base64!');
      return false;
    }
  }

  isValid(): boolean {
    return this.isPrivate() || this.isGroupV1() || this.isGroupV2();
  }

  isPrivate(): boolean {
    return this.type === 'private';
  }

  async maybeMigrateV1Group(): Promise<void> {
    if (!this.isGroupV1()) {
      return;
    }

    const isMigrated = await window.Signal.Groups.hasV1GroupBeenMigrated(this);
    if (!isMigrated) {
      return;
    }

    await window.Signal.Groups.waitThenRespondToGroupV2Migration({
      conversation: this,
    });
  }

  getMembers(
    options: { includePendingMembers?: boolean } = {}
  ): Array<Conversation> {
    if (this.isPrivate()) {
      return [this];
    }

    if (this.membersV2) {
      const { includePendingMembers } = options;
      const members: Array<{ conversationId: string }> = includePendingMembers
        ? [
            ...(this.membersV2 || []),
            ...(this.pendingMembersV2 || []),
          ]
        : this.membersV2 || [];

      return compact(
        members.map(member => {
          const c = window.ConversationController.get(member.conversationId);

          // In groups we won't sent to contacts we believe are unregistered
          //if (c && c.isUnregistered()) {
          //  return null;
          //}

          return c;
        })
      );
    }

    if (this.members) {
      return compact(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.members!.map(id => {
          const c = window.ConversationController.get(id);

          // In groups we won't send to contacts we believe are unregistered
          //if (c && c.isUnregistered()) {
          //  return null;
          //}

          return c;
        })
      );
    }

    return [];
  }

  async wrapSend(
    promise: Promise<CallbackResultType | void | null>
  ): Promise<CallbackResultType | void | null> {
    return promise.then(
      async result => {
        // success
        if (result) {
          await this.handleMessageSendResult(
            result.failoverIdentifiers,
            result.unidentifiedDeliveries
          );
        }
        return result;
      },
      async result => {
        // failure
        if (result) {
          await this.handleMessageSendResult(
            result.failoverIdentifiers,
            result.unidentifiedDeliveries
          );
        }
        throw result;
      }
    );
  }

  async handleMessageSendResult(
    failoverIdentifiers: Array<string> | undefined,
    unidentifiedDeliveries: Array<string> | undefined
  ): Promise<void> {
    await Promise.all(
      (failoverIdentifiers || []).map(async identifier => {
        const conversation = window.ConversationController.get(identifier);

        if (
          conversation &&
          conversation.get('sealedSender') !== SEALED_SENDER.DISABLED
        ) {
          window.log.info(
            `Setting sealedSender to DISABLED for conversation ${conversation.idForLogging()}`
          );
          conversation.set({
            sealedSender: SEALED_SENDER.DISABLED,
          });
          window.Signal.Data.updateConversation(conversation.attributes);
        }
      })
    );

    await Promise.all(
      (unidentifiedDeliveries || []).map(async identifier => {
        const conversation = window.ConversationController.get(identifier);

        if (
          conversation &&
          conversation.get('sealedSender') === SEALED_SENDER.UNKNOWN
        ) {
          if (conversation.get('accessKey')) {
            window.log.info(
              `Setting sealedSender to ENABLED for conversation ${conversation.idForLogging()}`
            );
            conversation.set({
              sealedSender: SEALED_SENDER.ENABLED,
            });
          } else {
            window.log.info(
              `Setting sealedSender to UNRESTRICTED for conversation ${conversation.idForLogging()}`
            );
            conversation.set({
              sealedSender: SEALED_SENDER.UNRESTRICTED,
            });
          }
          window.Signal.Data.updateConversation(conversation.attributes);
        }
      })
    );
  }

  getSendOptions(options = {}): WhatIsThis {
    const senderCertificate = window.storage.get('senderCertificate');
    const sendMetadata = this.getSendMetadata(options);

    return {
      senderCertificate,
      sendMetadata,
    };
  }

  getSendMetadata(
    options: { syncMessage?: string; disableMeCheck?: boolean } = {}
  ): WhatIsThis | null {
    const { syncMessage, disableMeCheck } = options;

    // START: this code has an Expiration date of ~2018/11/21
    // We don't want to enable unidentified delivery for send unless it is
    //   also enabled for our own account.
    const myId = window.ConversationController.getOurConversationId();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const me = window.ConversationController.get(myId)!;
    if (!disableMeCheck && me.sealedSender === SEALED_SENDER.DISABLED) {
      return null;
    }
    // END

    if (!this.isPrivate()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const infoArray = this.contactCollection!.map(conversation =>
        conversation.getSendMetadata(options)
      );
      return Object.assign({}, ...infoArray);
    }

    const accessKey = this.accessKey;
    const sealedSender = this.sealedSender;

    // We never send sync messages as sealed sender
    if (syncMessage && this.isMe()) {
      return null;
    }

    const e164 = this.e164;
    const uuid = this.uuid;

    // If we've never fetched user's profile, we default to what we have
    if (sealedSender === SEALED_SENDER.UNKNOWN) {
      const info = {
        accessKey: accessKey || arrayBufferToBase64(getRandomBytes(16)),
      };
      return {
        ...(e164 ? { [e164]: info } : {}),
        ...(uuid ? { [uuid]: info } : {}),
      };
    }

    if (sealedSender === SEALED_SENDER.DISABLED) {
      return null;
    }

    const info = {
      accessKey:
        accessKey && sealedSender === SEALED_SENDER.ENABLED
          ? accessKey
          : arrayBufferToBase64(getRandomBytes(16)),
    };

    return {
      ...(e164 ? { [e164]: info } : {}),
      ...(uuid ? { [uuid]: info } : {}),
    };
  }

  fetchContacts(): void {
    const members = this.getMembers();

    this.contactCollection = members;
  }

  updateE164(e164?: string | null): void {
    const oldValue = this.e164;
    if (e164 && e164 !== oldValue) {
      this.e164 = e164;
      //window.Signal.Data.updateConversation(this.attributes);
      //this.trigger('idUpdated', this, 'e164', oldValue);
    }
  }

  updateUuid(uuid?: string): void {
    const oldValue = this.get('uuid');
    if (uuid && uuid !== oldValue) {
      this.uuid = uuid.toLowerCase();
      //window.Signal.Data.updateConversation(this.attributes);
      //this.trigger('idUpdated', this, 'uuid', oldValue);
    }
  }

  async setProfileKey(
    profileKey: string,
    //{ viaStorageServiceSync = false } = {}
  ): Promise<void> {
    // profileKey is a string so we can compare it directly
    if (this.get('profileKey') !== profileKey) {
      window.log.info(
        `Setting sealedSender to UNKNOWN for conversation ${this.idForLogging()}`
      );
      this.set({
        about: undefined,
        //aboutEmoji: undefined,
        //profileAvatar: undefined,
        //profileKey,
        //profileKeyVersion: undefined,
        //profileKeyCredential: null,
        accessKey: null,
        sealedSender: SEALED_SENDER.UNKNOWN,
      });

      //if (!viaStorageServiceSync) {
      //  this.captureChange('profileKey');
      //}

      await Promise.all([
        this.deriveAccessKeyIfNeeded(),
        this.deriveProfileKeyVersionIfNeeded(),
      ]);
    }
  }

  async deriveAccessKeyIfNeeded(): Promise<void> {
    // isn't this already an array buffer?
    const profileKey = (this.get('profileKey') as unknown) as string;
    if (!profileKey) {
      return;
    }
    if (this.get('accessKey')) {
      return;
    }

    const profileKeyBuffer = base64ToArrayBuffer(profileKey);
    const accessKeyBuffer = await deriveAccessKey(profileKeyBuffer);
    const accessKey = arrayBufferToBase64(accessKeyBuffer);
    this.set({ accessKey });
  }

  async deriveProfileKeyVersionIfNeeded(): Promise<void> {
    const profileKey = this.get('profileKey');
    if (!profileKey) {
      return;
    }

    const uuid = this.get('uuid');
    if (!uuid || this.get('profileKeyVersion')) {
      return;
    }

    const profileKeyVersion = deriveProfileKeyVersion(
      profileKey,
      uuid
    );

    this.set({ profileKeyVersion });
  }

}
