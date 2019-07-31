/*
 * vim: ts=2:sw=2:expandtab
 */

"use strict";

const ByteBuffer = require("bytebuffer");
/* eslint-disable no-proto, no-restricted-syntax, guard-for-in */

/** *******************************
 *** Type conversion utilities ***
 ******************************** */
// Strings/arrays
// TODO: Throw all this shit in favor of consistent types
// TODO: Namespace
const StaticByteBufferProto = new ByteBuffer().__proto__;
const StaticArrayBufferProto = new ArrayBuffer().__proto__;
const StaticUint8ArrayProto = new Uint8Array().__proto__;
const StaticBufferProto = Buffer.from([]).__proto__;

function isString(s) {
  return typeof s === "string" || s instanceof String;
}

function getString(thing) {
  if (thing === Object(thing)) {
    if (thing.__proto__ === StaticUint8ArrayProto)
      return String.fromCharCode.apply(null, thing);
    if (thing.__proto__ === StaticArrayBufferProto)
      return getString(new Uint8Array(thing));
    if (
      thing.__proto__ === StaticByteBufferProto ||
      thing.__proto__ === StaticBufferProto
    )
      return thing.toString("binary");
  }
  return thing;
}

function isStringable(thing) {
  return (
    typeof thing === "string" ||
    typeof thing === "number" ||
    typeof thing === "boolean" ||
    (thing === Object(thing) &&
      (thing.__proto__ === StaticArrayBufferProto ||
        thing.__proto__ === StaticUint8ArrayProto ||
        thing.__proto__ === StaticByteBufferProto ||
        thing.__proto__ === StaticBufferProto))
  );
}

function stringToArrayBuffer(str) {
  if (typeof str !== "string") {
    throw new Error("Passed non-string to stringToArrayBuffer");
  }
  var res = new ArrayBuffer(str.length);
  var uint = new Uint8Array(res);
  for (var i = 0; i < str.length; i++) {
    uint[i] = str.charCodeAt(i);
  }
  return res;
}

function convertToArrayBuffer(thing) {
  if (thing === undefined) {
    return undefined;
  }
  if (thing === Object(thing)) {
    if (thing.__proto__ === StaticArrayBufferProto) {
      return thing;
    }
    // TODO: Several more cases here...
  }

  if (thing instanceof Array) {
    // Assuming Uint16Array from curve25519
    const res = new ArrayBuffer(thing.length * 2);
    const uint = new Uint16Array(res);
    for (let i = 0; i < thing.length; i += 1) {
      uint[i] = thing[i];
    }
    return res;
  }

  let str;
  if (isStringable(thing)) {
    str = getString(thing);
  } else if (typeof thing === "string") {
    str = thing;
  } else {
    throw new Error(
      `Tried to convert a non-stringable thing of type ${typeof thing} to an array buffer`
    );
  }
  const res = new ArrayBuffer(str.length);
  const uint = new Uint8Array(res);
  for (let i = 0; i < str.length; i += 1) {
    uint[i] = str.charCodeAt(i);
  }
  return res;
}

function equalArrayBuffers(ab1, ab2) {
  if (!(ab1 instanceof ArrayBuffer && ab2 instanceof ArrayBuffer)) {
    return false;
  }
  if (ab1.byteLength !== ab2.byteLength) {
    return false;
  }
  let result = 0;
  const ta1 = new Uint8Array(ab1);
  const ta2 = new Uint8Array(ab2);
  for (let i = 0; i < ab1.byteLength; i += 1) {
    // eslint-disable-next-line no-bitwise
    result |= ta1[i] ^ ta2[i];
  }
  return result === 0;
}

// Number formatting utils
function unencodeNumber(number) {
  return number.split(".");
}

function isNumberSane(number) {
  return number[0] === "+" && /^[0-9]+$/.test(number.substring(1));
}

/** ************************
 *** JSON'ing Utilities ***
 ************************* */
function ensureStringed(thing) {
  if (isStringable(thing)) return getString(thing);
  else if (thing instanceof Array) {
    const res = [];
    for (let i = 0; i < thing.length; i += 1) res[i] = ensureStringed(thing[i]);
    return res;
  } else if (thing === Object(thing)) {
    const res = {};
    for (const key in thing) res[key] = ensureStringed(thing[key]);
    return res;
  } else if (thing === null) {
    return null;
  }
  throw new Error(`unsure of how to jsonify object of type ${typeof thing}`);
}

function jsonThing(thing) {
  return JSON.stringify(ensureStringed(thing));
}

exports = module.exports = {
  isString,
  getString,
  isStringable,
  unencodeNumber,
  isNumberSane,
  stringToArrayBuffer,
  convertToArrayBuffer,
  equalArrayBuffers,
  ensureStringed,
  jsonThing
};
