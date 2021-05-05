import config from 'config';
import { textsecure } from '../lib/ts/textsecure/index';
import { AttachmentPointerClass, DownloadAttachmentType } from '../lib/ts/textsecure.d';

export class MessageReceiver {
  private _inner: InstanceType<typeof textsecure.MessageReceiver>;
  constructor({
    signalingKey,
  }: {
    signalingKey?: ArrayBuffer,
  }) {
    const number_id = window.textsecure.storage.get('number_id');
    const password = window.textsecure.storage.get('password');
    const {serverTrustRoot} = config;

    const [username] = number_id ? number_id.split('.') : [];
    this._inner = new textsecure.MessageReceiver(username, undefined, password, signalingKey, { serverTrustRoot });
  }

  addEventListener(name: string, handler: Function) {
    this._inner.addEventListener(name, handler);
  }

  async close() {
    this._inner.close();
  }

  async downloadAttachment(attachment: AttachmentPointerClass): Promise<DownloadAttachmentType> {
    return this._inner.downloadAttachment(attachment);
  }
}
