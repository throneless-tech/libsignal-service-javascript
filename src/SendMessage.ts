import { textsecure } from '../lib/ts/textsecure/index';
//import utils from '../lib/ts/textsecure/Helpers';

export class MessageSender extends textsecure.MessageSender {
  constructor(username?: string, password?: string) {
    const number_id = window.textsecure.storage.get('number_id');
    const storedPassword = window.textsecure.storage.get('password');

    const [storedUsername] = number_id ? number_id.split('.') : [];
    super(storedUsername ? storedUsername : username, storedPassword ? storedPassword : password);
    window.textsecure.messaging = this;
  }
}
