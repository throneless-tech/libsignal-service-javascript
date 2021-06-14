import { textsecure } from '../lib/ts/textsecure/index';
import utils from '../lib/ts/textsecure/Helpers';
import { libsignal } from './js/libsignal';

export function generatePassword() {
  const password = btoa(
    utils.getString(libsignal.crypto.getRandomBytes(16))
  );
  return password.substring(0, password.length - 2);
}

export function generateGroupId() {
  return utils.getString(libsignal.crypto.getRandomBytes(16));
}

export function getCredentials(): [string, string] {
  const number_id = window.textsecure.storage.get('number_id');
  const password = window.textsecure.storage.get('password');

  const [username] = number_id ? number_id.split('.') : [];
  if (!username || !password) {
    throw new Error('No valid credentials found in storage, please (re)register this account.');
  }
  return [username, password];
}

export function maybeInitMessaging(username: string, password: string) {
  if (!window.textsecure.messaging) {
    window.log.debug('Starting up global MessageSender instance');
    try {
      window.textsecure.messaging = new textsecure.MessageSender(
        username,
        password
      );
    } catch (err) {
      window.log.error('Failed to start up global MessageSender instance')
      throw err;
    }
  }
}

export function getConfig() {
  if (process.env.NODE_CONFIG_ENV) {
    return process.env.NODE_CONFIG_ENV === 'production' ? CONFIG_PROD : CONFIG_DEV;
  }
  return process.env.NODE_ENV === 'production' ? CONFIG_PROD : CONFIG_DEV;
}
