"use strict";
const assert = require("chai").assert;
const Blob = require("node-blob");
const MockServer = require("mock-socket").Server;
const WebSocket = require("websocket").w3cwebsocket;
const protobuf = require("../src/protobufs.js");
const WebSocketMessage = protobuf.lookupType("signalservice.WebSocketMessage");
const assertEqualArrayBuffers = require("./_test.js").assertEqualArrayBuffers;
const WebSocketResource = require("../src/WebSocketResource.js");

describe("WebSocket-Resource", () => {
  describe("requests and responses", () => {
    it("receives requests and sends responses", done => {
      // mock socket
      const requestId = "1";
      const socket = {
        send(data) {
          const message = WebSocketMessage.decode(data);
          assert.strictEqual(message.type, WebSocketMessage.Type.RESPONSE);
          assert.strictEqual(message.response.message, "OK");
          assert.strictEqual(message.response.status, 200);
          assert.strictEqual(message.response.id.toString(), requestId);
          done();
        },
        addEventListener() {}
      };

      // actual test
      this.resource = new WebSocketResource(socket, {
        handleRequest(request) {
          assert.strictEqual(request.verb, "PUT");
          assert.strictEqual(request.path, "/some/path");
          assertEqualArrayBuffers(request.body, new Uint8Array([1, 2, 3]));
          request.respond(200, "OK");
        }
      });

      // mock socket request
      const message = WebSocketMessage.create({
        type: WebSocketMessage.Type.REQUEST,
        request: {
          id: requestId,
          verb: "PUT",
          path: "/some/path",
          body: new Uint8Array([1, 2, 3])
        }
      });
      socket.onmessage({
        data: new Uint8Array(WebSocketMessage.encode(message).finish()).buffer
      });
    });

    it("sends requests and receives responses", done => {
      // mock socket and request handler
      let requestId;
      const socket = {
        send(data) {
          const message = WebSocketMessage.decode(data);
          assert.strictEqual(message.type, WebSocketMessage.Type.REQUEST);
          assert.strictEqual(message.request.verb, "PUT");
          assert.strictEqual(message.request.path, "/some/path");
          assertEqualArrayBuffers(
            message.request.body,
            new Uint8Array([1, 2, 3])
          );
          requestId = message.request.id;
        },
        addEventListener() {}
      };

      // actual test
      const resource = new WebSocketResource(socket);
      resource.sendRequest({
        verb: "PUT",
        path: "/some/path",
        body: new Uint8Array([1, 2, 3]),
        error: done,
        success(message, status) {
          assert.strictEqual(message, "OK");
          assert.strictEqual(status, 200);
          done();
        }
      });

      // mock socket response
      const message = WebSocketMessage.create({
        type: WebSocketMessage.Type.RESPONSE,
        response: { id: requestId, message: "OK", status: 200 }
      });
      socket.onmessage({
        data: new Uint8Array(WebSocketMessage.encode(message).finish()).buffer
      });
    });
  });

  describe("close", () => {
    it.skip("closes the connection", done => {
      const mockServer = new MockServer("ws://localhost:8081");
      mockServer.on("connection", server => {
        server.on("close", done);
      });
      const resource = new WebSocketResource(
        new WebSocket("ws://localhost:8081")
      );
      resource.close();
    });
  });

  describe.skip("with a keepalive config", function thisNeeded() {
    this.timeout(60000);
    it("sends keepalives once a minute", done => {
      const mockServer = new MockServer("ws://localhost:8081");
      mockServer.on("connection", server => {
        server.on("message", data => {
          const message = WebSocketMessage.decode(data);
          assert.strictEqual(message.type, WebSocketMessage.Type.REQUEST);
          assert.strictEqual(message.request.verb, "GET");
          assert.strictEqual(message.request.path, "/v1/keepalive");
          server.close();
          done();
        });
      });
      this.resource = new WebSocketResource(
        new WebSocket("ws://localhost:8081"),
        {
          keepalive: { path: "/v1/keepalive" }
        }
      );
    });

    it("uses / as a default path", done => {
      const mockServer = new MockServer("ws://localhost:8081");
      mockServer.on("connection", server => {
        server.on("message", data => {
          const message = WebSocketMessage.decode(data);
          assert.strictEqual(message.type, WebSocketMessage.Type.REQUEST);
          assert.strictEqual(message.request.verb, "GET");
          assert.strictEqual(message.request.path, "/");
          server.close();
          done();
        });
      });
      this.resource = new WebSocketResource(
        new WebSocket("ws://localhost:8081"),
        {
          keepalive: true
        }
      );
    });

    it("optionally disconnects if no response", function thisNeeded1(done) {
      this.timeout(65000);
      const mockServer = new MockServer("ws://localhost:8081");
      const socket = new WebSocket("ws://localhost:8081");
      mockServer.on("connection", server => {
        server.on("close", done);
      });
      this.resource = new WebSocketResource(socket, { keepalive: true });
    });

    it("allows resetting the keepalive timer", function thisNeeded2(done) {
      this.timeout(65000);
      const mockServer = new MockServer("ws://localhost:8081");
      const socket = new WebSocket("ws://localhost:8081");
      const startTime = Date.now();
      mockServer.on("connection", server => {
        server.on("message", data => {
          const message = WebSocketMessage.decode(data);
          assert.strictEqual(message.type, WebSocketMessage.Type.REQUEST);
          assert.strictEqual(message.request.verb, "GET");
          assert.strictEqual(message.request.path, "/");
          assert(
            Date.now() > startTime + 60000,
            "keepalive time should be longer than a minute"
          );
          server.close();
          done();
        });
      });
      const resource = new WebSocketResource(socket, { keepalive: true });
      setTimeout(() => {
        resource.resetKeepAliveTimer();
      }, 5000);
    });
  });
});
