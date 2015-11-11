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
            CustomerKey: emailData.triggeredSendKey
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
    Promise.resolve(kinesisEvent)
        .then(extractDataFromKinesisEvent)
        .then((emailData: Array<EmailData>) => {
            return Promise.all(emailData.map((emailData:EmailData) => {
                const triggeredSend: TriggeredSend = createTriggeredSend(emailData);
                return sendTriggeredSend(triggeredSend);
            }))
            .then((responses: Array<any>) => {
                return responses.map(response => {
                    console.log("Response body: " + JSON.stringify(response.body));

                    var result = response.body.Results[0] || {StatusCode: "Error", StatusMessage: "There were no results"};

                    if (result.StatusCode !== 'OK') {
                        throw "Failed! StatusCode: " + result.StatusCode + " StatusMessage: " + result.StatusMessage;
                    }

                    return result;
                });
            })
            .then(_ => {
                const emails = emailData.map(email => email.email).join(', ');
                const listIds = emailData.map(email => email.listId).join(', ');
                context.succeed("Successfully subscribed " + emails + " to " + listIds);
            })
        }).catch(context.fail);

};