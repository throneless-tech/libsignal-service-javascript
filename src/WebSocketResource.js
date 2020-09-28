/*
 * vim: ts=2:sw=2:expandtab
 */



const debug = require('debug')('libsignal-service:WebSocketResource');
const FileReader = require('filereader');
const Long = require('long');
const EventTarget = require('./EventTarget.js');
const Event = require('./Event.js');
const crypto = require('./crypto.js');
const protobuf = require('./protobufs.js');

const WebSocketMessage = protobuf.lookupType('signalservice.WebSocketMessage');
// eslint-disable-next-line func-names
/*
 * WebSocket-Resources
 *
 * Create a request-response interface over websockets using the
 * WebSocket-Resources sub-protocol[1].
 *
 * var client = new WebSocketResource(socket, function(request) {
 *    request.respond(200, 'OK');
 * });
 *
 * client.sendRequest({
 *    verb: 'PUT',
 *    path: '/v1/messages',
 *    body: '{ some: "json" }',
 *    success: function(message, status, request) {...},
 *    error: function(message, status, request) {...}
 * });
 *
 * 1. https://github.com/signalapp/WebSocket-Resources
 *
 */
class Request {
  constructor(options) {
    this.verb = options.verb || options.type;
    this.path = options.path || options.url;
    this.headers = options.headers;
    this.body = new Uint8Array(options.body || options.data);
    this.success = options.success;
    this.error = options.error;
    this.id = options.id;
    if (this.id === undefined) {
      const bits = new Uint32Array(2);
      crypto.getRandomValues(bits);
      this.id = Long.fromBits(bits[0], bits[1], true);
    }
    if (this.body === undefined) {
      this.body = null;
    }
  }
}

class IncomingWebSocketRequest {
  constructor(options) {
    const request = new Request(options);
    const { socket } = options;
    this.verb = request.verb;
    this.path = request.path;
    this.body = request.body;
    this.headers = request.headers;

    this.respond = (status, message) => {
      const wsmessage = WebSocketMessage.create({
        type: WebSocketMessage.Type.RESPONSE,
        response: { id: request.id, message, status },
      });
      socket.send(WebSocketMessage.encode(wsmessage).finish());
    };
  }
}

const outgoing = {};
class OutgoingWebSocketRequest {
  constructor(options, socket) {
    const request = new Request(options);
    outgoing[request.id] = request;
    const message = WebSocketMessage.create({
      type: WebSocketMessage.Type.REQUEST,
      request: {
        verb: request.verb,
        path: request.path,
        body: request.body,
        headers: request.headers,
        id: request.id,
      },
    });
    socket.send(WebSocketMessage.encode(message).finish());
  }
}

class KeepAlive {
  constructor(websocketResource, opts = {}) {
    if (websocketResource instanceof WebSocketResource) {
      this.path = opts.path;
      if (this.path === undefined) {
        this.path = '/';
      }
      this.disconnect = opts.disconnect;
      if (this.disconnect === undefined) {
        this.disconnect = true;
      }
      this.wsr = websocketResource;
    } else {
      throw new TypeError('KeepAlive expected a WebSocketResource');
    }
  }

  stop() {
    clearTimeout(this.keepAliveTimer);
    clearTimeout(this.disconnectTimer);
  }

  reset() {
    clearTimeout(this.keepAliveTimer);
    clearTimeout(this.disconnectTimer);
    this.keepAliveTimer = setTimeout(() => {
      if (this.disconnect) {
        // automatically disconnect if server doesn't ack
        this.disconnectTimer = setTimeout(() => {
          clearTimeout(this.keepAliveTimer);
          this.wsr.close(3001, 'No response to keepalive request');
        }, 10000);
      } else {
        this.reset();
      }
      debug('Sending a keepalive message');
      this.wsr.sendRequest({
        verb: 'GET',
        path: this.path,
        success: this.reset.bind(this),
      });
    }, 55000);
  }
}

class WebSocketResource extends EventTarget {
  constructor(socket, opts = {}) {
    super();
    let { handleRequest } = opts;
    if (typeof handleRequest !== 'function') {
      handleRequest = request => request.respond(404, 'Not found');
    }
    this.sendRequest = options => new OutgoingWebSocketRequest(options, socket);

    // eslint-disable-next-line no-param-reassign
    socket.onmessage = socketMessage => {
      const blob = socketMessage.data;
      const handleArrayBuffer = buffer => {
        const message = WebSocketMessage.decode(new Uint8Array(buffer));
        if (message.type === WebSocketMessage.Type.REQUEST) {
          handleRequest(
            new IncomingWebSocketRequest({
              verb: message.request.verb,
              path: message.request.path,
              body: message.request.body,
              headers: message.request.headers,
              id: message.request.id,
              socket,
            })
          );
        } else if (message.type === WebSocketMessage.Type.RESPONSE) {
          const { response } = message;
          const request = outgoing[response.id];
          if (request) {
            request.response = response;
            let callback = request.error;
            if (response.status >= 200 && response.status < 300) {
              callback = request.success;
            }

            if (typeof callback === 'function') {
              callback(response.message, response.status, request);
            }
          } else {
            throw new Error(
              `Received response for unknown request ${message.response.id}`
            );
          }
        }
      };

      if (blob instanceof ArrayBuffer) {
        handleArrayBuffer(blob);
      } else {
        const reader = new FileReader();
        reader.onload = () => handleArrayBuffer(reader.result);
        reader.readAsArrayBuffer(blob);
      }
    };

    if (opts.keepalive) {
      this.keepalive = new KeepAlive(this, {
        path: opts.keepalive.path,
        disconnect: opts.keepalive.disconnect,
      });
      const resetKeepAliveTimer = this.keepalive.reset.bind(this.keepalive);
      socket.addEventListener('open', resetKeepAliveTimer);
      socket.addEventListener('message', resetKeepAliveTimer);
      socket.addEventListener(
        'close',
        this.keepalive.stop.bind(this.keepalive)
      );
    }

    socket.addEventListener('close', () => {
      this.closed = true;
    });

    this.close = (code = 3000, reason) => {
      if (this.closed) {
        return;
      }

      debug('WebSocketResource.close()');
      if (this.keepalive) {
        this.keepalive.stop();
      }

      socket.close(code, reason);
      // eslint-disable-next-line no-param-reassign
      socket.onmessage = null;

      // On linux the socket can wait a long time to emit its close event if we've
      //   lost the internet connection. On the order of minutes. This speeds that
      //   process up.
      setTimeout(() => {
        if (this.closed) {
          return;
        }
        this.closed = true;

        debug('Dispatching our own socket close event');
        const ev = new Event('close');
        ev.code = code;
        ev.reason = reason;
        this.dispatchEvent(ev);
      }, 5000);
    };
  }
}

exports = module.exports = WebSocketResource;
