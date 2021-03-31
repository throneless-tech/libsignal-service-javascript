import { WebAPIType as WebAPITypeOrig } from '../../lib/ts/textsecure/WebAPI';

type ConnectParametersType = {
  username: string;
  password: string;
};

export type WebAPIConnectType = {
  connect: (options: ConnectParametersType) => WebAPIType;
};

export type WebAPIType = Omit<WebAPITypeOrig, 'requestVerificationSMS' | 'requestVerificationVoice'> & {
  requestVerificationSMS: (
    number: string,
    captchaToken?: string
  ) => Promise<any>;
  requestVerificationVoice: (
    number: string,
    captchaToken?: string
  ) => Promise<any>;
}
