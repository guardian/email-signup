var FuelSoap = require('fuel-soap');
var Promise = require('bluebird');
var Config = require('email-signup-config');

var soapClient = new FuelSoap(Config.fuelSoapCredentials);

//This makes the request an upsert;
//create if it doesn't exist, otherwise update
var createOption = {
  SaveOptions: [{
    SaveOption: {
      PropertyName: '*',
      SaveAction: 'UpdateAdd'
    }
  }]
};

function makeListSubscriber(listId) {
  return {
    ID: listId,
    Status: "Active"
  };
}

function makeRequestProps(email, listId) {
  var listSubscriber = makeListSubscriber(listId);
  return {
    EmailAddress: email,
    SubscriberKey: email,
    Lists: [ listSubscriber ]
  };
}

function subscribeEmailToListId(email, listId, callback) {
  var props = makeRequestProps(email, listId);
  soapClient.create(
    'Subscriber',
    props,
    createOption,
    callback
  );
}

function subscribeEmailToListIdPromise(email, listId) {
  var props = makeRequestProps(email, listId);

  return new Promise(function (resolve, reject) {
    soapClient.create(
      'Subscriber',
      props,
      createOption,
      function (err, res) {
          if (err) return reject(err);
          resolve(res);
      }
    );
  });
}

function extractDataFromKinesisEvent(event) {
  return event.Records.map(function(record) {
    console.log("Processing base64 event " + record.kinesis.data)
    return JSON.parse(new Buffer(record.kinesis.data, 'base64').toString("ascii"))});
}

exports.handler = function(kinesisEvent, context) {
  console.log("Got event: " + JSON.stringify(kinesisEvent));

  var events = extractDataFromKinesisEvent(kinesisEvent);
  console.log("Got event data: " + JSON.stringify(events));

  var data = events[0];

  console.log("Data is: " + JSON.stringify(data));
  console.log("email is: " + data.email);
  console.log("listId is: " + data.listId);

  if (data.email && data.listId) {
    subscribeEmailToListIdPromise(data.email, data.listId)
      .then(function(response){
        console.log("Response body: " + JSON.stringify(response.body));

        var result = response.body.Results[0] || {StatusCode: "Error", StatusMessage: "There were no results"};

        if (result.StatusCode === 'OK') {
          console.log("Successfully subscribed " + data.email + " to " + data.listId);
          context.succeed("Successfully subscribed " + data.email + " to " + data.listId);
        } else {
          console.log("Failed! StatusCode: " + result.StatusCode + " StatusMessage: " + result.StatusMessage);
          context.fail("Failed! StatusCode: " + result.StatusCode + " StatusMessage: " + result.StatusMessage);
        }
    })
      .catch(function(error) {
        console.log('Error in callback: ' + JSON.stringify(error));
        context.fail(error);
        return;
      });
  } else {
    console.log("No email or listId");
    context.fail("No email or listId");
  }
}
