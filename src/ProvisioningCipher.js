/*
 * vim: ts=2:sw=2:expandtab
 */



const libsignal = require('@throneless/libsignal-protocol');
const ProvisionMessage = require('./protobufs.js').lookupType(
  'signalservice.ProvisionMessage'
);

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
class ProvisioningCipher {
  decrypt(provisionEnvelope) {
    const masterEphemeral = provisionEnvelope.publicKey.toArrayBuffer();
    const message = provisionEnvelope.body.toArrayBuffer();
    if (new Uint8Array(message)[0] !== 1) {
      throw new Error('Bad version number on ProvisioningMessage');
    }

    const iv = message.slice(1, 16 + 1);
    const mac = message.slice(message.byteLength - 32, message.byteLength);
    const ivAndCiphertext = message.slice(0, message.byteLength - 32);
    const ciphertext = message.slice(16 + 1, message.byteLength - 32);

    return libsignal.Curve.async
      .calculateAgreement(masterEphemeral, this.keyPair.privKey)
      .then(ecRes =>
        libsignal.HKDF.deriveSecrets(
          ecRes,
          new ArrayBuffer(32),
          'TextSecure Provisioning Message'
        )
      )
      .then(keys =>
        libsignal.crypto
          .verifyMAC(ivAndCiphertext, keys[1], mac, 32)
          .then(() => libsignal.crypto.decrypt(keys[0], ciphertext, iv))
      )
      .then(plaintext => {
        const provisionMessage = ProvisionMessage.decode(plaintext);
        const privKey = provisionMessage.identityKeyPrivate.toArrayBuffer();

        return libsignal.Curve.async.createKeyPair(privKey).then(keyPair => {
          const ret = {
            identityKeyPair: keyPair,
            number: provisionMessage.number,
            provisioningCode: provisionMessage.provisioningCode,
            userAgent: provisionMessage.userAgent,
            readReceipts: provisionMessage.readReceipts,
          };
          if (provisionMessage.profileKey) {
            ret.profileKey = provisionMessage.profileKey.toArrayBuffer();
          }
          return ret;
        });
      });
  }

  getPublicKey() {
    return Promise.resolve()
      .then(() => {
        if (!this.keyPair) {
          return libsignal.Curve.async.generateKeyPair().then(keyPair => {
            this.keyPair = keyPair;
          });
        }

        return null;
      })
      .then(() => this.keyPair.pubKey);
  }
}

exports = module.exports = ProvisioningCipher;
