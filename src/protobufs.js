"use strict";

const protobuf = require("protobufjs");
const path = require("path");

const protoPath = path.join(__dirname, "..", "protos", "SubProtocol.proto");

exports = module.exports = protobuf.loadSync([
  path.join(__dirname, "..", "protos", "SubProtocol.proto"),
  path.join(__dirname, "..", "protos", "DeviceMessages.proto"),
  path.join(__dirname, "..", "protos", "SignalService.proto")
]).root;
