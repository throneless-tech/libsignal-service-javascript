/*
 * vim: ts=2:sw=2:expandtab
 */

"use strict";

const debug = require("debug")("libsignal-service:Attachment");
const fs = require("fs").promises;
const path = require("path");
const mime = require("mime-types");
const sizeOf = require("image-size");
const getGuid = require("uuid/v4");
const helpers = require("./helpers.js");

function isImage(mimeType) {
  return mimeType.startsWith("image/");
}

function isVideo(mimeType) {
  return mimeType.startsWith("video/");
}

function isAudio(mimeType) {
  return mimeType.startsWith("audio/");
}

function contentTypeToFileName(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    case "image/png":
      return ".png";
    case "video/mp4":
      return ".mp4";
    case "text/plain":
      return ".txt";
    default:
      return ".bin";
  }
}

function loadFile(file, caption = "") {
  const source = path.normalize(file);
  const fileName = path.basename(source);
  const contentType = mime.lookup(source);
  debug("Reading file " + source + " with MIME type " + contentType);
  return fs.readFile(source).then(buffer => {
    const data = helpers.convertToArrayBuffer(buffer);
    let width, height;
    if (helpers.isString(contentType) && isImage(contentType)) {
      const dimensions = sizeOf(source);
      width = dimensions.width;
      height = dimensions.height;
    }
    return {
      fileName: fileName,
      contentType: contentType,
      width: width,
      height: height,
      data: data,
      size: data.byteLength
    };
  });
}

async function saveFile(file, dest) {
  if (!file || !file.data || !file.contentType) {
    throw new Error("Invalid file.");
  }

  let fileName = file.fileName;
  if (!fileName) {
    const extension = contentTypeToFileName(file.contentType);
    const guid = getGuid();
    fileName = "" + guid + extension;
  }
  const target = path.join(dest, fileName);
  return fs.writeFile(target, Buffer.from(file.data)).then(() => {
    return target;
  });
}

exports = module.exports = {
  loadFile,
  saveFile
};
