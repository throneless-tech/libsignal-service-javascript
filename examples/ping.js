/*
 * This example script allows you to register a phone number with Signal via
 * SMS and then send and receive a message. It uses the node-localstorage
 * module to save state information to a directory path supplied by the
 * environent variable 'STORE'.
 *
 * For example, with two numbers (by default this utilizes the Signal staging
 * server so it is safe to use without it clobbering your keys). The password
 * is an arbitrary string, it just must remain consistent between requests:
 *
 * # Request a verification code for the first number:
 * STORE=./first node ./example/test.js +15555555555 password request
 *
 * # You then receive an SMS to +15555555555 with the code. Verify it:
 * STORE=./first node ./example/test.js +15555555555 password register <CODE>
 *
 * # Repeat the process with a second number:
 * STORE=./second node ./example/test.js +15555556666 password request
 * STORE=./second node ./example/test.js +15555556666 password register <CODE>
 *
 * # Now in one terminal listen for messages with one number:
 * STORE=./first node ./example/test.js +15555555555 password receive
 *
 * # And in another terminal send the that number a message:
 * STORE=./second node ./example/test.js +15555556666 password send +15555555555
 *
 * # In the first terminal you should see message output, including "PING"
 */

const api = require("../src/index.js");
const ProtocolStore = require("./LocalSignalProtocolStore.js");
const protocolStore = new ProtocolStore(process.env.STORE);
const ByteBuffer = require("bytebuffer");

const args = process.argv.slice(2);
const USERNAME = args[0];
const PASSWORD = args[1];

function printError(error) {
  console.log(error);
}

//const profileKey = api.KeyHelper.getRandomBytes(32);
function testIds(number) {
  return protocolStore.getDeviceIds(number).then(
    function(deviceIds) {
      if (deviceIds.length == 0) {
        console.log("No device IDs found.");
      }
      for (const id in deviceIds) {
        console.log(id);
      }
    }.bind(this)
  );
}

const accountManager = new api.AccountManager(
  USERNAME,
  PASSWORD,
  protocolStore
);

switch (args[2]) {
  case "request":
    accountManager.requestSMSVerification(USERNAME).catch(printError);
    break;
  case "register":
    accountManager
      .registerSingleDevice(USERNAME, args[3])
      .then(function(result) {
        console.log(result);
      })
      .catch(printError);
    break;
  case "send":
    const messageSender = new api.MessageSender(
      USERNAME,
      PASSWORD,
      protocolStore
    );
    const now = Date.now();
    messageSender
      .sendMessageToNumber(
        args[3],
        "PING",
        null,
        now,
        undefined,
        protocolStore.get("profileKey")
      )
      .then(function(result) {
        console.log(result);
      })
      .catch(printError);
    break;
  case "receive":
    const signalingKey = ByteBuffer.wrap(
      protocolStore.get("signaling_key"),
      "binary"
    ).toArrayBuffer();
    const messageReceiver = new api.MessageReceiver(
      USERNAME.concat(".1"),
      PASSWORD,
      signalingKey,
      protocolStore
    );
    messageReceiver.addEventListener("textsecure:message", function(ev) {
      console.log(ev.proto.message.body);
    });
    break;
}
