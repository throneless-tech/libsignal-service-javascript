import { textsecure } from '../lib/ts/textsecure/index';
import { WebAPIType } from './types/WebAPI';

export class AccountManager {
  private _inner: InstanceType<typeof textsecure.AccountManager>;
  server: WebAPIType;

  constructor(username: string, password: string) {
    this._inner = new textsecure.AccountManager(username, password);
  }

  async requestVoiceVerification(number: string, captchaToken?: string) {
    return this.server.requestVerificationVoice(number, captchaToken);
  }

  async requestSMSVerification(number: string, captchaToken?: string) {
    return this.server.requestVerificationSMS(number, captchaToken);
  }

  async registerSingleDevice(number: string, verificationCode: string) {
    return this._inner.registerSingleDevice(number, verificationCode);
  }
}
