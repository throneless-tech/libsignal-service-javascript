import { textsecure } from '../lib/ts/textsecure/index';
import { WebAPIType } from './types/WebAPI';

class AccountManagerInner extends textsecure.AccountManager {
  server: WebAPIType;

  async requestVoiceVerification(number: string, captchaToken?: string) {
    return this.server.requestVerificationVoice(number, captchaToken);
  }

  async requestSMSVerification(number: string, captchaToken?: string) {
    console.log('***AccountManagerInner***');
    return this.server.requestVerificationSMS(number, captchaToken);
  }
}

export class AccountManager {
  private _inner: InstanceType<typeof AccountManagerInner>;

  constructor(username: string, password: string) {
    this._inner = new AccountManagerInner(username, password);
  }

  async requestVoiceVerification(number: string, captchaToken?: string) {
    return this._inner.requestVoiceVerification(number, captchaToken);
  }

  async requestSMSVerification(number: string, captchaToken?: string) {
    return this._inner.requestSMSVerification(number, captchaToken);
  }

  async registerSingleDevice(number: string, verificationCode: string) {
    return this._inner.registerSingleDevice(number, verificationCode);
  }
}
