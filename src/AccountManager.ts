import { textsecure } from '../lib/ts/textsecure/index';
import { WebAPIType } from './types/WebAPI';

export class AccountManager extends textsecure.AccountManager {
  server: WebAPIType;

  async requestVoiceVerification(number: string, captchaToken?: string) {
    return this.server.requestVerificationVoice(number, captchaToken);
  }

  async requestSMSVerification(number: string, captchaToken?: string) {
    return this.server.requestVerificationSMS(number, captchaToken);
  }
}
