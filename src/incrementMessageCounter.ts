//*** ts/util/incrementMessageCounter.ts
// Derived from or implements the interfaces in the above file from
// https://github.com/signalapp/Signal-Desktop which was made available under
// the following license:
//
// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce } from 'lodash';

export function incrementMessageCounter(): number {
  if (!window.receivedAtCounter) {
    window.receivedAtCounter =
      Number(window.textsecure.storage.get('lastReceivedAtCounter')) || Date.now();
  }

  window.receivedAtCounter += 1;
  debouncedUpdateLastReceivedAt();

  return window.receivedAtCounter;
}

const debouncedUpdateLastReceivedAt = debounce(() => {
  window.textsecure.storage.put(
    'lastReceivedAtCounter',
    String(window.receivedAtCounter)
  );
}, 500);
