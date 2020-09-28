/*
 * vim: ts=2:sw=2:expandtab
 */



/* eslint-disable more/no-then */
const debug = require('debug')('libsignal-service:TaskWithTimeout');

// eslint-disable-next-line func-names
exports = module.exports = (task, id, options = {}) => {
  const timeout = options.timeout || 1000 * 60 * 2; // two minutes

  const errorForStack = new Error('for stack');
  return () =>
    new Promise((resolve, reject) => {
      let complete = false;
      let timer = setTimeout(() => {
        if (!complete) {
          const message = `${id
            || ''} task did not complete in time. Calling stack: ${
            errorForStack.stack
          }`;

          debug(message);
          return reject(new Error(message));
        }

        return null;
      }, timeout);
      const clearTimer = () => {
        try {
          const localTimer = timer;
          if (localTimer) {
            timer = null;
            clearTimeout(localTimer);
          }
        } catch (error) {
          debug(
            id || '',
            'task ran into problem canceling timer. Calling stack:',
            errorForStack.stack
          );
        }
      };

      const success = result => {
        clearTimer();
        complete = true;
        return resolve(result);
      };
      const failure = error => {
        clearTimer();
        complete = true;
        return reject(error);
      };

      let promise;
      try {
        promise = task();
      } catch (error) {
        clearTimer();
        throw error;
      }
      if (!promise || !promise.then) {
        clearTimer();
        complete = true;
        return resolve(promise);
      }

      return promise.then(success, failure);
    });
};
