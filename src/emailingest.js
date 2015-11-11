var VALIDATOR = require('validator');
var AWS = require('aws-sdk');
var CONFIG = require('email-signup-config');

var PARTITION_KEY = 'email';
var STREAM_NAME = CONFIG.CODE.Streams.ingestionStream;
var KINESIS = new AWS.Kinesis();

AWS.config.region = 'eu-west-1';

function makePutRequest(email, listId) {
  return {
    Data: '{"email": "' + email + '", "listId": ' + listId + '}',
    PartitionKey: PARTITION_KEY,
    StreamName: STREAM_NAME
  };
}

exports.handler = function(event, context) {
    console.log('Received event:', JSON.stringify(event));

    if (event.email && event.listId && VALIDATOR.isEmail(event.email)) {
        var putRequest = makePutRequest(event.email, event.listId);

        KINESIS.putRecord(putRequest, function(err, data) {
          if (err) {
            console.log(err, err.stack);
            context.fail(new Error('Error'));
          }
          else {
            console.log("Successfully put to Kinesis with SequenceNumber of " + data.SequenceNumber);
            context.succeed("Success: Ingested Email");
          }
        });
    } else {
        context.fail(new Error('Failure: email or listId is not defined'));
    }
};
