var Config = require('email-signup-config');
var Promise  = require('bluebird');
var Validator = require('validator');
var AWS = require('aws-sdk');

var partitionKey = 'email';
var streamName = Config.Streams.ingestionStream;
var Kinesis = new AWS.Kinesis();

AWS.config.region = 'eu-west-1';

function validate(event) {
  return new Promise(function(resolve, reject) {
    if (!event.email)                    return reject("No email address");
    if (!event.listId)                   return reject("No listId");
    if (!event.emailGroup)               return reject("No emailGroup");
    if (!Validator.isEmail(event.email)) return reject("Invalid email address");

    resolve(event);
  });
}

function makePutRequest(event) {
    var data = {
        email: event.email,
        listId: event.listId,
        emailGroup: event.emailGroup,
        triggeredSendKey: event.triggeredSendKey};

    if (event.triggeredSendKey) {
        data.triggeredSendKey = event.triggeredSendKey;}

    if (event.referrer) {
        data.referrer = event.referrer;}

    if (event.campaignCode) {
        data.campaignCode = event.campaignCode;}

    return {
        Data: JSON.stringify(data),
        PartitionKey: partitionKey,
        StreamName: streamName
  };
}

exports.handler = function(event, context) {
    console.log('Received event:', JSON.stringify(event));

    validate(event)
      .then(makePutRequest)
      .then(function (record) {
          return new Promise(function(resolve, reject) {
              Kinesis.putRecord(record, function (error, data) {
                  if (error) return reject(error);
                  console.log("Successfully put to Kinesis with SequenceNumber of " + data.SequenceNumber);
                  return resolve(data);
              });
          })})
      .then(function() { context.succeed("Success: Ingested Email") })
      .catch(function(e) { context.fail(e) });
};
