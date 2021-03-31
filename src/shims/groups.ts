// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  deriveGroupID,
  deriveGroupPublicParams,
  deriveGroupSecretParams,
} from '../../lib/ts/util/zkgroup';

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
