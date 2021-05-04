import config from 'config';
import { textsecure } from '../lib/ts/textsecure/index';

export class MessageReceiver extends textsecure.MessageReceiver {
  constructor() {
    const number_id = window.textsecure.storage.get('number_id');
    const password = window.textsecure.storage.get('password');
    const {serverTrustRoot} = config;

    const [username] = number_id ? number_id.split('.') : [];
    super(username, undefined, password, undefined, { serverTrustRoot });
  }
}
