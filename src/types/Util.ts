// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type BodyRangeType = {
  start: number;
  length: number;
  mentionUuid: string;
  replacementText: string;
  conversationID?: string;
};

export type BodyRangesType = Array<BodyRangeType>;

export type ReplacementValuesType = {
  [key: string]: string | undefined;
};

export type LocalizerType = (
  key: string,
  values?: Array<string | null> | ReplacementValuesType
) => string;