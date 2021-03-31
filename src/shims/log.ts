import { default as log } from 'debug';

const windowLog = (level: string, ...args: any[]) => {
  const [ first, ...rest ] = args;
  log(`libsignal-service:${level}`)(first, ...rest);
};

const debug = (...args: any[]) => windowLog('debug', ...args);
const error = (...args: any[]) => windowLog('error', ...args);
const info = (...args: any[]) => windowLog('info', ...args);
const warn = (...args: any[]) => windowLog('warn', ...args);

export { debug, error, info, warn };
