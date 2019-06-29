"use strict";

var assert = require("chai").assert;
var helpers = require("../src/helpers.js");
var assertEqualArrayBuffers = require("./_test.js").assertEqualArrayBuffers;

describe("Helpers", function() {
  describe("ArrayBuffer->String conversion", function() {
    it("works", function() {
      var b = new ArrayBuffer(3);
      var a = new Uint8Array(b);
      a[0] = 0;
      a[1] = 255;
      a[2] = 128;
      assert.equal(helpers.getString(b), "\x00\xff\x80");
    });
  });

  describe("stringToArrayBuffer", function() {
    it("returns ArrayBuffer when passed string", function() {
      var anArrayBuffer = new ArrayBuffer(1);
      var typedArray = new Uint8Array(anArrayBuffer);
      typedArray[0] = "a".charCodeAt(0);
      assertEqualArrayBuffers(helpers.stringToArrayBuffer("a"), anArrayBuffer);
    });
    it("throws an error when passed a non string", function() {
      var notStringable = [{}, undefined, null, new ArrayBuffer()];
      notStringable.forEach(function(notString) {
        assert.throw(function() {
          helpers.stringToArrayBuffer(notString);
        }, Error);
      });
    });
  });
});
