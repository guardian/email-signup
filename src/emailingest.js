var Config = require('email-signup-config');
var Promise  = require('bluebird');
var Validator = require('validator');
var AWS = require('aws-sdk');

var partitionKey = 'email';
var streamName = Config.CODE.Streams.ingestionStream;
var Kinesis = new AWS.Kinesis();

AWS.config.region = 'eu-west-1';

function validate(event) {
  return new Promise(function(resolve, reject) {
    if (!event.email)                    return reject("No email address");
    if (!event.listId)                   return reject("No listId");
    if (!Validator.isEmail(event.email)) return reject("Invalid email address");

    resolve(event);
  });
}

function makePutRequest(event) {
  return {
    Data: '{"email": "' + event.email + '", "listId": ' + event.listId + '}',
    PartitionKey: partitionKey,
    StreamName: streamName
  };
}

exports.handler = function(event, context) {
    console.log('Received event:', JSON.stringify(event));

    validate(event)
      .then(makePutRequest)
      .then(Promise.promisify(Kinesis.putRecord))
      .then(function() { context.succeed("Success: Ingested Email") })
      .catch(function(e) { context.fail(e) });
};
