"use strict";

const btoa = require("btoa");
const helpers = require("./helpers.js");
const origConfigDir = process.env.NODE_CONFIG_DIR;
process.env.NODE_CONFIG_DIR = __dirname + "/../config";
const config = require("config");
process.env.NODE_CONFIG_DIR = origConfigDir;
let proxyUrl;
if (config.has("proxyUrl")) {
  proxyUrl = config.get("proxyUrl");
}
const WebAPI = require("./web_api.js").initialize({
  url: config.get("serverUrl"),
  cdnUrl: config.get("cdnUrl"),
  certificateAuthority: config.get("certificateAuthority"),
  contentProxyUrl: config.get("contentProxyUrl"),
  proxyUrl: proxyUrl
});
exports = module.exports = {};
exports.AccountManager = require("./account_manager.js")(WebAPI);
exports.MessageReceiver = require("./message_receiver.js")(
  WebAPI,
  config.get("serverTrustRoot")
);
exports.MessageSender = require("./sendmessage.js")(WebAPI);
exports.KeyHelper = require("@throneless/libsignal-protocol").KeyHelper;
exports.KeyHelper.getRandomBytes = require("./crypto.js").getRandomBytes;
exports.KeyHelper.generatePassword = function() {
  var password = btoa(helpers.getString(exports.KeyHelper.getRandomBytes(16)));
  return password.substring(0, password.length - 2);
};
