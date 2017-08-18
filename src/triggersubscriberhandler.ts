/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../manual-typings/tsd.d.ts" />

import FuelSoap = require('fuel-soap');
import * as Promise from 'bluebird';
import * as Config from 'email-signup-config';
import * as Monapt from 'monapt';
import * as AWS from 'aws-sdk';

var Kinesis = new AWS.Kinesis();

//Local Interface
interface EmailData {
    email: string,
    listId: string,
    emailGroup: string,
    triggeredSendKey?: string,
    referrer?: string,
    campaignCode?: string
}

const partitionKey = 'exactTarget';
const exactTargetStatusStream = Config.Streams.exactTargetStatusStream;

const SoapClient: FuelSoap = new FuelSoap(Config.fuelSoapCredentials);

const createOption: CreateOption = {
    SaveOptions: [{
        SaveOption: {
            PropertyName: '*',
            SaveAction: 'UpdateAdd'
        }
    }]
};

const createTriggeredSend = (emailData: EmailData): TriggeredSend => {
    const email = emailData.email || '';
    const emailGroup = emailData.emailGroup || '';
    const referrer = emailData.referrer || '';
    const campaignCode = emailData.campaignCode || '';
    const triggeredSendKey = emailData.triggeredSendKey || '';

    const subscriberEmailGroup: ExtraAttribute = {
        Name: 'Email group',
        Value: emailGroup
    };

    const referrerAttribute: ExtraAttribute = {
        Name: 'Referrer',
        Value: referrer
    };

    const campaignCodeAttribute: ExtraAttribute = {
        Name: 'CampaignCode',
        Value: campaignCode
    };

    const subscriber: Subscriber = {
        EmailAddress: email,
        SubscriberKey: email,
        Attributes: [ subscriberEmailGroup, referrerAttribute, campaignCodeAttribute ],
        Status: "Active"
    };

    const triggeredSend = {
        TriggeredSendDefinition: {
            CustomerKey: triggeredSendKey
        },
        Subscribers: [subscriber]
    };

    console.log("Created TriggeredSend: " + JSON.stringify(triggeredSend));

    return triggeredSend;
};

const createSubscription = (emailData: EmailData): Subscriber => {
    const email = emailData.email || '';
    const listId = emailData.listId || '';

    const listSubscriber: ListSubscriber = {
        ID: listId,
        Status: 'Active'
    };

    const subscription = {
        EmailAddress: email,
        SubscriberKey: email,
        Lists: [ listSubscriber ],
        Status: "Active"
    };

    console.log("Created Subscription: " + JSON.stringify(subscription));

    return subscription;
};

const sendTriggeredSend = (triggeredSend: TriggeredSend): Promise<any> => {
    return new Promise(function (resolve, reject) {
        SoapClient.create(
            'TriggeredSend',
            triggeredSend,
            createOption,
            function (err:any, res:any) {
                console.log("TriggeredSend Callback");
                if (err) return reject(err);
                resolve(res);
            });
    });
};

const subscribeEmailToList = (subscriber: Subscriber): Promise<any> => {
    return new Promise(function (resolve, reject) {
        SoapClient.create(
            'Subscriber',
            subscriber,
            createOption,
            function (err, res) {
                console.log("Subscriber Callback");
                if (err) return reject(err);
                resolve(res);
            });
    });
};

const extractDataFromKinesisEvent = (kinesisEvent: KinesisEvent): Array<EmailData> => {
    return kinesisEvent.Records.map((record: KinesisRecord) => {
        console.log("Processing base64 event " + record.kinesis.data);
        let emailData: EmailData = JSON.parse(new Buffer(record.kinesis.data, 'base64').toString("ascii"));
        console.log(emailData);
        return emailData;
    });
};

const makePutRequest = (data: any): KinesisRequest => {
    return {
        Data: JSON.stringify(data),
        PartitionKey: partitionKey,
        StreamName: exactTargetStatusStream
    };
};

const makeSuccessPutRequest = (emailData: Array<EmailData>): KinesisRequest =>
    makePutRequest({status: "success", data: emailData});

const makeFailurePutRequest = (emailData: Array<EmailData>, error: Error): KinesisRequest =>
    makePutRequest({status: "failure", error: error, data: emailData});

const putStatusToStream = (kinesisRequest: KinesisRequest): Promise<any> => {
    return new Promise(function(resolve, reject) {
        Kinesis.putRecord(kinesisRequest, function (error: any, data: any) {
            if (error) return reject(error);
            console.log("Successfully put to ExactTargetStatus stream with SequenceNumber of " + data.SequenceNumber);
            return resolve(data);
        });
    })
};

export const handleKinesisEvent = (kinesisEvent: KinesisEvent, context: any): Promise<any> => {
        return Promise.resolve(kinesisEvent)
            .then(extractDataFromKinesisEvent)
            .then((emailDataList: Array<EmailData>) => {

                const emailDataListWithTriggers: Array<EmailData> =
                    emailDataList.filter((emailData) => emailData.triggeredSendKey !== undefined);

                const triggers: Promise<Array<any>> = Promise.map(emailDataListWithTriggers, createTriggeredSend).map(sendTriggeredSend);
                const subscriptions: Promise<Array<any>> = Promise.map(emailDataList, createSubscription).map(subscribeEmailToList);

                return Promise.join(triggers, subscriptions)
                    .map((responses: Array<any>) => {
                        return responses.map((response: any) => {
                            if (!response.body.Results[0]) throw "No results";
                            return response.body.Results;
                        });
                    })
                    .map((allResponses: Array<Array<any>>) => {
                        allResponses.map((results: Array<any>) => {
                            results.map((result: any) => {
                                console.log(JSON.stringify(result));
                                if (result.StatusCode !== 'OK') {
                                    console.log("Failed! StatusCode: " + result.StatusCode + " StatusMessage: " + result.StatusMessage);
                                    throw result;
                                }
                                return result;
                            });
                        });
                    })
                    .then(() => putStatusToStream(makeSuccessPutRequest(emailDataList)))
                    .catch((error) => {
                        console.log(error);
                        putStatusToStream(makeFailurePutRequest(emailDataList, error))
                    })
                    .then(() => Promise.resolve(emailDataList));
            })
            .then(list => {
                console.log("Successfully subscribed user(s) to lists.");
                console.log(JSON.stringify(list));
                context.succeed("Success: Successfully Subscribed Users");
            })
            .catch((error) => {
                console.log(error);
                context.succeed("Didn't work")
            });
};