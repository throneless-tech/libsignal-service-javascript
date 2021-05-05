import utils from '../lib/ts/textsecure/Helpers';
import libsignal from './js/libsignal';

export function generatePassword() {
  const password = btoa(
    utils.getString(libsignal.KeyHelper.getRandomBytes(16))
  );
  return password.substring(0, password.length - 2);
}

export function generateGroupId() {
  return utils.getString(libsignal.KeyHelper.getRandomBytes(16));
}
