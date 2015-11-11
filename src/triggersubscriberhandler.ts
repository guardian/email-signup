/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../manual-typings/tsd.d.ts" />

import FuelSoap = require('fuel-soap');
import * as Promise from 'bluebird';
import * as Config from 'email-signup-config';

//Local Interface
interface EmailData {
    email: string,
    listId: string,
    emailGroup: string,
    triggeredSendKey: number
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
    const triggeredSendKey: string = emailData.triggeredSendKey && emailData.triggeredSendKey.toString(); 
    const subscriberEmailGroup: ExtraAttribute = {
        Name: 'Email group',
        Value: emailData.emailGroup
    };

    const subscriber: Subscriber = {
        EmailAddress: emailData.email,
        SubscriberKey: emailData.email,
        Attributes: [ subscriberEmailGroup ]
    };

    return {
        TriggeredSendDefinition: {
            CustomerKey: triggeredSendKey
        },
        Subscribers: [subscriber]
    };
};

const sendTriggeredSend = (triggeredSend: TriggeredSend): Promise<any> => {
    return new Promise(function (resolve, reject) {
        SoapClient.create(
            'TriggeredSend',
            triggeredSend,
            createOption,
            function (err: any, res: any) {
                if (err) return reject(err);
                resolve(res);
            }
        );
    });
};

const extractDataFromKinesisEvent = (kinesisEvent: KinesisEvent): Array<EmailData> => {
    return kinesisEvent.Records.map((record: KinesisRecord) => {
        console.log("Processing base64 event " + record.kinesis.data);
        return JSON.parse(new Buffer(record.kinesis.data, 'base64').toString("ascii"))});
};

export const handleKinesisEvent = (kinesisEvent: KinesisEvent, context: any): void => {
    const emailData: Array<EmailData> = extractDataFromKinesisEvent(kinesisEvent);

    emailData.forEach((emailData: EmailData) => {
        const triggeredSend: TriggeredSend = createTriggeredSend(emailData);
        sendTriggeredSend(triggeredSend)
            .then((response: any) => {
                console.log("Response body: " + JSON.stringify(response.body));

                var result = response.body.Results[0] || {StatusCode: "Error", StatusMessage: "There were no results"};

                if (result.StatusCode === 'OK') {
                    console.log("Successfully subscribed " + emailData.email + " to " + emailData.listId);
                    context.succeed("Successfully subscribed " + emailData.email + " to " + emailData.listId);
                } else {
                    console.log("Failed! StatusCode: " + result.StatusCode + " StatusMessage: " + result.StatusMessage);
                    context.fail("Failed! StatusCode: " + result.StatusCode + " StatusMessage: " + result.StatusMessage);
                }
            })
            .catch((error: any) => {
                console.log('Error in callback: ' + JSON.stringify(error));
                context.fail(error);
            });
    });
};
