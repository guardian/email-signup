/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../manual-typings/tsd.d.ts" />

import FuelSoap = require('fuel-soap');
import * as Promise from 'bluebird';
import * as Config from 'email-signup-config';
import * as Monapt from 'monapt';

//Local Interface
interface EmailData {
    email: string,
    listId: string,
    emailGroup: string,
    triggeredSendKey: string
}

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
    const triggeredSendKey = emailData.triggeredSendKey || '';

    const subscriberEmailGroup: ExtraAttribute = {
        Name: 'Email group',
        Value: emailGroup
    };

    const subscriber: Subscriber = {
        EmailAddress: email,
        SubscriberKey: email,
        Attributes: [ subscriberEmailGroup ]
    };

    return {
        TriggeredSendDefinition: {
            CustomerKey: triggeredSendKey
        },
        Subscribers: [subscriber]
    };
};

const createSubscription = (emailData: EmailData): Subscriber => {
    const email = emailData.email || '';
    const listId = emailData.listId || '';

    const listSubscriber: ListSubscriber = {
        ID: listId,
        Status: 'Active'
    };

    return {
        EmailAddress: email,
        SubscriberKey: email,
        Lists: [ listSubscriber ]
    };
};

const sendTriggeredSend = (triggeredSend: TriggeredSend): Promise<any> =>  {
    return new Promise(function (resolve, reject) {
        try {
            SoapClient.create(
                'TriggeredSend',
                triggeredSend,
                createOption,
                function (err: any, res: any) {
                    console.log("TriggeredSend Callback");
                    console.log(err);
                    console.log(res);
                    if (err) return reject(err);
                    resolve(res);
                }
            );
        } catch(error) { reject(error); }
    });
};

const subscribeEmailToList = (subscriber: Subscriber): Promise<any> => {
    return new Promise(function (resolve, reject) {
        try {
            SoapClient.create(
                'Subscriber',
                subscriber,
                createOption,
                function (err, res) {
                    console.log("Subscriber Callback");
                    console.log(err);
                    console.log(res);
                    if (err) return reject(err);
                    resolve(res);
                }
            );
        } catch(error){ reject(error); }
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

export const handleKinesisEvent = (kinesisEvent: KinesisEvent, context: any): Promise<any> => {
        process.on('uncaughtException', (error: any) => {
            console.log("IN uncaughtException");
            console.log(error);
        });
        process.on('unhandledRejection', (error: any) => {
            console.log("IN unhandledRejection");
            console.log(error);
        });

        return Promise.resolve(kinesisEvent)
            .then(extractDataFromKinesisEvent)
            .then((emailDataList: Array<EmailData>) => {
                console.log("THEN 2");

                const promiseTriggeredSend = Promise.all(emailDataList.map((emailData: EmailData) => {
                        console.log("BEFORE THEN promiseTriggeredSend");
                        const triggeredSend: TriggeredSend = createTriggeredSend(emailData);
                        console.log("I MADE THE TRIGGEREDSEND: " + JSON.stringify(triggeredSend));
                        return sendTriggeredSend(triggeredSend);
                    }))
                    .then((responses: Array<any>) => {
                        console.log("THEN OF promiseTriggeredSend");
                        return responses.map(response => {
                            console.log("Response body: " + JSON.stringify(response.body));

                            var result = response.body.Results[0] || {StatusCode: "Error", StatusMessage: "There were no results"};

                            if (result.StatusCode !== 'OK') {
                                throw "Failed! StatusCode: " + result.StatusCode + " StatusMessage: " + result.StatusMessage;
                            }

                            return result;
                        });
                    });

                const promiseSubscribeToList: Promise<any> = Promise.all(emailDataList.map((emailData: EmailData) => {
                        console.log("BEFORE THEN promiseSubscribeToList");
                        const listSubscriber: Subscriber = createSubscription(emailData);
                        console.log("I MADE THE SUBSCRIBER: " + JSON.stringify(listSubscriber));
                        return subscribeEmailToList(listSubscriber)
                    }))
                    .then((responses: Array<any>) => {
                        console.log("THEN OF promiseSubscribeToList");
                        return responses.map(response => {
                            console.log("Response body: " + JSON.stringify(response.body));

                            var result = response.body.Results[0] || {StatusCode: "Error", StatusMessage: "There were no results"};

                            if (result.StatusCode !== 'OK') {
                                throw "Failed! StatusCode: " + result.StatusCode + " StatusMessage: " + result.StatusMessage;
                            }

                            return result;
                        });
                    });

                console.log("I AM ABOUT TO RETURN");
                return Promise.join(promiseTriggeredSend, promiseSubscribeToList)
                    .then(_ => {
                        console.log("FINISHED APPARENTLY");
                        const emails = emailDataList.map(email => email.email).join(', ');
                        const listIds = emailDataList.map(email => email.listId).join(', ');
                        context.succeed("Successfully subscribed " + emails + " to " + listIds);
                    });
            }).catch(context.succeed("DOESN'T WORK"));
};