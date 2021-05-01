// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  deriveGroupID,
  deriveGroupPublicParams,
  deriveGroupSecretParams,
} from '../../lib/ts/util/zkgroup';
import {
  Conversation
} from '../Conversation';
import {
  arrayBufferToBase64,
  deriveMasterKeyFromGroupV1,
  fromEncodedBinaryToArrayBuffer
} from '../../lib/ts/Crypto';

// Constants

export const MASTER_KEY_LENGTH = 32;

// Utility

export function deriveGroupFields(
  masterKey: ArrayBuffer
): { id: ArrayBuffer; secretParams: ArrayBuffer; publicParams: ArrayBuffer } {
  const secretParams = deriveGroupSecretParams(masterKey);
  const publicParams = deriveGroupPublicParams(secretParams);
  const id = deriveGroupID(secretParams);

  return {
    id,
    secretParams,
    publicParams,
  };
}

// Migrating a group

export async function maybeDeriveGroupV2Id(
  conversation: Conversation
): Promise<boolean> {
  const isGroupV1 = conversation.isGroupV1();
  const groupV1Id = conversation.get('groupId');
  const derived = conversation.get('derivedGroupV2Id');

  if (!isGroupV1 || !groupV1Id || derived) {
    return false;
  }

  const v1IdBuffer = fromEncodedBinaryToArrayBuffer(groupV1Id);
  const masterKeyBuffer = await deriveMasterKeyFromGroupV1(v1IdBuffer);
  const fields = deriveGroupFields(masterKeyBuffer);
  const derivedGroupV2Id = arrayBufferToBase64(fields.id);

  conversation.set({
    groupId: derivedGroupV2Id,
  });

  return true;
}
