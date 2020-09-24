"use strict";
const assert = require("chai").assert;
const Blob = require("node-blob");
const ByteBuffer = require("bytebuffer");
const MockServer = require("mock-socket").Server;
const crypto = require("../src/crypto.js");
const storage = require("./InMemorySignalProtocolStore.js");
const ProtocolStore = require("../src/index.js").ProtocolStore;
const MessageReceiver = require("../src/index.js").MessageReceiver;
const WebCrypto = require("node-webcrypto-ossl");
const webcrypto = new WebCrypto();
const protobuf = require("../src/protobufs.js");
const DataMessage = protobuf.lookupType("signalservice.DataMessage");
const Envelope = protobuf.lookupType("signalservice.Envelope");
const WebSocketMessage = protobuf.lookupType("signalservice.WebSocketMessage");

describe("MessageReceiver", () => {
  const protocolStore = new ProtocolStore(new storage());
  protocolStore.load();
  const number = "+19999999999";
  const uuid = "AAAAAAAA-BBBB-4CCC-9DDD-EEEEEEEEEEEE";
  const deviceId = 1;
  const signalingKey = crypto.getRandomBytes(32 + 20);
  before(() => {
    protocolStore.setNumberAndDeviceId(number, deviceId, "name");
    protocolStore.setUuidAndDeviceId(number, deviceId);
    protocolStore.setPassword("password");
    protocolStore.setSignalingKey(signalingKey);
  });

  describe("connecting", () => {
    const attrs = {
      type: Envelope.Type.CIPHERTEXT,
      source: number,
      sourceUuid: uuid,
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

      const aesKey = signalingKey.slice(0, 32);
      const macKey = signalingKey.slice(32, 32 + 20);

      webcrypto.subtle
        .importKey("raw", aesKey, { name: "AES-CBC" }, false, ["encrypt"])
        .then(key => {
          const iv = crypto.getRandomBytes(16);
          webcrypto.subtle
            .encrypt({ name: "AES-CBC", iv: new Uint8Array(iv) }, key, signal)
            .then(ciphertext => {
              webcrypto.subtle
                .importKey(
                  "raw",
                  macKey,
                  { name: "HMAC", hash: { name: "SHA-256" } },
                  false,
                  ["sign"]
                )
                .then(innerKey => {
                  webcrypto.subtle
                    .sign({ name: "HMAC", hash: "SHA-256" }, innerKey, signal)
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
          uuid
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
        const keys = Object.keys(attrs);

        for (let i = 0, max = keys.length; i < max; i += 1) {
          const key = keys[i];
          assert.strictEqual(attrs[key], signal[key]);
        }
        assert.strictEqual(signal.message.body, "hello");
        mockServer.close();
        done();
      });
    });
  });
});
