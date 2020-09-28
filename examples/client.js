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
 * # Request a verification code via SMS for the first number:
 * STORE=./first node ./example/client.js requestSMS +15555555555 <password>
 *
 * # Or via voice:
 * STORE=./first node ./example/client.js requestVoice +15555555555 <password>
 *
 * # You then receive an SMS to +15555555555 with the code. Verify it:
 * STORE=./first node ./example/client.js register +15555555555 <password> <CODE>
 *
 * # Repeat the process with a second number:
 * STORE=./second node ./example/client.js request +15555556666 <password>
 * STORE=./second node ./example/client.js register +15555556666 <password> <CODE>
 *
 * # Now in one terminal listen for messages with one number:
 * STORE=./first node ./example/client.js receive
 *
 * # And in another terminal send the that number a message:
 * STORE=./second node ./example/client.js send +15555555555 "PING"
 *
 * # In the first terminal you should see message output, including "PING"
 *
 * # To send a file, include the path after your message text:
 * STORE=./second node ./example/client.js send +15555555555 "PING" /tmp/foo.jpg
 *
 * # To update the expiration timer of a conversation:
 * STORE=./second node ./example/client.js expire +15555555555 <seconds>
 *
 */

const Signal = require('../src/index.js');
const Storage = require('./LocalSignalProtocolStore.js');

const protocolStore = new Signal.ProtocolStore(new Storage(process.env.STORE));
protocolStore.load();
const ByteBuffer = require('bytebuffer');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

function printError(error) {
  console.log(error);
}

let accountManager;
  let messageSender;
  let username;
  let password;
  let number;
  let numbers;
  let groupId;
  let text;
  let expire;

switch (args[0]) {
  case 'request':
  case 'requestSMS':
    username = args[1];
    password = args[2];
    accountManager = new Signal.AccountManager(
      username,
      password,
      protocolStore
    );

    accountManager
      .requestSMSVerification()
      .then(result => {
        console.log('Sent verification code.');
        
      })
      .catch(printError);
    break;
  case 'requestVoice':
    username = args[1];
    password = args[2];
    accountManager = new Signal.AccountManager(
      username,
      password,
      protocolStore
    );

    accountManager
      .requestVoiceVerification()
      .then(result => {
        console.log('Calling for verification.');
        
      })
      .catch(printError);
    break;
  case 'register':
    username = args[1];
    password = args[2];
    const code = args[3];
    accountManager = new Signal.AccountManager(
      username,
      password,
      protocolStore
    );

    accountManager
      .registerSingleDevice(code)
      .then(result => {
        console.log(result);
      })
      .catch(printError);
    break;
  case 'send':
    number = args[1];
    text = args[2];
    attachments = [];
    messageSender = new Signal.MessageSender(protocolStore);
    messageSender.connect().then(() => {
      if (args[3]) {
        Signal.AttachmentHelper.loadFile(args[3])
          .then(file => {
            attachments.push(file);
          })
          .then(() => {
            messageSender
              .sendMessageToNumber({
                number,
                body: text,
                attachments,
              })
              .then(result => {
                console.log(result);
              })
              .catch(printError);
          });
      } else {
        messageSender
          .sendMessageToNumber({
            number,
            body: text,
            attachments,
          })
          .then(result => {
            console.log(result);
          })
          .catch(printError);
      }
    });
    break;
  case 'sendToGroup':
    groupId = args[1];
    numbers = args[2].split(',');
    text = args[3];
    attachments = [];
    messageSender = new Signal.MessageSender(protocolStore);
    messageSender.connect().then(() => {
      if (args[4]) {
        Signal.AttachmentHelper.loadFile(args[4])
          .then(file => {
            attachments.push(file);
          })
          .then(() => {
            messageSender
              .sendMessageToGroup({
                groupId,
                recipients: numbers,
                body: text,
                attachments,
              })
              .then(result => {
                console.log(result);
              })
              .catch(printError);
          });
      } else {
        messageSender
          .sendMessageToGroup({
            groupId,
            recipients: numbers,
            body: text,
          })
          .then(result => {
            console.log(result);
          })
          .catch(printError);
      }
    });
    break;
  case 'expire':
    number = args[1];
    expire = args[2];
    messageSender = new Signal.MessageSender(protocolStore);
    messageSender.connect().then(() => {
      messageSender
        .sendExpirationTimerUpdateToNumber(number, parseInt(expire))
        .then(result => {
          console.log(result);
        })
        .catch(printError);
    });
    break;
  case 'createGroup':
    name = args[1];
    numbers = args[2];
    messageSender = new Signal.MessageSender(protocolStore);
    messageSender.connect().then(() => {
      groupId = Signal.KeyHelper.generateGroupId();
      messageSender
        .createGroup(numbers.split(','), groupId, name)
        .then(result => {
          console.log('Created group with ID: ', groupId);
        })
        .catch(printError);
    });
    break;
  case 'leaveGroup':
    groupId = args[1];
    numbers = args[2].split(',');
    messageSender = new Signal.MessageSender(protocolStore);
    messageSender.connect().then(() => {
      messageSender
        .leaveGroup(groupId, numbers)
        .then(result => {
          console.log(result);
          console.log('Left group with ID: ', groupId);
        })
        .catch(printError);
    });
    break;
  case 'receive':
    const messageReceiver = new Signal.MessageReceiver(protocolStore);
    messageReceiver.connect().then(() => {
      messageReceiver.addEventListener('message', ev => {
        console.log('*** EVENT ***:', ev);
        ev.data.message.attachments.map(attachment => {
          messageReceiver
            .handleAttachment(attachment)
            .then(attachmentPointer => {
              Signal.AttachmentHelper.saveFile(attachmentPointer, './').then(
                fileName => {
                  console.log('Wrote file to: ', fileName);
                }
              );
            });
        });
        if (ev.data.message.group) {
          console.log(ev.data.message.group);
          console.log(
            `Received message in group ${ 
              ev.data.message.group.id
               }: ${
               ev.data.message.body}`
          );
        } else {
          console.log('Received message: ', ev.data.message.body);
        }
        ev.confirm();
      });
      messageReceiver.addEventListener('configuration', ev => {
        console.log('Received configuration sync: ', ev.configuration);
        ev.confirm();
      });
      messageReceiver.addEventListener('group', ev => {
        console.log('Received group details: ', ev.groupDetails);
        ev.confirm();
      });
      messageReceiver.addEventListener('contact', ev => {
        console.log(
          `Received contact for ${ 
            ev.contactDetails.number
             } who has name ${
             ev.contactDetails.name}`
        );
        ev.confirm();
      });
      messageReceiver.addEventListener('verified', ev => {
        console.log('Received verification: ', ev.verified);
        ev.confirm();
      });
      messageReceiver.addEventListener('sent', ev => {
        console.log(
          `Message successfully sent from device ${ 
            ev.data.deviceId
             } to ${
             ev.data.destination
             } at timestamp ${
             ev.data.timestamp}`
        );
        ev.confirm();
      });
      messageReceiver.addEventListener('delivery', ev => {
        console.log(
          `Message successfully delivered to number ${ 
            ev.deliveryReceipt.source
             } and device ${
             ev.deliveryReceipt.sourceDevice
             } at timestamp ${
             ev.deliveryReceipt.timestamp}`
        );
        ev.confirm();
      });
      messageReceiver.addEventListener('read', ev => {
        console.log(
          `Message read on ${ 
            ev.read.reader
             } at timestamp ${
             ev.read.timestamp}`
        );
        ev.confirm();
      });
    });
    break;
  default:
    console.log('No valid command specified.');
    break;
}
