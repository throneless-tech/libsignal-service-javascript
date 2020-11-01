/*
 * vim: ts=2:sw=2:expandtab
 */



/* eslint-disable no-proto */

// eslint-disable-next-line func-names
const debug = require('debug')('libsignal-service:ProtocolStore');
const libsignal = require('@throneless/libsignal-protocol');
const _ = require('underscore');
const crypto = require('./crypto.js');
const helpers = require('./helpers.js');

const TIMESTAMP_THRESHOLD = 5 * 1000; // 5 seconds
const DEFAULT_POLL_DELAY = 1;
const DEFAULT_CACHE_TIMEOUT = 10;

const Direction = {
  SENDING: 1,
  RECEIVING: 2,
};

const VerifiedStatus = {
  DEFAULT: 0,
  VERIFIED: 1,
  UNVERIFIED: 2,
};

const CacheStatus = {
  DEHYDRATED: 0,
  HYDRATING: 1,
  HYDRATED: 2,
};

function validateVerifiedStatus(status) {
  if (
    status === VerifiedStatus.DEFAULT
    || status === VerifiedStatus.VERIFIED
    || status === VerifiedStatus.UNVERIFIED
  ) {
    return true;
  }
  return false;
}

class IdentityRecord {
  constructor(data) {
    const {
      id,
      publicKey,
      firstUse,
      timestamp,
      verified,
      nonblockingApproval,
    } = data;

    if (!helpers.isString(id)) {
      throw new Error('Invalid identity key id');
    }
    if (!(publicKey instanceof ArrayBuffer)) {
      throw new Error('Invalid identity key publicKey');
    }
    if (typeof firstUse !== 'boolean') {
      throw new Error('Invalid identity key firstUse');
    }
    if (typeof timestamp !== 'number' || !(timestamp >= 0)) {
      throw new Error('Invalid identity key timestamp');
    }
    if (!validateVerifiedStatus(verified)) {
      throw new Error('Invalid identity key verified');
    }
    if (typeof nonblockingApproval !== 'boolean') {
      throw new Error('Invalid identity key nonblockingApproval');
    }
    this.id = id;
    this.publicKey = publicKey;
    this.firstUse = firstUse;
    this.timestamp = timestamp;
    this.verified = verified;
    this.nonblockingApproval = nonblockingApproval;
  }
}

async function _hydrateCache(object, field, items, idField) {
  const cache = Object.create(null);
  for (let i = 0, max = items.length; i < max; i += 1) {
    const item = items[i];
    const id = item[idField];

    cache[id] = item;
  }

  debug(`ProtocolStore: Finished caching ${field} data`);
  // eslint-disable-next-line no-param-reassign
  object[field] = cache;
}

class ProtocolStore {
  constructor(storage) {
    this.storage = storage;
    this.Direction = Direction;
    this.status = CacheStatus.DEHYDRATED;
  }

  // Cache
  async _hydrateCaches() {
    const promises = [
      _hydrateCache(
        this,
        'identityKeys',
        await this.storage.getAllIdentityKeys(),
        'id'
      ),
      _hydrateCache(
        this,
        'sessions',
        await this.storage.getAllSessions(),
        'id'
      ),
      _hydrateCache(this, 'preKeys', await this.storage.getAllPreKeys(), 'id'),
      _hydrateCache(
        this,
        'signedPreKeys',
        await this.storage.getAllSignedPreKeys(),
        'id'
      ),
      _hydrateCache(
        this,
        'configuration',
        await this.storage.getAllConfiguration(),
        'id'
      ),
    ];

    // Check for group support
    if (typeof this.storage.getAllGroups === 'function') {
      promises.push(
        _hydrateCache(this, 'groups', await this.storage.getAllGroups(), 'id')
      );
    }
    await Promise.all(promises);
  }

  async _getFromCache(cache, id) {
    return new Promise((resolve, reject) => {
      if (this.status === CacheStatus.HYDRATED) {
        resolve(this[cache][id]);
      } else {
        const interval = setInterval(() => {
          if (this.status === CacheStatus.HYDRATED) {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve(this[cache][id]);
          }
        }, this.storage.pollDelay || DEFAULT_POLL_DELAY);
        const timeout = setTimeout(() => {
          clearInterval(interval);
          reject(new Error('Timed out retrieving from cache.'));
        }, DEFAULT_CACHE_TIMEOUT);
      }
    });
  }

  _saveToCache(cache, id, value) {
    return new Promise((resolve, reject) => {
      if (this.status === CacheStatus.HYDRATED) {
        resolve((this[cache][id] = value));
      } else {
        const interval = setInterval(() => {
          if (this.status === CacheStatus.HYDRATED) {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve((this[cache][id] = value));
          }
        }, this.storage.pollDelay || DEFAULT_POLL_DELAY);
        const timeout = setTimeout(() => {
          clearInterval(interval);
          reject(new Error('Timed out saving to cache.'));
        }, DEFAULT_CACHE_TIMEOUT);
      }
    });
  }

  async _removeFromCache(cache, id) {
    return new Promise((resolve, reject) => {
      if (this.status === CacheStatus.HYDRATED) {
        resolve(delete this[cache][id]);
      } else {
        const interval = setInterval(() => {
          if (this.status === CacheStatus.HYDRATED) {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve(delete this[cache][id]);
          }
        }, this.storage.pollDelay || DEFAULT_POLL_DELAY);
        const timeout = setTimeout(() => {
          clearInterval(interval);
          reject(new Error('Timed out deleting from cache.'));
        }, DEFAULT_CACHE_TIMEOUT);
      }
    });
  }

  async load() {
    this.status = CacheStatus.HYDRATING;
    return this._hydrateCaches().then(() => {
      this.status = CacheStatus.HYDRATED;
    });
  }

  hasGroups() {
    // eslint-disable-next-line no-prototype-builtins
    return this.hasOwnProperty('groups');
  }

  // PreKeys

  async loadPreKey(keyId) {
    const key = await this._getFromCache('preKeys', keyId);
    if (key) {
      debug('Successfully fetched prekey:', keyId);
      return {
        pubKey: helpers.convertToArrayBuffer(key.publicKey),
        privKey: helpers.convertToArrayBuffer(key.privateKey),
      };
    }

    debug('Failed to fetch prekey:', keyId);
    return undefined;
  }

  async storePreKey(keyId, keyPair) {
    const data = {
      id: keyId,
      publicKey: keyPair.pubKey,
      privateKey: keyPair.privKey,
    };

    await this._saveToCache('preKeys', keyId, data);
    await this.storage.createOrUpdatePreKey(data);
  }

  async removePreKey(keyId) {
    await this._removeFromCache('preKeys', keyId);
    await this.storage.removePreKeyById(keyId);
  }

  async clearPreKeyStore() {
    this.preKeys = Object.create(null);
    await this.storage.removeAllPreKeys();
  }

  // Signed PreKeys

  async loadSignedPreKey(keyId) {
    const key = await this._getFromCache('signedPreKeys', keyId);
    if (key) {
      debug('Successfully fetched signed prekey:', key.id);
      return {
        pubKey: helpers.convertToArrayBuffer(key.publicKey),
        privKey: helpers.convertToArrayBuffer(key.privateKey),
        created_at: key.created_at,
        keyId: key.id,
        confirmed: key.confirmed,
      };
    }

    debug('Failed to fetch signed prekey:', keyId);
    return undefined;
  }

  async loadSignedPreKeys() {
    if (arguments.length > 0) {
      throw new Error('loadSignedPreKeys takes no arguments');
    }

    const keys = Object.values(this.signedPreKeys);
    return keys.map(prekey => ({
      pubKey: helpers.convertToArrayBuffer(prekey.publicKey),
      privKey: helpers.convertToArrayBuffer(prekey.privateKey),
      created_at: prekey.created_at,
      keyId: prekey.id,
      confirmed: prekey.confirmed,
    }));
  }

  async storeSignedPreKey(keyId, keyPair, confirmed) {
    const data = {
      id: keyId,
      publicKey: keyPair.pubKey,
      privateKey: keyPair.privKey,
      created_at: Date.now(),
      confirmed: Boolean(confirmed),
    };

    await this._saveToCache('signedPreKeys', keyId, data);
    await this.storage.createOrUpdateSignedPreKey(data);
  }

  async removeSignedPreKey(keyId) {
    await this._removeFromCache('signedPreKeys', keyId);
    await this.storage.removeSignedPreKeyById(keyId);
  }

  async clearSignedPreKeysStore() {
    this.signedPreKeys = Object.create(null);
    await this.storage.removeAllSignedPreKeys();
  }

  // Sessions

  async loadSession(encodedNumber) {
    if (encodedNumber === null || encodedNumber === undefined) {
      throw new Error('Tried to get session for undefined/null number');
    }

    debug('loadSession() => encodedNumber:', encodedNumber);
    debug('loadSession() => this.sessions', this.sessions);
    const session = await this._getFromCache('sessions', encodedNumber);
    debug('loadSession() => session:', session);
    if (session) {
      return session.record;
    }

    return undefined;
  }

  async storeSession(encodedNumber, record) {
    if (encodedNumber === null || encodedNumber === undefined) {
      throw new Error('Tried to put session for undefined/null number');
    }
    const unencoded = helpers.unencodeNumber(encodedNumber);
    const number = unencoded[0];
    const deviceId = parseInt(unencoded[1], 10);

    const data = {
      id: encodedNumber,
      number,
      deviceId,
      record,
    };

    await this._saveToCache('sessions', encodedNumber, data);
    await this.storage.createOrUpdateSession(data);
  }

  async getDeviceIds(number) {
    debug(`Getting device IDs for number ${number}`);
    if (number === null || number === undefined) {
      throw new Error('Tried to get device ids for undefined/null number');
    }

    const allSessions = Object.values(this.sessions);
    debug('allSessions:', allSessions);
    const sessions = allSessions.filter(session => session.number === number);
    return _.pluck(sessions, 'deviceId');
  }

  async removeSession(encodedNumber) {
    debug('deleting session for ', encodedNumber);
    await this._removeFromCache('sessions', encodedNumber);
    await this.storage.removeSessionById(encodedNumber);
  }

  async removeAllSessions(number) {
    if (number === null || number === undefined) {
      throw new Error('Tried to remove sessions for undefined/null number');
    }

    const allSessions = Object.values(this.sessions);
    const removeFromCache = [];
    for (let i = 0, max = allSessions.length; i < max; i += 1) {
      const session = allSessions[i];
      if (session.number === number) {
        removeFromCache.push(this._removeFromCache('sessions', session.id));
      }
    }
    await Promise.all(removeFromCache);
    await this.storage.removeSessionsByNumber(number);
  }

  async archiveSiblingSessions(identifier) {
    const address = libsignal.SignalProtocolAddress.fromString(identifier);

    const deviceIds = await this.getDeviceIds(address.getName());
    const siblings = _.without(deviceIds, address.getDeviceId());

    await Promise.all(
      siblings.map(async deviceId => {
        const sibling = new libsignal.SignalProtocolAddress(
          address.getName(),
          deviceId
        );
        debug('closing session for', sibling.toString());
        const sessionCipher = new libsignal.SessionCipher(this, sibling);
        await sessionCipher.closeOpenSessionForDevice();
      })
    );
  }

  async archiveAllSessions(number) {
    const deviceIds = await this.getDeviceIds(number);

    await Promise.all(
      deviceIds.map(async deviceId => {
        const address = new libsignal.SignalProtocolAddress(number, deviceId);
        debug('closing session for', address.toString());
        const sessionCipher = new libsignal.SessionCipher(this, address);
        await sessionCipher.closeOpenSessionForDevice();
      })
    );
  }

  async clearSessionStore() {
    this.sessions = Object.create(null);
    this.storage.removeAllSessions();
  }

  // Identity Keys

  async isTrustedIdentity(identifier, publicKey, direction) {
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to get identity key for undefined/null key');
    }
    const number = helpers.unencodeNumber(identifier)[0];
    const isOurNumber = number === (await this.getNumber());

    const identityRecord = await this._getFromCache('identityKeys', number);

    if (isOurNumber) {
      const existing = identityRecord
        ? helpers.convertToArrayBuffer(identityRecord.publicKey)
        : null;
      return helpers.equalArrayBuffers(existing, publicKey);
    }

    switch (direction) {
      case Direction.SENDING:
        return this.isTrustedForSending(publicKey, identityRecord);
      case Direction.RECEIVING:
        return true;
      default:
        throw new Error(`Unknown direction: ${direction}`);
    }
  }

  isTrustedForSending(publicKey, identityRecord) {
    if (!identityRecord) {
      debug('isTrustedForSending: No previous record, returning true...');
      return true;
    }

    const existing = helpers.convertToArrayBuffer(identityRecord.publicKey);

    if (!existing) {
      debug('isTrustedForSending: Nothing here, returning true...');
      return true;
    }
    if (!helpers.equalArrayBuffers(existing, publicKey)) {
      debug("isTrustedForSending: Identity keys don't match...");
      return false;
    }
    if (identityRecord.verified === VerifiedStatus.UNVERIFIED) {
      debug('Needs unverified approval!');
      return false;
    }
    if (this.isNonBlockingApprovalRequired(identityRecord)) {
      debug('isTrustedForSending: Needs non-blocking approval!');
      return false;
    }

    return true;
  }

  async loadIdentityKey(identifier) {
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to get identity key for undefined/null key');
    }
    const number = helpers.unencodeNumber(identifier)[0];
    const identityRecord = await this._getFromCache('identityKeys', number);

    if (identityRecord) {
      return helpers.convertToArrayBuffer(identityRecord.publicKey);
    }

    return undefined;
  }

  async _saveIdentityKey(data) {
    const { id } = data;
    this._saveToCache('identityKeys', id, data);
    await this.storage.createOrUpdateIdentityKey(data);
  }

  async saveIdentity(identifier, publicKey, nonblockingApproval) {
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to put identity key for undefined/null key');
    }
    if (!(publicKey instanceof ArrayBuffer)) {
      // eslint-disable-next-line no-param-reassign
      publicKey = helpers.convertToArrayBuffer(publicKey);
    }
    if (typeof nonblockingApproval !== 'boolean') {
      // eslint-disable-next-line no-param-reassign
      nonblockingApproval = false;
    }

    const number = helpers.unencodeNumber(identifier)[0];
    const identityRecord = await this._getFromCache('identityKeys', number);

    if (!identityRecord || !identityRecord.publicKey) {
      // Lookup failed, or the current key was removed, so save this one.
      debug('Saving new identity...');
      await this._saveIdentityKey({
        id: number,
        publicKey,
        firstUse: true,
        timestamp: Date.now(),
        verified: VerifiedStatus.DEFAULT,
        nonblockingApproval,
      });

      return false;
    }

    const oldpublicKey = helpers.convertToArrayBuffer(identityRecord.publicKey);
    if (!helpers.equalArrayBuffers(oldpublicKey, publicKey)) {
      debug('Replacing existing identity...');
      const previousStatus = identityRecord.verified;
      let verifiedStatus;
      if (
        previousStatus === VerifiedStatus.VERIFIED
        || previousStatus === VerifiedStatus.UNVERIFIED
      ) {
        verifiedStatus = VerifiedStatus.UNVERIFIED;
      } else {
        verifiedStatus = VerifiedStatus.DEFAULT;
      }

      await this._saveIdentityKey({
        id: number,
        publicKey,
        firstUse: false,
        timestamp: Date.now(),
        verified: verifiedStatus,
        nonblockingApproval,
      });

      try {
        this.trigger('keychange', number);
      } catch (error) {
        debug(
          'saveIdentity error triggering keychange:',
          error && error.stack ? error.stack : error
        );
      }
      await this.archiveSiblingSessions(identifier);

      return true;
    } if (this.isNonBlockingApprovalRequired(identityRecord)) {
      debug('Setting approval status...');

      identityRecord.nonblockingApproval = nonblockingApproval;
      await this._saveIdentityKey(identityRecord);

      return false;
    }

    return false;
  }

  isNonBlockingApprovalRequired(identityRecord) {
    return (
      !identityRecord.firstUse
      && Date.now() - identityRecord.timestamp < TIMESTAMP_THRESHOLD
      && !identityRecord.nonblockingApproval
    );
  }

  async saveIdentityWithAttributes(identifier, attributes) {
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to put identity key for undefined/null key');
    }

    const number = helpers.unencodeNumber(identifier)[0];
    const identityRecord = await this._getFromCache('identityKeys', number);

    const updates = {
      id: number,
      ...identityRecord,
      ...attributes,
    };

    // eslint-disable-next-line no-unused-vars
    const model = new IdentityRecord(updates);
    await this._saveIdentityKey(updates);
  }

  async setApproval(identifier, nonblockingApproval) {
    if (identifier === null || identifier === undefined) {
      throw new Error('Tried to set approval for undefined/null identifier');
    }
    if (typeof nonblockingApproval !== 'boolean') {
      throw new Error('Invalid approval status');
    }

    const number = helpers.unencodeNumber(identifier)[0];
    const identityRecord = await this._getFromCache('identityKeys', number);

    if (!identityRecord) {
      throw new Error(`No identity record for ${number}`);
    }

    identityRecord.nonblockingApproval = nonblockingApproval;
    await this._saveIdentityKey(identityRecord);
  }

  async setVerified(number, verifiedStatus, publicKey) {
    if (number === null || number === undefined) {
      throw new Error('Tried to set verified for undefined/null key');
    }
    if (!validateVerifiedStatus(verifiedStatus)) {
      throw new Error('Invalid verified status');
    }
    if (arguments.length > 2 && !(publicKey instanceof ArrayBuffer)) {
      throw new Error('Invalid public key');
    }

    const identityRecord = await this._getFromCache('identityKeys', number);
    if (!identityRecord) {
      throw new Error(`No identity record for ${number}`);
    }

    if (
      !publicKey
      || helpers.equalArrayBuffers(identityRecord.publicKey, publicKey)
    ) {
      identityRecord.verified = verifiedStatus;

      // eslint-disable-next-line no-unused-vars
      const model = new IdentityRecord(identityRecord);
      await this._saveIdentityKey(identityRecord);
    } else {
      debug('No identity record for specified publicKey');
    }
  }

  async getVerified(number) {
    if (number === null || number === undefined) {
      throw new Error('Tried to set verified for undefined/null key');
    }

    const identityRecord = await this._getFromCache('identityKeys', number);
    if (!identityRecord) {
      throw new Error(`No identity record for ${number}`);
    }

    const verifiedStatus = identityRecord.verified;
    if (validateVerifiedStatus(verifiedStatus)) {
      return verifiedStatus;
    }

    return VerifiedStatus.DEFAULT;
  }

  // Resolves to true if a new identity key was saved
  processContactSyncVerificationState(identifier, verifiedStatus, publicKey) {
    if (verifiedStatus === VerifiedStatus.UNVERIFIED) {
      return this.processUnverifiedMessage(
        identifier,
        verifiedStatus,
        publicKey
      );
    }
    return this.processVerifiedMessage(identifier, verifiedStatus, publicKey);
  }

  // This function encapsulates the non-Java behavior, since the mobile apps don't
  //   currently receive contact syncs and therefore will see a verify sync with
  //   UNVERIFIED status
  async processUnverifiedMessage(number, verifiedStatus, publicKey) {
    if (number === null || number === undefined) {
      throw new Error('Tried to set verified for undefined/null key');
    }
    if (publicKey !== undefined && !(publicKey instanceof ArrayBuffer)) {
      throw new Error('Invalid public key');
    }

    const identityRecord = await this._getFromCache('identityKeys', number);
    const isPresent = Boolean(identityRecord);
    let isEqual = false;

    if (isPresent && publicKey) {
      isEqual = helpers.equalArrayBuffers(publicKey, identityRecord.publicKey);
    }

    if (
      isPresent
      && isEqual
      && identityRecord.verified !== VerifiedStatus.UNVERIFIED
    ) {
      await this.setVerified(number, verifiedStatus, publicKey);
      return false;
    }

    if (!isPresent || !isEqual) {
      await this.saveIdentityWithAttributes(number, {
        publicKey,
        verified: verifiedStatus,
        firstUse: false,
        timestamp: Date.now(),
        nonblockingApproval: true,
      });

      if (isPresent && !isEqual) {
        try {
          this.trigger('keychange', number);
        } catch (error) {
          debug(
            'processUnverifiedMessage error triggering keychange:',
            error && error.stack ? error.stack : error
          );
        }

        await this.archiveAllSessions(number);

        return true;
      }
    }

    // The situation which could get us here is:
    //   1. had a previous key
    //   2. new key is the same
    //   3. desired new status is same as what we had before
    return false;
  }

  // This matches the Java method as of
  //   https://github.com/signalapp/Signal-Android/blob/d0bb68e1378f689e4d10ac6a46014164992ca4e4/src/org/thoughtcrime/securesms/util/IdentityUtil.java#L188
  async processVerifiedMessage(number, verifiedStatus, publicKey) {
    if (number === null || number === undefined) {
      throw new Error('Tried to set verified for undefined/null key');
    }
    if (!validateVerifiedStatus(verifiedStatus)) {
      throw new Error('Invalid verified status');
    }
    if (publicKey !== undefined && !(publicKey instanceof ArrayBuffer)) {
      throw new Error('Invalid public key');
    }

    const identityRecord = await this._getFromCache('identityKeys', number);

    const isPresent = Boolean(identityRecord);
    let isEqual = false;

    if (isPresent && publicKey) {
      isEqual = helpers.equalArrayBuffers(publicKey, identityRecord.publicKey);
    }

    if (!isPresent && verifiedStatus === VerifiedStatus.DEFAULT) {
      debug('No existing record for default status');
      return false;
    }

    if (
      isPresent
      && isEqual
      && identityRecord.verified !== VerifiedStatus.DEFAULT
      && verifiedStatus === VerifiedStatus.DEFAULT
    ) {
      await this.setVerified(number, verifiedStatus, publicKey);
      return false;
    }

    if (
      verifiedStatus === VerifiedStatus.VERIFIED
      && (!isPresent
        || (isPresent && !isEqual)
        || (isPresent && identityRecord.verified !== VerifiedStatus.VERIFIED))
    ) {
      await this.saveIdentityWithAttributes(number, {
        publicKey,
        verified: verifiedStatus,
        firstUse: false,
        timestamp: Date.now(),
        nonblockingApproval: true,
      });

      if (isPresent && !isEqual) {
        try {
          this.trigger('keychange', number);
        } catch (error) {
          debug(
            'processVerifiedMessage error triggering keychange:',
            error && error.stack ? error.stack : error
          );
        }

        await this.archiveAllSessions(number);

        // true signifies that we overwrote a previous key with a new one
        return true;
      }
    }

    // We get here if we got a new key and the status is DEFAULT. If the
    //   message is out of date, we don't want to lose whatever more-secure
    //   state we had before.
    return false;
  }

  async isUntrusted(number) {
    if (number === null || number === undefined) {
      throw new Error('Tried to set verified for undefined/null key');
    }

    const identityRecord = await this._getFromCache('identityKeys', number);
    if (!identityRecord) {
      throw new Error(`No identity record for ${number}`);
    }

    if (
      Date.now() - identityRecord.timestamp < TIMESTAMP_THRESHOLD
      && !identityRecord.nonblockingApproval
      && !identityRecord.firstUse
    ) {
      return true;
    }

    return false;
  }

  async removeIdentityKey(number) {
    await this._removeFromCache('identityKeys', number);
    await this.storage.removeIdentityKeyById(number);
    await this.removeAllSessions(number);
  }

  // Not yet processed messages - for resiliency
  async getUnprocessedCount() {
    return this.storage.getUnprocessedCount();
  }

  async getAllUnprocessed() {
    return this.storage.getAllUnprocessed();
  }

  async getUnprocessedById(id) {
    return this.storage.getUnprocessedById(id);
  }

  async addUnprocessed(data) {
    // We need to pass forceSave because the data has an id already, which will cause
    //   an update instead of an insert.
    return this.storage.saveUnprocessed(data, {
      forceSave: true,
    });
  }

  async batchAddUnprocessed(array) {
    array.map(item => this.storage.saveUnprocessed(item, { forceSave: true }));
  }

  async updateUnprocessedAttempts(id, attempts) {
    return this.storage.updateUnprocessedAttempts(id, attempts);
  }

  async updateUnprocessedWithData(id, data) {
    return this.storage.updateUnprocessedWithData(id, data);
  }

  async updateUnprocessedsWithData(array) {
    array.map(item => this.storage.updateUnprocessedWithData(item.id, item.data));
  }

  async removeUnprocessed(id) {
    return this.storage.removeUnprocessed(id);
  }

  async removeAllUnprocessed() {
    return this.storage.removeAllUnprocessed();
  }

  async removeAllData() {
    await this.storage.removeAll();
    await this.load();
  }

  async removeAllConfiguration() {
    this.configuration = Object.create(null);
    await this.storage.removeAllConfiguration();
  }

  // GROUPS

  async getGroup(groupId) {
    if (!this.hasGroups()) {
      throw new Error('This storage backend does not support groups.');
    }
    return this.storage.getGroupById(groupId).then(group => {
      if (!group) return undefined;

      return { id: groupId, numbers: group.numbers };
    });
  }

  async getGroupNumbers(groupId) {
    if (!this.hasGroups()) {
      throw new Error('This storage backend does not support groups.');
    }
    const group = await this.getGroup(groupId);
    if (!group) return undefined;

    return group.numbers;
  }

  async createNewGroup(groupId, numbers) {
    if (!this.hasGroups()) {
      throw new Error('This storage backend does not support groups.');
    }
    debug('Creating new group.');
    return new Promise(resolve => {
      if (!groupId) {
        debug('No groupId specified, generating new groupId');
        resolve(
          crypto.generateGroupId().then(newGroupId => {
            // eslint-disable-next-line no-param-reassign
            groupId = newGroupId;
          })
        );
      } else {
        resolve(
          this.getGroup(groupId).then(group => {
            if (group !== undefined) {
              throw new Error('Tried to recreate group');
            }
          })
        );
      }
    })
      .then(() => this.getNumber())
      .then(me => {
        let haveMe = false;
        const finalNumbers = [];
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const i in numbers) {
          const number = numbers[i];
          if (!helpers.isNumberSane(number))
            throw new Error('Invalid number in group');
          if (number === me) haveMe = true;
          if (finalNumbers.indexOf(number) < 0) finalNumbers.push(number);
        }

        if (!haveMe) finalNumbers.push(me);

        const groupObject = {
          id: groupId,
          numbers: finalNumbers,
          numberRegistrationIds: {},
        };
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const i in finalNumbers) {
          groupObject.numberRegistrationIds[finalNumbers[i]] = {};
        }

        return this._saveToCache('groups', groupId, groupObject)
          .then(this.storage.createOrUpdateGroup(groupObject))
          .then(() => ({ id: groupId, numbers: finalNumbers }));
      });
  }

  async deleteGroup(groupId) {
    if (!this.hasGroups()) {
      throw new Error('This storage backend does not support groups.');
    }
    await this._removeFromCache('groups', groupId);
    await this.storage.removeGroupById(groupId);
  }

  async updateGroupNumbers(groupId, numbers) {
    if (!this.hasGroups()) {
      throw new Error('This storage backend does not support groups.');
    }
    return this.getGroup(groupId).then(group => {
      if (group === undefined)
        throw new Error('Tried to update numbers for unknown group');

      if (numbers.filter(helpers.isNumberSane).length < numbers.length)
        throw new Error('Invalid number in new group members');

      const added = numbers.filter(number => group.numbers.indexOf(number) < 0);

      return this.addGroupNumbers(groupId, added);
    });
  }

  async addGroupNumbers(groupId, numbers) {
    if (!this.hasGroups()) {
      throw new Error('This storage backend does not support groups.');
    }
    return this.getGroup(groupId).then(group => {
      if (group === undefined) return undefined;

      // eslint-disable-next-line no-restricted-syntax, guard-for-in
      for (const i in numbers) {
        const number = numbers[i];
        if (!helpers.isNumberSane(number))
          throw new Error('Invalid number in set to add to group');
        if (group.numbers.indexOf(number) < 0) {
          group.numbers.push(number);
          // eslint-disable-next-line no-param-reassign
          group.numberRegistrationIds[number] = {};
        }
      }

      return this._saveToCache('groups', groupId, group).then(() => {
        this.storage.createOrUpdateGroup(group);
        return group.numbers;
      });
    });
  }

  async removeGroupNumber(groupId, number) {
    if (!this.hasGroups()) {
      throw new Error('This storage backend does not support groups.');
    }
    return this.getGroup(groupId).then(group => {
      if (group === undefined) return undefined;

      const me = this.getNumber();
      if (number === me)
        throw new Error(
          'Cannot remove ourselves from a group, leave the group instead'
        );

      const i = group.numbers.indexOf(number);
      if (i > -1) {
        group.numbers.splice(i, 1);
        // eslint-disable-next-line no-param-reassign
        // delete group.numberRegistrationIds[number];
        return this._saveToCache('groups', groupId, group).then(() => {
          this.storage.createOrUpdateGroup(group);
          return group.numbers;
        });
      }

      return group.numbers;
    });
  }

  // OPTIONS

  async _saveConfiguration(id, value) {
    await this._saveToCache('configuration', id, { id, value });
    await this.storage.createOrUpdateConfiguration({ id, value });
  }

  async _removeConfiguration(id) {
    await this._removeFromCache('configuration', id);
    await this.storage.removeConfigurationById(id);
  }

  async _getConfiguration(id) {
    const data = await this._getFromCache('configuration', id);
    if (data === undefined) return undefined;
    return data.value;
  }

  // User storage

  async getIdentityKeyPair() {
    const pair = await this._getConfiguration('identityKey');
    let { pubKey, privKey } = pair;
    if (!(pubKey instanceof ArrayBuffer)) {
      // eslint-disable-next-line no-param-reassign
      pubKey = helpers.convertToArrayBuffer(pubKey);
    }
    if (!(privKey instanceof ArrayBuffer)) {
      // eslint-disable-next-line no-param-reassign
      privKey = helpers.convertToArrayBuffer(privKey);
    }
    return { privKey, pubKey };
  }

  async getLocalRegistrationId() {
    return this._getConfiguration('registrationId');
  }

  async setNumberAndDeviceId(number, deviceId, deviceName) {
    await this._saveConfiguration('number_id', `${number  }.${  deviceId}`);
    if (deviceName) {
      await this._saveConfiguration('device_name', deviceName);
    }
  }

  async setUuidAndDeviceId(uuid, deviceId, deviceName) {
    await this._saveConfiguration('uuid_id', `${uuid  }.${  deviceId}`);
    if (deviceName) {
      await this._saveConfiguration('device_name', deviceName);
    }
  }

  async getNumber() {
    const number_id = await this._getConfiguration('number_id');
    if (number_id === undefined) return undefined;
    return helpers.unencodeNumber(number_id)[0];
  }

  async getUuid() {
    const uuid_id = await this._getConfiguration('uuid_id');
    if (uuid_id === undefined) return undefined;
    return helpers.unencodeNumber(uuid_id)[0];
  }

  async _getDeviceIdFromUuid() {
    const uuid_id = await this._getConfiguration('uuid_id');
    if (uuid_id === undefined) return undefined;
    return helpers.unencodeNumber(uuid_id)[1];
  }

  async _getDeviceIdFromNumber() {
    const number_id = await this._getConfiguration('number_id');
    if (number_id === undefined) return undefined;
    return helpers.unencodeNumber(number_id)[1];
  }

  async getDeviceId() {
    return this._getDeviceIdFromUuid() || this._getDeviceIdFromNumber();
  }

  async removeNumberAndDeviceId() {
    await this._removeConfiguration('number_id');
  }

  async getDeviceName() {
    return this._getConfiguration('device_name');
  }

  async removeDeviceName() {
    await this._removeConfiguration('device_name');
  }

  async setDeviceNameEncrypted() {
    await this._saveConfiguration('deviceNameEncrypted', true);
  }

  async getDeviceNameEncrypted() {
    return this._getConfiguration('deviceNameEncrypted');
  }

  async getSignalingKey() {
    return this._getConfiguration('signaling_key');
  }

  // Other options

  async getSignedKeyId() {
    const value = await this._getConfiguration('signedKeyId');
    if (value === undefined) return 1;
    return value;
  }

  async setSignedKeyId(value) {
    await this._saveConfiguration('signedKeyId', value);
  }

  async removeSignedKeyId() {
    await this._removeConfiguration('signedKeyId');
  }

  async getSignedKeyRotationRejected() {
    const value = await this._getFromCache(
      'configuration',
      'signedKeyRotationRejected'
    );
    if (value === undefined) return 0;
    return value;
  }

  async setSignedKeyRotationRejected(value) {
    await this._saveConfiguration('signedKeyRotationRejected', value);
  }

  async removeSignedKeyRotationRejected() {
    await this._removeConfiguration('signedKeyRotationRejected');
  }

  async getMaxPreKeyId() {
    const value = await this._getConfiguration('maxPreKeyId');
    if (value === undefined) return 1;
    return value;
  }

  async setMaxPreKeyId(value) {
    await this._saveConfiguration('maxPreKeyId', value);
  }

  async getBlocked() {
    const value = await this._getConfiguration('blocked');
    if (value === undefined) return [];
    return value;
  }

  async setBlocked(value) {
    await this._saveConfiguration('blocked', value);
  }

  async getBlockedUuids() {
    const value = await this._getConfiguration('blocked-uuids');
    if (value === undefined) return [];
    return value;
  }

  async setBlockedUuids(value) {
    await this._saveConfiguration('blocked-uuids', value);
  }

  async getBlockedGroups() {
    const value = await this._getConfiguration('blocked-groups');
    if (value === undefined) return [];
    return value;
  }

  async setBlockedGroups(value) {
    await this._saveConfiguration('blockedGroups', value);
  }

  async setIdentityKeyPair(value) {
    await this._saveConfiguration('identityKey', value);
  }

  async removeIdentityKeyPair() {
    await this._removeConfiguration('identityKey');
  }

  async getPassword() {
    return this._getConfiguration('password');
  }

  async setPassword(value) {
    await this._saveConfiguration('password', value);
  }

  async removePassword() {
    await this._removeConfiguration('password');
  }

  async setLocalRegistrationId(value) {
    await this._saveConfiguration('registrationId', value);
  }

  async removeLocalRegistrationId() {
    await this._saveConfiguration('registrationId');
  }

  async getProfileKey() {
    return this._getConfiguration('profileKey');
  }

  async setProfileKey(value) {
    await this._saveConfiguration('profileKey', value);
  }

  async removeProfileKey() {
    await this._removeConfiguration('profileKey');
  }

  async setUserAgent(value) {
    await this._saveConfiguration('userAgent', value);
  }

  async removeUserAgent() {
    await this._removeConfiguration('userAgent');
  }

  async setReadReceiptSetting(value) {
    await this._saveConfiguration('read-receipts-setting', value);
  }

  async removeReadReceiptsSetting() {
    await this._removeConfiguration('read-receipts-setting');
  }

  async setRegionCode(value) {
    await this._saveConfiguration('regionCode', value);
  }

  async removeRegionCode() {
    await this._removeConfiguration('regionCode');
  }

  async setSignalingKey(value) {
    await this._saveConfiguration('signaling_key', value);
  }

  // Groups
}

exports = module.exports = ProtocolStore;
