import { default as LongOrig } from 'long';

declare module "bytebuffer" {
  class Long extends LongOrig {}
}
