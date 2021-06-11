import fetch from 'node-fetch';
import semver from 'semver';
import ProxyAgent from 'proxy-agent';
import { Agent } from 'https';
import { initialize } from '../../lib/ts/textsecure/WebAPI';
import { getUserAgent } from '../../lib/ts/util/getUserAgent';
import { getConfig } from '../utils';

const CONFIG = getConfig();

const DEBUG = true;

function makeHTTPError(
  message,
  providedCode,
  response,
  stack
) {
  const code = providedCode > 999 || providedCode < 100 ? -1 : providedCode;
  const e = new Error(`${message}; code: ${code}`);
  e.name = 'HTTPError';
  e.code = code;
  if (DEBUG && response) {
    e.stack += `\nresponse: ${response}`;
  }

  e.stack += `\nOriginal stack:\n${stack}`;
  if (response) {
    e.response = response;
  }

  return e;
}

const URL_CALLS = {
  accounts: 'v1/accounts',
  attachmentId: 'v2/attachments/form/upload',
  attestation: 'v1/attestation',
  config: 'v1/config',
  deliveryCert: 'v1/certificate/delivery',
  devices: 'v1/devices',
  directoryAuth: 'v1/directory/auth',
  discovery: 'v1/discovery',
  getGroupAvatarUpload: 'v1/groups/avatar/form',
  getGroupCredentials: 'v1/certificate/group',
  getIceServers: 'v1/accounts/turn',
  getStickerPackUpload: 'v1/sticker/pack/form',
  groupLog: 'v1/groups/logs',
  groups: 'v1/groups',
  groupsViaLink: 'v1/groups/join',
  groupToken: 'v1/groups/token',
  keys: 'v2/keys',
  messages: 'v1/messages',
  profile: 'v1/profile',
  registerCapabilities: 'v1/devices/capabilities',
  removeSignalingKey: 'v1/accounts/signaling_key',
  signed: 'v2/keys/signed',
  storageManifest: 'v1/storage/manifest',
  storageModify: 'v1/storage/',
  storageRead: 'v1/storage/read',
  storageToken: 'v1/storage/auth',
  supportUnauthenticatedDelivery: 'v1/devices/unauthenticated_delivery',
  updateDeviceName: 'v1/accounts/name',
  whoami: 'v1/accounts/whoami',
};

const FIVE_MINUTES = 1000 * 60 * 5;

const agents = {};

const _call = (object) => Object.prototype.toString.call(object);

const ArrayBufferToString = _call(new ArrayBuffer(0));
const Uint8ArrayToString = _call(new Uint8Array());

function _getString(thing) {
  if (typeof thing !== 'string') {
    if (_call(thing) === Uint8ArrayToString) {
      return String.fromCharCode.apply(null, thing);
    }
    if (_call(thing) === ArrayBufferToString) {
      return _getString(new Uint8Array(thing));
    }
  }

  return thing;
}

function _getStringable(thing) {
  return (
    typeof thing === 'string' ||
    typeof thing === 'number' ||
    typeof thing === 'boolean' ||
    (thing === Object(thing) &&
      (_call(thing) === ArrayBufferToString ||
        _call(thing) === Uint8ArrayToString))
  );
}

function _ensureStringed(thing) {
  if (_getStringable(thing)) {
    return _getString(thing);
  }
  if (thing instanceof Array) {
    const res = [];
    for (let i = 0; i < thing.length; i += 1) {
      res[i] = _ensureStringed(thing[i]);
    }

    return res;
  }
  if (thing === Object(thing)) {
    const res = {};
    for (const key in thing) {
      res[key] = _ensureStringed(thing[key]);
    }

    return res;
  }
  if (thing === null) {
    return null;
  }
  if (thing === undefined) {
    return undefined;
  }
  throw new Error(`unsure of how to jsonify object of type ${typeof thing}`);
}

function _jsonThing(thing) {
  return JSON.stringify(_ensureStringed(thing));
}

function isSuccess(status) {
  return status >= 0 && status < 400;
}

async function _promiseAjax(
  providedUrl,
  options
) {
  return new Promise((resolve, reject) => {
    const url = providedUrl || `${options.host}/${options.path}`;

    const unauthLabel = options.unauthenticated ? ' (unauth)' : '';
    if (options.redactUrl) {
      window.log.info(
        `${options.type} ${options.redactUrl(url)}${unauthLabel}`
      );
    } else {
      window.log.info(`${options.type} ${url}${unauthLabel}`);
    }

    const timeout =
      typeof options.timeout === 'number' ? options.timeout : 10000;

    const { proxyUrl } = options;
    const agentType = options.unauthenticated ? 'unauth' : 'auth';
    const cacheKey = `${proxyUrl}-${agentType}`;

    const { timestamp } = agents[cacheKey] || { timestamp: null };
    if (!timestamp || timestamp + FIVE_MINUTES < Date.now()) {
      if (timestamp) {
        window.log.info(`Cycling agent for type ${cacheKey}`);
      }
      agents[cacheKey] = {
        agent: proxyUrl
          ? new ProxyAgent(proxyUrl)
          : new Agent({ keepAlive: true, ca: options.certificateAuthority }), // Needs to be specified in agent for node-fetch
        timestamp: Date.now(),
      };
    }
    const { agent } = agents[cacheKey];

    const fetchOptions = {
      method: options.type,
      body: options.data,
      headers: {
        'User-Agent': getUserAgent(options.version),
        'X-Signal-Agent': 'OWD',
        ...options.headers,
      },
      redirect: options.redirect,
      agent,
      ca: options.certificateAuthority,
      timeout,
    };

    if (fetchOptions.body instanceof ArrayBuffer) {
      // node-fetch doesn't support ArrayBuffer, only node Buffer
      const contentLength = fetchOptions.body.byteLength;
      fetchOptions.body = Buffer.from(fetchOptions.body);

      // node-fetch doesn't set content-length like S3 requires
      fetchOptions.headers['Content-Length'] = contentLength.toString();
    }

    const { accessKey, basicAuth, unauthenticated } = options;
    if (basicAuth) {
      fetchOptions.headers.Authorization = `Basic ${basicAuth}`;
    } else if (unauthenticated) {
      if (!accessKey) {
        throw new Error(
          '_promiseAjax: mode is unauthenticated, but accessKey was not provided'
        );
      }
      // Access key is already a Base64 string
      fetchOptions.headers['Unidentified-Access-Key'] = accessKey;
    } else if (options.user && options.password) {
      const user = _getString(options.user);
      const password = _getString(options.password);
      const auth = _btoa(`${user}:${password}`);
      fetchOptions.headers.Authorization = `Basic ${auth}`;
    }

    if (options.contentType) {
      fetchOptions.headers['Content-Type'] = options.contentType;
    }

    fetch(url, fetchOptions)
      .then(async response => {
        // Build expired!
        if (response.status === 499) {
          window.log.error('Error: build expired');
          await window.storage.put('remoteBuildExpiration', Date.now());
          window.reduxActions.expiration.hydrateExpirationStatus(true);
        }

        let resultPromise;
        if (DEBUG && !isSuccess(response.status)) {
          resultPromise = response.text();
        } else if (
          (options.responseType === 'json' ||
            options.responseType === 'jsonwithdetails') &&
          /^application\/json(;.*)?$/.test(
            response.headers.get('Content-Type') || ''
          )
        ) {
          resultPromise = response.json();
        } else if (
          options.responseType === 'arraybuffer' ||
          options.responseType === 'arraybufferwithdetails'
        ) {
          resultPromise = response.buffer();
        } else {
          resultPromise = response.textConverted();
        }

        return resultPromise.then(result => {
          if (isSuccess(response.status)) {
            if (
              options.responseType === 'arraybuffer' ||
              options.responseType === 'arraybufferwithdetails'
            ) {
              result = result.buffer.slice(
                result.byteOffset,
                result.byteOffset + result.byteLength
              );
            }
            if (
              options.responseType === 'json' ||
              options.responseType === 'jsonwithdetails'
            ) {
              if (options.validateResponse) {
                if (!_validateResponse(result, options.validateResponse)) {
                  if (options.redactUrl) {
                    window.log.info(
                      options.type,
                      options.redactUrl(url),
                      response.status,
                      'Error'
                    );
                  } else {
                    window.log.error(
                      options.type,
                      url,
                      response.status,
                      'Error'
                    );
                  }
                  reject(
                    makeHTTPError(
                      'promiseAjax: invalid response',
                      response.status,
                      result,
                      options.stack
                    )
                  );

                  return;
                }
              }
            }

            if (options.redactUrl) {
              window.log.info(
                options.type,
                options.redactUrl(url),
                response.status,
                'Success'
              );
            } else {
              window.log.info(options.type, url, response.status, 'Success');
            }
            if (options.responseType === 'arraybufferwithdetails') {
              const fullResult = {
                data: result,
                contentType: getContentType(response),
                response,
              };

              resolve(fullResult);

              return;
            }
            if (options.responseType === 'jsonwithdetails') {
              const fullResult = {
                data: result,
                contentType: getContentType(response),
                response,
              };

              resolve(fullResult);

              return;
            }

            resolve(result);

            return;
          }

          if (options.redactUrl) {
            window.log.info(
              options.type,
              options.redactUrl(url),
              response.status,
              'Error'
            );
          } else {
            window.log.error(options.type, url, response.status, 'Error');
          }

          reject(
            makeHTTPError(
              'promiseAjax: error response',
              response.status,
              result,
              options.stack
            )
          );
        });
      })
      .catch(e => {
        if (options.redactUrl) {
          window.log.error(options.type, options.redactUrl(url), 0, 'Error');
        } else {
          window.log.error(options.type, url, 0, 'Error');
        }
        const stack = `${e.stack}\nInitial stack:\n${options.stack}`;
        reject(makeHTTPError('promiseAjax catch', 0, e.toString(), stack));
      });
  });
}

async function _retryAjax(
  url,
  options,
  providedLimit,
  providedCount
) {
  const count = (providedCount || 0) + 1;
  const limit = providedLimit || 3;

  return _promiseAjax(url, options).catch(async (e) => {
    if (e.name === 'HTTPError' && e.code === -1 && count < limit) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(_retryAjax(url, options, limit, count));
        }, 1000);
      });
    }
    throw e;
  });
}

async function _outerAjax(url, options) {
  options.stack = new Error().stack; // just in case, save stack here.

  return _retryAjax(url, options);
}


const version = semver.valid(semver.coerce(process.env.npm_package_version));

const WebAPI = initialize({
    url: CONFIG.serverUrl,
    storageUrl: CONFIG.storageUrl,
    directoryUrl: CONFIG.directoryUrl,
    directoryEnclaveId: CONFIG.directoryEnclaveId,
    directoryTrustAnchor: CONFIG.directoryTrustAnchor,
    cdnUrlObject: {
      0: CONFIG.cdn[0],
      2: CONFIG.cdn[2],
    },
    certificateAuthority: CONFIG.certificateAuthority,
    contentProxyUrl: CONFIG.contentProxyUrl,
    proxyUrl: CONFIG.proxyUrl,
    version,
});

const {connect} = WebAPI;

WebAPI.connect = (username, password) => {
    const connection = connect(username, password);

    async function _ajax(param) {
      if (!param.urlParameters) {
        param.urlParameters = '';
      }
    
      return _outerAjax(null, {
        basicAuth: param.basicAuth,
        certificateAuthority: CONFIG.certificateAuthority,
        contentType: param.contentType || 'application/json; charset=utf-8',
        data: param.data || (param.jsonData && _jsonThing(param.jsonData)),
        host: param.host || CONFIG.serverUrl,
        password: param.password || password,
        path: URL_CALLS[param.call] + param.urlParameters,
        proxyUrl: CONFIG.proxyUrl,
        responseType: param.responseType,
        timeout: param.timeout,
        type: param.httpType,
        user: param.username || username,
        redactUrl: param.redactUrl,
        validateResponse: param.validateResponse,
        version,
        unauthenticated: param.unauthenticated,
        accessKey: param.accessKey,
      }).catch((e) => {
        const { code } = e;
        if (code === 200) {
          // Happens sometimes when we get no response. Might be nice to get 204 instead.
          return null;
        }
        let message;
        switch (code) {
          case -1:
            message =
              'Failed to connect to the server, please check your network connection.';
            break;
          case 413:
            message = 'Rate limit exceeded, please try again later.';
            break;
          case 403:
            message = 'Invalid code, please try again.';
            break;
          case 417:
            message = 'Number already registered.';
            break;
          case 401:
            message =
              'Invalid authentication, most likely someone re-registered and invalidated our registration.';
            break;
          case 404:
            message = 'Number is not registered.';
            break;
          default:
            message =
              'The server rejected our query, please file a bug report.';
        }
        e.message = `${message} (original: ${e.message})`;
        throw e;
      });
    }

    connection._ajax = _ajax;

    connection.requestVerificationSMS = (
      number,
      captchaToken
    ) => {
      let urlParameters = `/sms/code/${number}?client=desktop`;
      if (captchaToken) {
        urlParameters += `&captcha=${captchaToken}`;
      }
      return _ajax({
        call: 'accounts',
        httpType: 'GET',
        urlParameters,
      });
    }
    
    connection.requestVerificationVoice = (
      number,
      captchaToken
    ) => {
      let urlParameters = `/voice/code/${number}?client=desktop`;
      if (captchaToken) {
        urlParameters += `&captcha=${captchaToken}`;
      }
      return _ajax({
        call: 'accounts',
        httpType: 'GET',
        urlParameters,
      });
    }

    return connection;
}

export { WebAPI };
