/*
 * vim: ts=2:sw=2:expandtab
 */

"use strict";

const ByteBuffer = require("bytebuffer");

const functions = {
  stringToArrayBufferBase64,
  arrayBufferToStringBase64
};

onmessage = async e => {
  const [jobId, fnName, ...args] = e.data;

  try {
    const fn = functions[fnName];
    if (!fn) {
      throw new Error(`Worker: job ${jobId} did not find function ${fnName}`);
    }
    const result = await fn(...args);
    postMessage([jobId, null, result]);
  } catch (error) {
    const errorForDisplay = prepareErrorForPostMessage(error);
    postMessage([jobId, errorForDisplay]);
  }
};

function prepareErrorForPostMessage(error) {
  if (!error) {
    return null;
  }

  if (error.stack) {
    return error.stack;
  }

  return error.message;
}

function stringToArrayBufferBase64(string) {
  return ByteBuffer.wrap(string, "base64").toArrayBuffer();
}
function arrayBufferToStringBase64(arrayBuffer) {
  return ByteBuffer.wrap(new Uint8Array(arrayBuffer)).toString("base64");
}
