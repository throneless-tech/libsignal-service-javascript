# libsignal-service-javascript
**This is a third-party effort, and is NOT a part of the official [Signal](https://signal.org) project or any other project of [Open Whisper Systems](https://whispersystems.org).**

**WARNING: This library is currently undergoing a security audit. It should not be regarded as secure, use at your own risk. I am not a cryptographer, I just encrypt a lot.**

A javascript library for basic interaction with the [Signal](https://signal.org) messaging service. This library is a standalone port to [Node.js](https://nodejs.org) of the backend components of [Signal-Desktop](https://github.com/WhisperSystems/Signal-Desktop). Not to be confused with [libsignal-protocol-javascript](https://github.com/signalapp/libsignal-protocol-javascript), which only includes the Signal wire protocol, this library contains the logic for actually interacting with the Signal messaging servers as currently operated by OWS. As such, it is intended to be a Javascript equivalent of [libsignal-service-java](https://github.com/signalapp/libsignal-service-java) and provide a similar API.

## Usage

To use this in your Node.js project, run the following from your project directory:

`npm install --save @throneless/libsignal-service`

Full documentation is forthcoming, but for now you can see an example of how to utilize the library to register a number and send a message by looking at `ping.js` in the `examples` directory. Usage of the library requires implementation of a `ProtocolStore` to save keys and other state. An example that uses [node-localstorage](https://github.com/lmaccherone/node-localstorage) can be found in the `examples` directory, and an example that just stores the keys in-memory can be found in the `tests` directory. The API for implementing the store is currently just a rough port, and will be significantly simplified in the future.

## Todo

* [ ] Inline documentation and other structural changes from upstream.
* [ ] Simplify `ProtocolStore` API.
* [ ] Webpack integration for browser support.
* [ ] Additional unit test coverage.
* [ ] Update wire-protocol dependency.

## License
[<img src="https://www.gnu.org/graphics/gplv3-127x51.png" alt="GPLv3" >](http://www.gnu.org/licenses/gpl-3.0.html)

Libsignal-service-javascript is a free software project licensed under the GNU General Public License v3.0 (GPLv3) by [Throneless Tech](https://throneless.tech).

It is derived in part from [Signal-Desktop](https://github.com/WhisperSystems/Signal-Desktop) which is Copyright (c) 2014-2018 Open Whisper Systems, also under the GPLv3.
