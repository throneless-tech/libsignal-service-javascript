/*
 * vim: ts=2:sw=2:expandtab
 */
"use strict";

// eslint-disable-next-line func-names
function appendStack(newError, originalError) {
  // eslint-disable-next-line no-param-reassign
  newError.stack += `\nOriginal stack:\n${originalError.stack}`;
}

class ReplayableError extends Error {
  constructor(options = {}) {
    this.name = options.name || "ReplayableError";
    this.message = options.message;

    super(options.message);

    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }

    this.functionCode = options.functionCode;
  }
}

class IncomingIdentityKeyError extends ReplayableError {
  constructor(number, message, key) {
    // eslint-disable-next-line prefer-destructuring
    this.number = number.split(".")[0];
    this.identityKey = key;
    super({
      name: "IncomingIdentityKeyError",
      message: `The identity of ${this.number} has changed.`
    });
  }
}

class OutgoingIdentityKeyError extends ReplayableError {
  constructor(number, message, timestamp, identityKey) {
    // eslint-disable-next-line prefer-destructuring
    this.number = number.split(".")[0];
    this.identityKey = identityKey;
    super({
      name: "OutgoingIdentityKeyError",
      message: `The identity of ${this.number} has changed.`
    });
  }
}

class OutgoingMessageError extends ReplayableError {
  constructor(number, message, timestamp, httpError) {
    // eslint-disable-next-line prefer-destructuring
    this.number = number.split(".")[0];
    super({
      name: "OutgoingMessageError",
      message: httpError ? httpError.message : "no http error"
    });
    if (httpError) {
      this.code = httpError.code;
      appendStack(this, httpError);
    }
  }
}

class SendMessageNetworkError extends ReplayableError {
  constructor(number, jsonData, httpError) {
    this.number = number;
    this.code = httpError.code;
    super({
      name: "SendMessageNetworkError",
      message: httpError.message
    });
    appendStack(this, httpError);
  }
}

class SignedPreKeyRotationError extends ReplayableError {
  constructor() {
    super({
      name: "SignedPreKeyRotationError",
      message: "Too many signed prekey rotation failures"
    });
  }
}

class MessageError extends ReplayableError {
  constructor(message, httpError) {
    this.code = httpError.code;
    super({
      name: "MessageError",
      message: httpError.message
    });
    appendStack(this, httpError);
  }
}

class UnregisteredUserError extends Error {
  constructor(number, httpError) {
    this.message = httpError.message;
    this.name = "UnregisteredUserError";
    super(this.message);
    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
    this.number = number;
    this.code = httpError.code;
    appendStack(this, httpError);
  }
}

module.exports.UnregisteredUserError = UnregisteredUserError;
module.exports.SendMessageNetworkError = SendMessageNetworkError;
module.exports.IncomingIdentityKeyError = IncomingIdentityKeyError;
module.exports.OutgoingIdentityKeyError = OutgoingIdentityKeyError;
module.exports.ReplayableError = ReplayableError;
module.exports.OutgoingMessageError = OutgoingMessageError;
module.exports.MessageError = MessageError;
module.exports.SignedPreKeyRotationError = SignedPreKeyRotationError;
