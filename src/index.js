/*
 * vim: ts=2:sw=2:expandtab
 */

"use strict";

const origConfigDir = process.env.NODE_CONFIG_DIR;
process.env.NODE_CONFIG_DIR = __dirname + "/../config";
const config = require("config");
process.env.NODE_CONFIG_DIR = origConfigDir;
let proxyUrl;
if (config.has("proxyUrl")) {
  proxyUrl = config.get("proxyUrl");
}
const WebAPI = require("./WebAPI.js").initialize({
  url: config.get("serverUrl"),
  cdnUrl: config.get("cdnUrl"),
  certificateAuthority: config.get("certificateAuthority"),
  contentProxyUrl: config.get("contentProxyUrl"),
  proxyUrl: proxyUrl
});
exports = module.exports = {};
exports.AccountManager = require("./AccountManager.js")(WebAPI);
exports.MessageReceiver = require("./MessageReceiver.js")(
  WebAPI,
  config.get("serverTrustRoot")
);
exports.MessageSender = require("./MessageSender.js")(WebAPI);
exports.ProtocolStore = require("./ProtocolStore.js");
exports.AttachmentHelper = require("./AttachmentHelper.js");
exports.KeyHelper = require("@throneless/libsignal-protocol").KeyHelper;
exports.KeyHelper.getRandomBytes = require("./crypto.js").getRandomBytes;
exports.KeyHelper.generatePassword = require("./crypto.js").generatePassword;
exports.KeyHelper.generateGroupId = require("./crypto.js").generateGroupId;
