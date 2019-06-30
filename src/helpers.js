/*
 * vim: ts=2:sw=2:expandtab
 */

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

function getString(thing) {
  if (thing === Object(thing)) {
    if (thing.__proto__ === StaticUint8ArrayProto)
      return String.fromCharCode.apply(null, thing);
    if (thing.__proto__ === StaticArrayBufferProto)
      return getString(new Uint8Array(thing));
    if (thing.__proto__ === StaticByteBufferProto)
      return thing.toString("binary");
  }
  return thing;
}

function getStringable(thing) {
  return (
    typeof thing === "string" ||
    typeof thing === "number" ||
    typeof thing === "boolean" ||
    (thing === Object(thing) &&
      (thing.__proto__ === StaticArrayBufferProto ||
        thing.__proto__ === StaticUint8ArrayProto ||
        thing.__proto__ === StaticByteBufferProto))
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
  if (getStringable(thing)) return getString(thing);
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
  getString,
  getStringable,
  unencodeNumber,
  isNumberSane,
  stringToArrayBuffer,
  ensureStringed,
  jsonThing
};
