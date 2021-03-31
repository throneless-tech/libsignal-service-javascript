import { UnprocessedType } from '../lib/ts/textsecure.d';
import { StorageType } from './types/libsignal';

const BLOCKED_NUMBERS_ID = 'blocked';
const BLOCKED_UUIDS_ID = 'blocked-uuids';
const BLOCKED_GROUPS_ID = 'blocked-groups';

export class Storage {
  private ready: Boolean;
  private items: Record<string|number, any>;
  private storage: any;

  constructor(storage: StorageType) {
    this.ready = false;
    this.items = {};
    this.storage = storage;
  }

  reset(): void {
    this.ready = false;
    this.items = {};
  }

  async put(key: string | number, value: any) {
    if (value === undefined) {
      window.log.warn(`storage/put: undefined provided for key ${key}`);
    }
    if (!this.ready) {
      window.log.warn('Called storage.put before storage is ready. key:', key);
    }

    const data = { id: key, value };

    this.items[key] = data;
    await this.storage.createOrUpdateItem(data);
  }

  get(key: string | number, defaultValue?: any) {
    if (!this.ready) {
      window.log.warn('Called storage.get before storage is ready. key:', key);
    }

    const item = this.items[key];
    if (!item) {
      return defaultValue;
    }

    return item.value;
  }

  async remove(key: string | number) {
    if (!this.ready) {
      window.log.warn(
        'Called storage.remove before storage is ready. key:',
        key
      );
    }

    delete this.items[key];
    await this.storage.removeItemById(key);
  }


  async fetch(): Promise<void>{
    this.reset();
    const array = await this.storage.getAllItems();

    for (let i = 0, max = array.length; i < max; i += 1) {
      const item = array[i];
      const { id } = item;
      this.items[id] = item;
    }

    this.ready = true;
  }

  // blocked numbers
  protected getArray(key: string)  {
    const result = this.get(key, []);

    if (!Array.isArray(result)) {
      window.log.error(
        `Expected storage key ${JSON.stringify(
          key
        )} to contain an array or nothing`
      );
      return [];
    }

    return result;
  }

  getBlockedNumbers() {
    return this.getArray(BLOCKED_NUMBERS_ID);
  }

  isBlocked(number: string) {
    const numbers = this.getBlockedNumbers();

    return numbers.includes(number);
  }

  addBlockedNumber(number: string) {
    const numbers = this.getBlockedNumbers();
    if (numbers.includes(number)) {
      return;
    }

    window.log.info('adding', number, 'to blocked list');
    this.put(BLOCKED_NUMBERS_ID, numbers.concat(number));
  }

  removeBlockedNumber(number: string) {
    const numbers = this.getBlockedNumbers();
    if (!numbers.includes(number)) {
      return;
    }

    window.log.info('removing', number, 'from blocked list');
    this.put(BLOCKED_NUMBERS_ID, numbers.filter(n => n !== number));
  }

  getBlockedUuids() {
    return this.getArray(BLOCKED_UUIDS_ID);
  }

  isUuidBlocked(uuid: string) {
    const uuids = this.getBlockedUuids();

    return uuids.includes(uuid);
  }

  addBlockedUuid(uuid: string) {
    const uuids = this.getBlockedUuids();
    if (uuids.includes(uuid)) {
      return;
    }

    window.log.info('adding', uuid, 'to blocked list');
    this.put(BLOCKED_UUIDS_ID, uuids.concat(uuid));
  }

  removeBlockedUuid(uuid: string) {
    const numbers = this.getBlockedUuids();
    if (!numbers.includes(uuid)) {
      return;
    }

    window.log.info('removing', uuid, 'from blocked list');
    this.put(BLOCKED_UUIDS_ID, numbers.filter(u=> u !== uuid));
  }

  getBlockedGroups() {
    return this.getArray(BLOCKED_GROUPS_ID);
  }

  isGroupBlocked(groupId: string) {
    const groupIds = this.getBlockedGroups();

    return groupIds.includes(groupId);
  }

  addBlockedGroup(groupId: string) {
    const groupIds = this.getBlockedGroups();
    if (groupIds.includes(groupId)) {
      return;
    }

    window.log.info(`adding group(${groupId}) to blocked list`);
    this.put(BLOCKED_GROUPS_ID, groupIds.concat(groupId));
  }

  removeBlockedGroup(groupId: string) {
    const groupIds = this.getBlockedGroups();
    if (!groupIds.includes(groupId)) {
      return;
    }

    window.log.info(`removing group(${groupId} from blocked list`);
    this.put(BLOCKED_GROUPS_ID, groupIds.filter(g => g !== groupId));
  };
}

export class StorageImpl {
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  async put(key: string, value: unknown) {
    return this.storage.put(key, value);
  }

  async get(key: string, defaultValue: unknown): Promise<unknown> {
    return this.storage.get(key, defaultValue);
  }

  async remove(key: string) {
    return this.storage.remove(key);
  }
}

function unencodeNumber(number: string): Array<string> {
  return number.split('.');
}

export class StorageUser {
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  async setNumberAndDeviceId(number: string, deviceId: number, deviceName: string | null | undefined) {
    await this.storage.put('number_id', `${number}.${deviceId}`);
    if (deviceName) {
      await this.storage.put('device_name', deviceName);
    }
  }

  async setUuidAndDeviceId(uuid: string, deviceId: number) {
    await this.storage.put('uuid_id', `${uuid}.${deviceId}`);
  }

  getNumber() {
    const numberId = this.storage.get('number_id', undefined);
    if (numberId === undefined) return undefined;
    return unencodeNumber(numberId)[0];
  }

  getUuid() {
    const uuid = this.storage.get('uuid_id', undefined);
    if (uuid === undefined) return undefined;
    return unencodeNumber(uuid.toLowerCase())[0];
  }

  getDeviceId() {
    return this._getDeviceIdFromUuid() || this._getDeviceIdFromNumber();
  }

  private _getDeviceIdFromUuid() {
    const uuid = this.storage.get('uuid_id', undefined);
    if (uuid === undefined) return undefined;
    return unencodeNumber(uuid)[1];
  }

  _getDeviceIdFromNumber() {
    const numberId = this.storage.get('number_id', undefined);
    if (numberId === undefined) return undefined;
    return unencodeNumber(numberId)[1];
  }

  getDeviceName() {
    return this.storage.get('device_name', undefined);
  }

  async setDeviceNameEncrypted() {
    return this.storage.put('deviceNameEncrypted', true);
  }

  getDeviceNameEncrypted() {
    return this.storage.get('deviceNameEncrypted', undefined);
  }

  getSignalingKey() {
    return this.storage.get('signaling_key', undefined);
  }
}

export class StorageUnprocessed {
  private protocol: StorageType;

  constructor(protocol: StorageType) {
    this.protocol = protocol;
  }

  getCount() {
    return this.protocol.getUnprocessedCount();
  }

  getAll() {
    return this.protocol.getAllUnprocessed();
  }

  get(id: string) {
    return this.protocol.getUnprocessedById(id);
  }

  async add(data: UnprocessedType) {
    return this.protocol.saveUnprocessed(data);
  }
  
  async batchAdd(array: Array<UnprocessedType>) {
    return this.protocol.saveUnprocesseds(array);
  }

  async updateAttempts(id: string, attempts: number) {
    return this.protocol.updateUnprocessedAttempts(
      id,
      attempts
    );
  }

  async addDecryptedData(id: string, data: UnprocessedType) {
    return this.protocol.updateUnprocessedWithData(id, data);
  }
  
  async addDecryptedDataToList(array: Array<Partial<UnprocessedType>>) {
    return this.protocol.updateUnprocessedsWithData(array);
  }

  async remove(idOrArray: string | Array<string>) {
    return this.protocol.removeUnprocessed(idOrArray);
  }
  
  async removeAll() {
    return this.protocol.removeAllUnprocessed();
  }
};
