import { textsecure } from '../lib/ts/textsecure/index';
export { AttachmentType, CallbackResultType, SendOptionsType } from '../lib/ts/textsecure/SendMessage';
import { AttachmentType, CallbackResultType, SendOptionsType } from '../lib/ts/textsecure/SendMessage';
import { getCredentials, maybeInitMessaging } from './utils';

export type PreviewType = {
  url: string;
  title: string;
  image: AttachmentType;
};

export interface SendMessageParams {
  identifier: string;
  messageText?: string;
  attachments?: Array<AttachmentType>;
  quote?: unknown;
  preview?: Array<PreviewType>;
  sticker?: unknown;
  reaction?: unknown;
  deletedForEveryoneTimestamp?: number;
  timestamp?: number;
  expireTimer?: number;
  profileKey?: ArrayBuffer;
  options?: SendOptionsType;
}

export class MessageSender {
  private _inner: InstanceType<typeof textsecure.MessageSender>;
  constructor() {
    const [username, password] = getCredentials();
    maybeInitMessaging(username, password);
    this._inner = new textsecure.MessageSender(username, password);
  }

  async sendMessageToIdentifier({
    identifier,
    messageText,
    attachments,
    quote,
    preview,
    sticker,
    reaction,
    deletedForEveryoneTimestamp,
    timestamp = Date.now(),
    expireTimer,
    profileKey,
    options,
  }: SendMessageParams): Promise<CallbackResultType> {
    return this._inner.sendMessage(
      {
        recipients: [identifier],
        body: messageText,
        timestamp,
        attachments,
        quote,
        preview,
        sticker,
        reaction,
        deletedForEveryoneTimestamp,
        expireTimer,
        profileKey,
      },
      options
    );
  }
}
