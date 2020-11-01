/*
 * vim: ts=2:sw=2:expandtab
 */



const origConfigDir = process.env.NODE_CONFIG_DIR;
process.env.NODE_CONFIG_DIR = `${__dirname  }/../config`;
const config = require('config');

// const CLIENT_VERSION = '1.33.4';
const CLIENT_VERSION = 'v1';

process.env.NODE_CONFIG_DIR = origConfigDir;
let proxyUrl;
if (config.has('proxyUrl')) {
  proxyUrl = config.get('proxyUrl');
}
const cdnUrl0 = config.get('cdn').get('0');
const cdnUrl2 = config.get('cdn').get('2');
const WebAPI = require('./WebAPI.js').initialize({
  url: config.get('serverUrl'),
  cdnUrlObject: {
    '0': cdnUrl0,
    '2': cdnUrl2,
  },
  certificateAuthority: config.get('certificateAuthority'),
  contentProxyUrl: config.get('contentProxyUrl'),
  proxyUrl,
  version: CLIENT_VERSION,
});

module.exports = {};
exports = module.exports;
exports.AccountManager = require('./AccountManager.js')(WebAPI);
exports.MessageReceiver = require('./MessageReceiver.js')(
  WebAPI,
  config.get('serverTrustRoot')
);
exports.MessageSender = require('./MessageSender.js')(WebAPI);
exports.ProtocolStore = require('./ProtocolStore.js');
exports.AttachmentHelper = require('./AttachmentHelper.js');
exports.KeyHelper = require('@throneless/libsignal-protocol').KeyHelper;
exports.KeyHelper.getRandomBytes = require('./crypto.js').getRandomBytes;
exports.KeyHelper.generatePassword = require('./crypto.js').generatePassword;
exports.KeyHelper.generateGroupId = require('./crypto.js').generateGroupId;
