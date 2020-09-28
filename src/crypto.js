/*
 * vim: ts=2:sw=2:expandtab
 */



const btoa = require('btoa');
const ByteBuffer = require('bytebuffer');
const libsignal = require('@throneless/libsignal-protocol');
const WebCrypto = require('node-webcrypto-ossl');

const webcrypto = new WebCrypto();
const helpers = require('./helpers.js');

/* eslint-disable more/no-then, no-bitwise */

// eslint-disable-next-line func-names
const {
  encrypt,
  decrypt,
  calculateMAC,
  getRandomBytes,
} = libsignal._crypto.crypto;
const {verifyMAC} = libsignal._crypto;

const PROFILE_IV_LENGTH = 12; // bytes
const PROFILE_KEY_LENGTH = 32; // bytes
const PROFILE_TAG_LENGTH = 128; // bits
const PROFILE_NAME_PADDED_LENGTH = 53; // bytes

// Private functions from libtextsecure/crypto.js
function _verifyDigest(data, theirDigest) {
  return webcrypto.subtle.digest({ name: 'SHA-256' }, data).then(ourDigest => {
    const a = new Uint8Array(ourDigest);
    const b = new Uint8Array(theirDigest);
    let result = 0;
    for (let i = 0; i < theirDigest.byteLength; i += 1) {
      result |= a[i] ^ b[i];
    }
    if (result !== 0) {
      throw new Error('Bad digest');
    }
  });
}
function _calculateDigest(data) {
  return webcrypto.subtle.digest({ name: 'SHA-256' }, data);
}

// Public functions from libtextsecure/crypto.js
// Decrypts message into a raw string
function decryptWebsocketMessage(message, signalingKey) {
  if (signalingKey.byteLength !== 52) {
    throw new Error('Got invalid length signalingKey');
  }
  if (message.byteLength < 1 + 16 + 10) {
    throw new Error('Got invalid length message');
  }
  if (new Uint8Array(message)[0] !== 1) {
    throw new Error(`Got bad version number: ${message[0]}`);
  }

  const aesKey = signalingKey.slice(0, 32);
  const macKey = signalingKey.slice(32, 32 + 20);

  const iv = message.slice(1, 1 + 16);
  const ciphertext = message.slice(1 + 16, message.byteLength - 10);
  const ivAndCiphertext = message.slice(0, message.byteLength - 10);
  const mac = message.slice(message.byteLength - 10, message.byteLength);

  return verifyMAC(ivAndCiphertext, macKey, mac, 10).then(() =>
    decrypt(aesKey, ciphertext, iv)
  );
}

function decryptAttachment(encryptedBin, keys, theirDigest) {
  if (keys.byteLength !== 64) {
    throw new Error('Got invalid length attachment keys');
  }
  if (encryptedBin.byteLength < 16 + 32) {
    throw new Error('Got invalid length attachment');
  }

  const aesKey = keys.slice(0, 32);
  const macKey = keys.slice(32, 64);

  const iv = encryptedBin.slice(0, 16);
  const ciphertext = encryptedBin.slice(16, encryptedBin.byteLength - 32);
  const ivAndCiphertext = encryptedBin.slice(0, encryptedBin.byteLength - 32);
  const mac = encryptedBin.slice(
    encryptedBin.byteLength - 32,
    encryptedBin.byteLength
  );

  return verifyMAC(ivAndCiphertext, macKey, mac, 32)
    .then(() => {
      if (theirDigest) {
        return _verifyDigest(encryptedBin, theirDigest);
      }

      return null;
    })
    .then(() => decrypt(aesKey, ciphertext, iv));
}

function encryptAttachment(plaintext, keys, iv) {
  if (!(plaintext instanceof ArrayBuffer) && !ArrayBuffer.isView(plaintext)) {
    throw new TypeError(
      `\`plaintext\` must be an \`ArrayBuffer\` or \`ArrayBufferView\`; got: ${typeof plaintext}`
    );
  }

  if (keys.byteLength !== 64) {
    throw new Error('Got invalid length attachment keys');
  }
  if (iv.byteLength !== 16) {
    throw new Error('Got invalid length attachment iv');
  }
  const aesKey = keys.slice(0, 32);
  const macKey = keys.slice(32, 64);

  return encrypt(aesKey, plaintext, iv).then(ciphertext => {
    const ivAndCiphertext = new Uint8Array(16 + ciphertext.byteLength);
    ivAndCiphertext.set(new Uint8Array(iv));
    ivAndCiphertext.set(new Uint8Array(ciphertext), 16);

    return calculateMAC(macKey, ivAndCiphertext.buffer).then(mac => {
      const encryptedBin = new Uint8Array(16 + ciphertext.byteLength + 32);
      encryptedBin.set(ivAndCiphertext);
      encryptedBin.set(new Uint8Array(mac), 16 + ciphertext.byteLength);
      return _calculateDigest(encryptedBin.buffer).then(digest => ({
        ciphertext: encryptedBin.buffer,
        digest,
      }));
    });
  });
}

function encryptProfile(data, key) {
  const iv = this.getRandomBytes(PROFILE_IV_LENGTH);
  if (key.byteLength !== PROFILE_KEY_LENGTH) {
    throw new Error('Got invalid length profile key');
  }
  if (iv.byteLength !== PROFILE_IV_LENGTH) {
    throw new Error('Got invalid length profile iv');
  }
  return webcrypto.subtle
    .importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt'])
    .then(keyForEncryption =>
      webcrypto.subtle
        .encrypt(
          { name: 'AES-GCM', iv, tagLength: PROFILE_TAG_LENGTH },
          keyForEncryption,
          data
        )
        .then(ciphertext => {
          const ivAndCiphertext = new Uint8Array(
            PROFILE_IV_LENGTH + ciphertext.byteLength
          );
          ivAndCiphertext.set(new Uint8Array(iv));
          ivAndCiphertext.set(new Uint8Array(ciphertext), PROFILE_IV_LENGTH);
          return ivAndCiphertext.buffer;
        })
    );
}

function decryptProfile(data, key) {
  if (data.byteLength < 12 + 16 + 1) {
    throw new Error(`Got too short input: ${data.byteLength}`);
  }
  const iv = data.slice(0, PROFILE_IV_LENGTH);
  const ciphertext = data.slice(PROFILE_IV_LENGTH, data.byteLength);
  if (key.byteLength !== PROFILE_KEY_LENGTH) {
    throw new Error('Got invalid length profile key');
  }
  if (iv.byteLength !== PROFILE_IV_LENGTH) {
    throw new Error('Got invalid length profile iv');
  }
  const error = new Error(); // save stack
  return webcrypto.subtle
    .importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt'])
    .then(keyForEncryption =>
      webcrypto.subtle
        .decrypt(
          { name: 'AES-GCM', iv, tagLength: PROFILE_TAG_LENGTH },
          keyForEncryption,
          ciphertext
        )
        .catch(e => {
          if (e.name === 'OperationError') {
            // bad mac, basically.
            error.message =              'Failed to decrypt profile data. Most likely the profile key has changed.';
            error.name = 'ProfileDecryptError';
            throw error;
          }
        })
    );
}

function encryptProfileName(name, key) {
  const padded = new Uint8Array(PROFILE_NAME_PADDED_LENGTH);
  padded.set(new Uint8Array(name));
  return this.encryptProfile(padded.buffer, key);
}

function decryptProfileName(encryptedProfileName, key) {
  const data = ByteBuffer.wrap(encryptedProfileName, 'base64').toArrayBuffer();
  return this.decryptProfile(data, key).then(decrypted => {
    const padded = new Uint8Array(decrypted);

    // Given name is the start of the string to the first null character
    let givenEnd;
    for (givenEnd = 0; givenEnd < padded.length; givenEnd += 1) {
      if (padded[givenEnd] === 0x00) {
        break;
      }
    }

    // Family name is the next chunk of non-null characters after that first null
    let familyEnd;
    for (familyEnd = givenEnd + 1; familyEnd < padded.length; familyEnd += 1) {
      if (padded[familyEnd] === 0x00) {
        break;
      }
    }
    const foundFamilyName = familyEnd > givenEnd + 1;

    return {
      given: ByteBuffer.wrap(padded)
        .slice(0, givenEnd)
        .toArrayBuffer(),
      family: foundFamilyName
        ? ByteBuffer.wrap(padded)
            .slice(givenEnd + 1, familyEnd)
            .toArrayBuffer()
        : null,
    };
  });
}

// Functions from js/modules/crypto.js
function typedArrayToArrayBuffer(typedArray) {
  const { buffer, byteOffset, byteLength } = typedArray;
  return buffer.slice(byteOffset, byteLength + byteOffset);
}

function arrayBufferToBase64(arrayBuffer) {
  return ByteBuffer.wrap(arrayBuffer).toString('base64');
}
function base64ToArrayBuffer(base64string) {
  return ByteBuffer.wrap(base64string, 'base64').toArrayBuffer();
}

function fromEncodedBinaryToArrayBuffer(key) {
  return ByteBuffer.wrap(key, 'binary').toArrayBuffer();
}

function bytesFromString(string) {
  return ByteBuffer.wrap(string, 'utf8').toArrayBuffer();
}
function stringFromBytes(buffer) {
  return ByteBuffer.wrap(buffer).toString('utf8');
}
function hexFromBytes(buffer) {
  return ByteBuffer.wrap(buffer).toString('hex');
}
function bytesFromHexString(string) {
  return ByteBuffer.wrap(string, 'hex').toArrayBuffer();
}

async function deriveStickerPackKey(packKey) {
  const salt = getZeroes(32);
  const info = bytesFromString('Sticker Pack');

  const [part1, part2] = await libsignal.HKDF.deriveSecrets(
    packKey,
    salt,
    info
  );

  return concatenateBytes(part1, part2);
}

// High-level Operations

async function encryptDeviceName(deviceName, identityPublic) {
  const plaintext = bytesFromString(deviceName);
  const ephemeralKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
  const masterSecret = await libsignal._curve.libsignal_Curve_async.calculateAgreement(
    identityPublic,
    ephemeralKeyPair.privKey
  );

  const key1 = await hmacSha256(masterSecret, bytesFromString('auth'));
  const syntheticIv = getFirstBytes(await hmacSha256(key1, plaintext), 16);

  const key2 = await hmacSha256(masterSecret, bytesFromString('cipher'));
  const cipherKey = await hmacSha256(key2, syntheticIv);

  const counter = getZeroes(16);
  const ciphertext = await encryptAesCtr(cipherKey, plaintext, counter);

  return {
    ephemeralPublic: ephemeralKeyPair.pubKey,
    syntheticIv,
    ciphertext,
  };
}

async function decryptDeviceName(
  { ephemeralPublic, syntheticIv, ciphertext } = {},
  identityPrivate
) {
  const masterSecret = await libsignal._curve.libsignal_Curve_async.calculateAgreement(
    ephemeralPublic,
    identityPrivate
  );

  const key2 = await hmacSha256(masterSecret, bytesFromString('cipher'));
  const cipherKey = await hmacSha256(key2, syntheticIv);

  const counter = getZeroes(16);
  const plaintext = await decryptAesCtr(cipherKey, ciphertext, counter);

  const key1 = await hmacSha256(masterSecret, bytesFromString('auth'));
  const ourSyntheticIv = getFirstBytes(await hmacSha256(key1, plaintext), 16);

  if (!constantTimeEqual(ourSyntheticIv, syntheticIv)) {
    throw new Error('decryptDeviceName: synthetic IV did not match');
  }

  return stringFromBytes(plaintext);
}

// Path structure: 'fa/facdf99c22945b1c9393345599a276f4b36ad7ccdc8c2467f5441b742c2d11fa'
function getAttachmentLabel(path) {
  const filename = path.slice(3);
  return base64ToArrayBuffer(filename);
}

const PUB_KEY_LENGTH = 32;

async function encryptFile(staticPublicKey, uniqueId, plaintext) {
  const ephemeralKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
  const agreement = await libsignal._curve.libsignal_Curve_async.calculateAgreement(
    staticPublicKey,
    ephemeralKeyPair.privKey
  );
  const key = await hmacSha256(agreement, uniqueId);

  const prefix = ephemeralKeyPair.pubKey.slice(1);
  return concatenateBytes(prefix, await encryptSymmetric(key, plaintext));
}

async function decryptFile(staticPrivateKey, uniqueId, data) {
  const ephemeralPublicKey = getFirstBytes(data, PUB_KEY_LENGTH);
  const ciphertext = _getBytes(data, PUB_KEY_LENGTH, data.byteLength);
  const agreement = await libsignal._curve.libsignal_Curve_async.calculateAgreement(
    ephemeralPublicKey,
    staticPrivateKey
  );

  const key = await hmacSha256(agreement, uniqueId);

  return decryptSymmetric(key, ciphertext);
}

async function deriveAccessKey(profileKey) {
  const iv = getZeroes(12);
  const plaintext = getZeroes(16);
  const accessKey = await _encrypt_aes_gcm(profileKey, iv, plaintext);
  return getFirstBytes(accessKey, 16);
}

async function getAccessKeyVerifier(accessKey) {
  const plaintext = getZeroes(32);
  const hmac = await hmacSha256(accessKey, plaintext);

  return hmac;
}

async function verifyAccessKey(accessKey, theirVerifier) {
  const ourVerifier = await getAccessKeyVerifier(accessKey);

  if (constantTimeEqual(ourVerifier, theirVerifier)) {
    return true;
  }

  return false;
}

const IV_LENGTH = 16;
const MAC_LENGTH = 16;
const NONCE_LENGTH = 16;

async function encryptSymmetric(key, plaintext) {
  const iv = getZeroes(IV_LENGTH);
  const nonce = getRandomBytes(NONCE_LENGTH);

  const cipherKey = await hmacSha256(key, nonce);
  const macKey = await hmacSha256(key, cipherKey);

  const cipherText = await _encrypt_aes256_CBC_PKCSPadding(
    cipherKey,
    iv,
    plaintext
  );
  const mac = getFirstBytes(await hmacSha256(macKey, cipherText), MAC_LENGTH);

  return concatenateBytes(nonce, cipherText, mac);
}

async function decryptSymmetric(key, data) {
  const iv = getZeroes(IV_LENGTH);

  const nonce = getFirstBytes(data, NONCE_LENGTH);
  const cipherText = _getBytes(
    data,
    NONCE_LENGTH,
    data.byteLength - NONCE_LENGTH - MAC_LENGTH
  );
  const theirMac = _getBytes(data, data.byteLength - MAC_LENGTH, MAC_LENGTH);

  const cipherKey = await hmacSha256(key, nonce);
  const macKey = await hmacSha256(key, cipherKey);

  const ourMac = getFirstBytes(
    await hmacSha256(macKey, cipherText),
    MAC_LENGTH
  );
  if (!constantTimeEqual(theirMac, ourMac)) {
    throw new Error(
      'decryptSymmetric: Failed to decrypt; MAC verification failed'
    );
  }

  return _decrypt_aes256_CBC_PKCSPadding(cipherKey, iv, cipherText);
}

function constantTimeEqual(left, right) {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  let result = 0;
  const ta1 = new Uint8Array(left);
  const ta2 = new Uint8Array(right);
  for (let i = 0, max = left.byteLength; i < max; i += 1) {
    // eslint-disable-next-line no-bitwise
    result |= ta1[i] ^ ta2[i];
  }
  return result === 0;
}

// Encryption

async function hmacSha256(key, plaintext) {
  const algorithm = {
    name: 'HMAC',
    hash: 'SHA-256',
  };
  const extractable = false;

  const cryptoKey = await webcrypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    extractable,
    ['sign']
  );

  return webcrypto.subtle.sign(algorithm, cryptoKey, plaintext);
}

async function _encrypt_aes256_CBC_PKCSPadding(key, iv, plaintext) {
  const algorithm = {
    name: 'AES-CBC',
    iv,
  };
  const extractable = false;

  const cryptoKey = await webcrypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    extractable,
    ['encrypt']
  );

  return webcrypto.subtle.encrypt(algorithm, cryptoKey, plaintext);
}

async function _decrypt_aes256_CBC_PKCSPadding(key, iv, plaintext) {
  const algorithm = {
    name: 'AES-CBC',
    iv,
  };
  const extractable = false;

  const cryptoKey = await webcrypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    extractable,
    ['decrypt']
  );
  return webcrypto.subtle.decrypt(algorithm, cryptoKey, plaintext);
}

async function encryptAesCtr(key, plaintext, counter) {
  const extractable = false;
  const algorithm = {
    name: 'AES-CTR',
    counter: new Uint8Array(counter),
    length: 128,
  };

  const cryptoKey = await webcrypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    extractable,
    ['encrypt']
  );

  // webcrypto module importKey overwrites length
  algorithm.length = 128;
  const ciphertext = await webcrypto.subtle.encrypt(
    algorithm,
    cryptoKey,
    plaintext
  );

  return ciphertext;
}

async function decryptAesCtr(key, ciphertext, counter) {
  const extractable = false;
  const algorithm = {
    name: 'AES-CTR',
    counter: new Uint8Array(counter),
    length: 128,
  };

  const cryptoKey = await webcrypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    extractable,
    ['decrypt']
  );

  // webcrypto module importKey overwrites length
  algorithm.length = 128;
  const plaintext = await webcrypto.subtle.decrypt(
    algorithm,
    cryptoKey,
    ciphertext
  );
  return plaintext;
}

async function _encrypt_aes_gcm(key, iv, plaintext) {
  const algorithm = {
    name: 'AES-GCM',
    iv,
  };
  const extractable = false;

  const cryptoKey = await webcrypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    extractable,
    ['encrypt']
  );
  return webcrypto.subtle.encrypt(algorithm, cryptoKey, plaintext);
}

// Utility

// function getRandomBytes(n) {
//  const bytes = new Uint8Array(n);
//  webcrypto.getRandomValues(bytes);
//  return bytes;
// }

function getRandomValue(low, high) {
  const diff = high - low;
  const bytes = new Uint32Array(1);
  webcrypto.getRandomValues(bytes);

  // Because high and low are inclusive
  const mod = diff + 1;
  return (bytes[0] % mod) + low;
}

function getRandomValues(bytes) {
  return webcrypto.getRandomValues(bytes);
}

function getZeroes(n) {
  const result = new Uint8Array(n);

  const value = 0;
  const startIndex = 0;
  const endExclusive = n;
  result.fill(value, startIndex, endExclusive);

  return result;
}

function highBitsToInt(byte) {
  return (byte & 0xff) >> 4;
}

function intsToByteHighAndLow(highValue, lowValue) {
  return ((highValue << 4) | lowValue) & 0xff;
}

function trimBytes(buffer, length) {
  return getFirstBytes(buffer, length);
}

function getViewOfArrayBuffer(buffer, start, finish) {
  const source = new Uint8Array(buffer);
  const result = source.slice(start, finish);
  return result.buffer;
}

function concatenateBytes(...elements) {
  const length = elements.reduce(
    (total, element) => total + element.byteLength,
    0
  );

  const result = new Uint8Array(length);
  let position = 0;

  for (let i = 0, max = elements.length; i < max; i += 1) {
    const element = new Uint8Array(elements[i]);
    result.set(element, position);
    position += element.byteLength;
  }
  if (position !== result.length) {
    throw new Error('problem concatenating!');
  }

  return result.buffer;
}

function splitBytes(buffer, ...lengths) {
  const total = lengths.reduce((acc, length) => acc + length, 0);

  if (total !== buffer.byteLength) {
    throw new Error(
      `Requested lengths total ${total} does not match source total ${buffer.byteLength}`
    );
  }

  const source = new Uint8Array(buffer);
  const results = [];
  let position = 0;

  for (let i = 0, max = lengths.length; i < max; i += 1) {
    const length = lengths[i];
    const result = new Uint8Array(length);
    const section = source.slice(position, position + length);
    result.set(section);
    position += result.byteLength;

    results.push(result);
  }

  return results;
}

function getFirstBytes(data, n) {
  const source = new Uint8Array(data);
  return source.subarray(0, n);
}

function generatePassword() {
  const password = btoa(
    helpers.getString(libsignal.KeyHelper.getRandomBytes(16))
  );
  return password.substring(0, password.length - 2);
}

function generateGroupId() {
  return helpers.getString(libsignal.KeyHelper.getRandomBytes(16));
}

// Internal-only

function _getBytes(data, start, n) {
  const source = new Uint8Array(data);
  return source.subarray(start, start + n);
}

exports = module.exports = {
  // from libtextsecure/crypto.js
  decryptWebsocketMessage,
  decryptAttachment,
  encryptAttachment,
  encryptProfile,
  decryptProfile,
  encryptProfileName,
  decryptProfileName,
  // from js/modules/crypto.js
  arrayBufferToBase64,
  typedArrayToArrayBuffer,
  base64ToArrayBuffer,
  bytesFromHexString,
  bytesFromString,
  concatenateBytes,
  constantTimeEqual,
  decryptAesCtr,
  decryptDeviceName,
  getAttachmentLabel,
  decryptFile,
  decryptSymmetric,
  deriveAccessKey,
  deriveStickerPackKey,
  encryptAesCtr,
  encryptDeviceName,
  encryptFile,
  encryptSymmetric,
  fromEncodedBinaryToArrayBuffer,
  generateGroupId,
  generatePassword,
  getAccessKeyVerifier,
  getFirstBytes,
  getRandomBytes,
  getRandomValue,
  getRandomValues,
  getViewOfArrayBuffer,
  getZeroes,
  hexFromBytes,
  highBitsToInt,
  hmacSha256,
  intsToByteHighAndLow,
  splitBytes,
  stringFromBytes,
  trimBytes,
  verifyAccessKey,
};
