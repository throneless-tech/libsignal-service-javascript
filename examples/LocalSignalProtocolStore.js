"use strict";
const helpers = require("../src/helpers.js");
const LocalStorage = require("node-localstorage").LocalStorage;

class Storage {
  constructor(path) {
    this._store = new LocalStorage(path);
  }

  _put(namespace, id, data) {
    this._store.setItem("" + namespace + id, helpers.jsonThing(data));
  }

  _get(namespace, id) {
    const value = this._store.getItem("" + namespace + id);
    return JSON.parse(value);
  }

  _getAll(namespace) {
    const collection = [];
    for (let id of this._store._keys) {
      if (id.startsWith(namespace)) {
        collection.push(this._get("", id));
      }
    }
    return collection;
  }

  _getAllIds(namespace) {
    const collection = [];
    for (let key of this._store._keys) {
      if (key.startsWith(namespace)) {
        const { id } = this._get("", key);
        collection.push(id);
      }
    }
    return collection;
  }

  _remove(namespace, id) {
    this._store.removeItem("" + namespace + id);
  }

  _removeAll(namespace) {
    for (let id of this._store._keys) {
      if (id.startsWith(namespace)) {
        this._remove("", id);
      }
    }
  }

  async getAllIdentityKeys() {
    return this._getAll("identityKey");
  }

  async createOrUpdateIdentityKey(data) {
    const { id } = data;
    this._put("identityKey", id, data);
  }

  async removeIdentityKeyById(id) {
    this._remove("identityKey", id);
  }

  async getAllSessions() {
    return this._getAll("session");
  }

  async createOrUpdateSession(data) {
    const { id } = data;
    this._put("session", id, data);
  }

  async removeSessionById(id) {
    this._remove("session", id);
  }

  async removeSessionsByNumber(number) {
    for (let id of this._store._keys) {
      if (id.startsWith("session")) {
        const session = this._get("", id);
        if (session.number === number) {
          this._remove("", id);
        }
      }
    }
  }

  async removeAllSessions() {
    this._removeAll("session");
  }

  async getAllPreKeys() {
    return this._getAll("25519KeypreKey");
  }

  async createOrUpdatePreKey(data) {
    const { id } = data;
    this._put("25519KeypreKey", id, data);
  }
  async removePreKeyById(id) {
    this._remove("25519KeypreKey", id);
  }
  async removeAllPreKeys() {
    return this._removeAll("25519KeypreKey");
  }

  async getAllSignedPreKeys() {
    return this._getAll("25519KeysignedKey");
  }

  async createOrUpdateSignedPreKey(data) {
    const { id } = data;
    this._put("25519KeysignedKey", id, data);
  }

  async removeSignedPreKeyById(id) {
    this._remove("25519KeysignedKey", id);
  }
  async removeAllSignedPreKeys() {
    this._removeAll("25519KeysignedKey");
  }

  async getAllUnprocessed() {
    return this._getAll("unprocessed");
  }

  getUnprocessedCount() {
    let count = 0;
    for (let id of this._store._keys) {
      if (id.startsWith("unprocessed")) {
        count++;
      }
    }
    return count;
  }

  getUnprocessedById(id) {
    return this._get("unprocessed", id);
  }

  saveUnprocessed(data) {
    const { id } = data;
    this._put("unprocessed", id, data);
  }

  updateUnprocessedAttempts(id, attempts) {
    const data = this._get("unprocessed", id);
    data.attempts = attempts;
    this._put("unprocessed", id, data);
  }

  updateUnprocessedWithData(id, data) {
    this._put("unprocessed", id, data);
  }

  removeUnprocessed(id) {
    this._remove("unprocessed", id);
  }

  removeAllUnprocessed() {
    this._removeAll("unprocessed");
  }

  async createOrUpdateGroup(data) {
    const { id } = data;
    this._put("groups", id, data);
  }

  async getGroupById(id) {
    return this._get("groups", id);
  }

  async getAllGroups() {
    return this._getAll("groups");
  }

  async getAllGroupIds() {
    return this._getAllIds("groups");
  }

  async removeGroupById(id) {
    this._remove("groups", id);
  }

  async getAllConfiguration() {
    return this._getAll("configuration");
  }

  async createOrUpdateConfiguration(data) {
    const { id } = data;
    this._put("configuration", id, data);
  }

  async removeConfigurationById(id) {
    this._remove("configuration", id);
  }

  async removeAllConfiguration() {
    this._removeAll("configuration");
  }

  async removeAll() {
    this._store.clear();
  }
}

exports = module.exports = Storage;
