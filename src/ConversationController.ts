// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { uniq, without } from 'lodash';
import { v4 as getGuid } from 'uuid';

import {
  StorageConversations
} from './StorageWrapper';

import {
  WhatIsThis
} from './types/window';

// needed
import { SendOptionsType, CallbackResultType } from '../lib/ts/textsecure/SendMessage';
// needed
import { ConversationModel, Conversation } from './Conversation';
// needed
//import { maybeDeriveGroupV2Id } from './shims/groups';
import { assert } from '../lib/ts/util/assert';

export type ConversationAttributesTypeType = 'private' | 'group';

export class ConversationController {
  private _conversations: StorageConversations;

  // needed
  constructor(conversations: StorageConversations) {
    this._conversations = conversations;
  }

  // needed
  get(id?: string | null): Conversation | undefined {
    if (!this._conversations.ready) {
      throw new Error(
        'ConversationController.get() needs complete initial fetch'
      );
    }

    // This function takes null just fine. Backbone typings are too restrictive.
    return this._conversations.get(id as string);
  }

  // needed
  getOrCreate(
    identifier: string | null,
    type: ConversationAttributesTypeType,
    additionalInitialProps = {}
  ): Conversation {
    if (typeof identifier !== 'string') {
      throw new TypeError("'id' must be a string");
    }

    if (type !== 'private' && type !== 'group') {
      throw new TypeError(
        `'type' must be 'private' or 'group'; got: '${type}'`
      );
    }

    if (!this._conversations.ready) {
      throw new Error(
        'ConversationController.get() needs complete initial fetch'
      );
    }

    let conversation = this._conversations.get(identifier);
    if (conversation) {
      return conversation;
    }

    const id = getGuid();

    if (type === 'group') {
      conversation = this._conversations.add({
        id,
        uuid: null,
        e164: null,
        groupId: identifier,
        type,
        version: 2,
        ...additionalInitialProps,
      });
    } else if (window.isValidGuid(identifier)) {
      conversation = this._conversations.add({
        id,
        uuid: identifier,
        e164: null,
        groupId: null,
        type,
        version: 2,
        ...additionalInitialProps,
      });
    } else {
      conversation = this._conversations.add({
        id,
        uuid: null,
        e164: identifier,
        groupId: null,
        type,
        version: 2,
        ...additionalInitialProps,
      });
    }

    //const create = async () => {
    //  if (!conversation.isValid()) {
    //    const validationError = conversation.validationError || {};
    //    window.log.error(
    //      'Contact is not valid. Not saving, but adding to collection:',
    //      conversation.idForLogging(),
    //      validationError.stack
    //    );

    //    return conversation;
    //  }

    //  try {
    //    if (conversation.isGroupV1()) {
    //      await maybeDeriveGroupV2Id(conversation);
    //    }
    //    await this._conversations.addAndAwait(conversation.attributes);
    //  } catch (error) {
    //    window.log.error(
    //      'Conversation save failed! ',
    //      identifier,
    //      type,
    //      'Error:',
    //      error && error.stack ? error.stack : error
    //    );
    //    throw error;
    //  }

    //  return conversation;
    //};

    //conversation.initialPromise = create();
    this._conversations.add(conversation.attributes);

    return conversation;
  }

  // needed
  async getOrCreateAndWait(
    id: string | null,
    type: ConversationAttributesTypeType,
    additionalInitialProps = {}
  ): Promise<ConversationModel> {
    const conversation = this.getOrCreate(id, type, additionalInitialProps);

    if (conversation) {
      return conversation;
    }

    throw new Error('getOrCreateAndWait: did not get conversation');
  }

  // needed
  getConversationId(address: string | null): string | null {
    if (!address) {
      return null;
    }

    const [id] = window.textsecure.utils.unencodeNumber(address);
    const conv = this.get(id);

    if (conv) {
      return conv.id;
    }

    return null;
  }

  getOurConversationId(): string | undefined {
    const e164 = window.textsecure.storage.user.getNumber();
    const uuid = window.textsecure.storage.user.getUuid();
    return this.ensureContactIds({ e164, uuid, highTrust: true });
  }

  getOurConversationIdOrThrow(): string {
    const conversationId = this.getOurConversationId();
    if (!conversationId) {
      throw new Error(
        'getOurConversationIdOrThrow: Failed to fetch ourConversationId'
      );
    }
    return conversationId;
  }

  // needed
  /**
   * Given a UUID and/or an E164, resolves to a string representing the local
   * database id of the given contact. In high trust mode, it may create new contacts,
   * and it may merge contacts.
   *
   * highTrust = uuid/e164 pairing came from CDS, the server, or your own device
   */
  ensureContactIds({
    e164,
    uuid,
    highTrust,
  }: {
    e164?: string | null;
    uuid?: string | null;
    highTrust?: boolean;
  }): string | undefined {
    // Check for at least one parameter being provided. This is necessary
    // because this path can be called on startup to resolve our own ID before
    // our phone number or UUID are known. The existing behavior in these
    // cases can handle a returned `undefined` id, so we do that.
    const normalizedUuid = uuid ? uuid.toLowerCase() : undefined;
    const identifier = normalizedUuid || e164;

    if ((!e164 && !uuid) || !identifier) {
      return undefined;
    }

    const convoE164 = this.get(e164);
    const convoUuid = this.get(normalizedUuid);

    // 1. Handle no match at all
    if (!convoE164 && !convoUuid) {
      window.log.info(
        'ensureContactIds: Creating new contact, no matches found'
      );
      const newConvo = this.getOrCreate(identifier, 'private');
      if (highTrust && e164) {
        newConvo.updateE164(e164);
      }
      if (normalizedUuid) {
        newConvo.updateUuid(normalizedUuid);
      }
      if ((highTrust && e164) || normalizedUuid) {
        this._conversations.add(newConvo.attributes);
      }

      return newConvo.get('id');

      // 2. Handle match on only E164
    }
    if (convoE164 && !convoUuid) {
      const haveUuid = Boolean(normalizedUuid);
      window.log.info(
        `ensureContactIds: e164-only match found (have UUID: ${haveUuid})`
      );
      // If we are only searching based on e164 anyway, then return the first result
      if (!normalizedUuid) {
        return convoE164.get('id');
      }

      // Fill in the UUID for an e164-only contact
      if (normalizedUuid && !convoE164.get('uuid')) {
        if (highTrust) {
          window.log.info('ensureContactIds: Adding UUID to e164-only match');
          convoE164.updateUuid(normalizedUuid);
          this._conversations.add(convoE164.attributes);
        }
        return convoE164.get('id');
      }

      window.log.info(
        'ensureContactIds: e164 already had UUID, creating a new contact'
      );
      // If existing e164 match already has UUID, create a new contact...
      const newConvo = this.getOrCreate(normalizedUuid, 'private');

      if (highTrust) {
        window.log.info(
          'ensureContactIds: Moving e164 from old contact to new'
        );

        // Remove the e164 from the old contact...
        convoE164.set({ e164: undefined });
        this._conversations.add(convoE164.attributes);

        // ...and add it to the new one.
        newConvo.updateE164(e164);
        this._conversations.add(newConvo.attributes);
      }

      return newConvo.get('id');

      // 3. Handle match on only UUID
    }
    if (!convoE164 && convoUuid) {
      if (e164 && highTrust) {
        window.log.info('ensureContactIds: Adding e164 to UUID-only match');
        convoUuid.updateE164(e164);
        this._conversations.add(convoUuid.attributes);
      }
      return convoUuid.get('id');
    }

    // For some reason, TypeScript doesn't believe that we can trust that these two values
    //   are truthy by this point. So we'll throw if we get there.
    if (!convoE164 || !convoUuid) {
      throw new Error('ensureContactIds: convoE164 or convoUuid are falsey!');
    }

    // Now, we know that we have a match for both e164 and uuid checks

    if (convoE164 === convoUuid) {
      return convoUuid.get('id');
    }

    if (highTrust) {
      // Conflict: If e164 match already has a UUID, we remove its e164.
      if (convoE164.get('uuid') && convoE164.get('uuid') !== normalizedUuid) {
        window.log.info(
          'ensureContactIds: e164 match had different UUID than incoming pair, removing its e164.'
        );

        // Remove the e164 from the old contact...
        convoE164.set({ e164: undefined });
        this._conversations.add(convoE164.attributes);

        // ...and add it to the new one.
        convoUuid.updateE164(e164);
        this._conversations.add(convoUuid.attributes);

        return convoUuid.get('id');
      }

      window.log.warn(
        `ensureContactIds: Found a split contact - UUID ${normalizedUuid} and E164 ${e164}. Merging.`
      );

      // Conflict: If e164 match has no UUID, we merge. We prefer the UUID match.
      // Note: no await here, we want to keep this function synchronous
      convoUuid.updateE164(e164);
      // `then` is used to trigger async updates, not affecting return value
      // eslint-disable-next-line more/no-then
      this.combineConversations(convoUuid, convoE164)
        .catch(error => {
          const errorText = error && error.stack ? error.stack : error;
          window.log.warn(
            `ensureContactIds error combining contacts: ${errorText}`
          );
        });
    }

    return convoUuid.get('id');
  }

  // needed
  async combineConversations(
    current: Conversation,
    obsolete: Conversation,
  ): Promise<void> {
    const conversationType = current.get('type');

    if (obsolete.get('type') !== conversationType) {
      assert(
        false,
        'combineConversations cannot combine a private and group conversation. Doing nothing'
      );
    }

    const obsoleteId = obsolete.get('id');
    const currentId = current.get('id');
    window.log.warn('combineConversations: Combining two conversations', {
      obsolete: obsoleteId,
      current: currentId,
    });

    if (conversationType === 'private') {
      if (!current.get('profileKey') && obsolete.get('profileKey')) {
        window.log.warn(
          'combineConversations: Copying profile key from old to new contact'
        );

        const profileKey = obsolete.get('profileKey');

        if (profileKey) {
          await current.setProfileKey(profileKey);
          await this._conversations.addAndAwait(current.attributes);
        }
      }

      window.log.warn(
        'combineConversations: Delete all sessions tied to old conversationId'
      );
      const deviceIds = await window.textsecure.storage.protocol.getDeviceIds(
        obsoleteId
      );
      await Promise.all(
        deviceIds.map(async deviceId => {
          await window.textsecure.storage.protocol.removeSession(
            `${obsoleteId}.${deviceId}`
          );
        })
      );

      window.log.warn(
        'combineConversations: Delete all identity information tied to old conversationId'
      );
      await window.textsecure.storage.protocol.removeIdentityKey(obsoleteId);

      window.log.warn(
        'combineConversations: Ensure that all V1 groups have new conversationId instead of old'
      );
      const groups = await this.getAllGroupsInvolvingId(obsoleteId);
      groups.forEach(group => {
        const members = group.get('members');
        const withoutObsolete = without(members, obsoleteId);
        const currentAdded = uniq([...withoutObsolete, currentId]);

        group.set({
          members: currentAdded,
        });
        this._conversations.add(group.attributes);
      });
    }

    // Note: we explicitly don't want to update V2 groups

    window.log.warn(
      'combineConversations: Delete the obsolete conversation from the database'
    );
    await this._conversations.removeAndAwait(obsoleteId);

    window.log.warn('combineConversations: Update messages table');
    await this._conversations.migrateConversationMessages(obsoleteId, currentId);

    window.log.warn(
      'combineConversations: Eliminate old conversation from ConversationController lookups'
    );
    this._conversations.remove(obsoleteId);

    window.log.warn('combineConversations: Complete!', {
      obsolete: obsoleteId,
      current: currentId,
    });
  }

  // needed
  prepareForSend(
    id: string | undefined,
    options?: WhatIsThis
  ): {
    wrap: (
      promise: Promise<CallbackResultType | void | null>
    ) => Promise<CallbackResultType | void | null>;
    sendOptions: SendOptionsType | undefined;
  } {
    // id is any valid conversation identifier
    const conversation = this.get(id);
    const sendOptions = conversation
      ? conversation.getSendOptions(options)
      : undefined;
    const wrap = conversation
      ? conversation.wrapSend.bind(conversation)
      : async (promise: Promise<CallbackResultType | void | null>) => promise;

    return { wrap, sendOptions };
  }

  // needed
  async getAllGroupsInvolvingId(
    conversationId: string
  ): Promise<Array<Conversation>> {
    const groups = await this._conversations.getAllGroupsInvolvingId(conversationId);
    return groups.map(group => {
      const existing = this.get(group.id);
      if (existing) {
        return existing;
      }

      return this._conversations.add(group);
    });
  }

  // needed
  reset(): void {
    this._conversations.reset();
  }

  // needed
  async load(): Promise<void> {
    window.log.info('ConversationController: starting initial fetch');

    if (this._conversations.ready) {
      throw new Error('ConversationController: Already loaded!');
    }

    await this._conversations.fetch();
  }
}
