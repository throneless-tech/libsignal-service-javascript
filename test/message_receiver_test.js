"use strict";
const assert = require("chai").assert;
const ByteBuffer = require("bytebuffer");
const MockServer = require("mock-socket").Server;
const crypto = require("../src/crypto.js");
const SignalProtocolStore = require("./InMemorySignalProtocolStore.js");
const MessageReceiver = require("../src/index.js").MessageReceiver;
const WebCrypto = require("node-webcrypto-ossl");
const webcrypto = new WebCrypto();
const protobuf = require("../src/protobufs.js");
const DataMessage = protobuf.lookupType("signalservice.DataMessage");
const Envelope = protobuf.lookupType("signalservice.Envelope");
const WebSocketMessage = protobuf.lookupType("signalservice.WebSocketMessage");

describe("MessageReceiver", () => {
  const protocolStore = new SignalProtocolStore();
  const number = "+19999999999";
  const deviceId = 1;
  const signalingKey = crypto.getRandomBytes(32 + 20);
  before(() => {
    protocolStore.userSetNumberAndDeviceId(number, deviceId, "name");
    protocolStore.put("password", "password");
    protocolStore.put("signaling_key", signalingKey);
  });

  describe("connecting", () => {
    const blob = null;
    const attrs = {
      type: Envelope.Type.CIPHERTEXT,
      source: number,
      sourceDevice: deviceId,
      timestamp: Date.now()
    };
    const websocketmessage = WebSocketMessage.create({
      type: WebSocketMessage.Type.REQUEST,
      request: { verb: "PUT", path: "/messages" }
    });

    before(done => {
      let signal = Envelope.create(attrs);
      signal = Envelope.encode(signal).finish();
      const data = DataMessage.create({ body: "hello" });

      const signaling_key = signalingKey;
      const aes_key = signaling_key.slice(0, 32);
      const mac_key = signaling_key.slice(32, 32 + 20);

      webcrypto.subtle
        .importKey("raw", aes_key, { name: "AES-CBC" }, false, ["encrypt"])
        .then(key => {
          const iv = crypto.getRandomBytes(16);
          webcrypto.subtle
            .encrypt({ name: "AES-CBC", iv: new Uint8Array(iv) }, key, signal)
            .then(ciphertext => {
              webcrypto.subtle
                .importKey(
                  "raw",
                  mac_key,
                  { name: "HMAC", hash: { name: "SHA-256" } },
                  false,
                  ["sign"]
                )
                .then(key => {
                  webcrypto.subtle
                    .sign({ name: "HMAC", hash: "SHA-256" }, key, signal)
                    .then(mac => {
                      const version = new Uint8Array([1]);
                      const message = ByteBuffer.concat([
                        version,
                        iv,
                        ciphertext,
                        mac
                      ]);
                      websocketmessage.request.body = message.toArrayBuffer();
                      done();
                    });
                });
            });
        });
    });

    it.skip("connects", done => {
      const mockServer = new MockServer(
        `ws://localhost:8080/v1/websocket/?login=${encodeURIComponent(
          number
        )}.1&password=password`
      );

      mockServer.on("connection", server => {
        server.send(new Blob([websocketmessage.toArrayBuffer()]));
      });

      const messageReceiver = new MessageReceiver(
        number.concat("." + deviceId.toString()),
        "password",
        signalingKey,
        protocolStore
      );
      messageReceiver.addEventListener("textsecure:message", ev => {
        const signal = ev.proto;
        for (const key in attrs) {
          assert.strictEqual(attrs[key], signal[key]);
        }
        assert.strictEqual(signal.message.body, "hello");
        server.close();
        done();
      });
    });
  });
});
