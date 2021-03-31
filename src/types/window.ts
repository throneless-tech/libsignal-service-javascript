// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Captures the globals put in place by preload.js, background.js and others

export { Long } from 'long';

export type WhatIsThis = any;

export declare class ByteBufferClass {
  constructor(value?: any, littleEndian?: number);
  static wrap: (
    value: any,
    encoding?: string,
    littleEndian?: number
  ) => ByteBufferClass;
  buffer: ArrayBuffer;
  toString: (type: string) => string;
  toArrayBuffer: () => ArrayBuffer;
  toBinary: () => string;
  slice: (start: number, end?: number) => ByteBufferClass;
  append: (data: ArrayBuffer) => void;
  limit: number;
  offset: number;
  readInt: (offset: number) => number;
  readLong: (offset: number) => Long;
  readShort: (offset: number) => number;
  readVarint32: () => number;
  writeLong: (l: Long) => void;
  skip: (length: number) => void;
}
