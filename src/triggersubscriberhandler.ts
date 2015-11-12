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
        Lists: [ listSubscriber ]
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

export const handleKinesisEvent = (kinesisEvent: KinesisEvent, context: any): Promise<any> => {
        return Promise.resolve(kinesisEvent)
            .then(extractDataFromKinesisEvent)
            .then((emailDataList: Array<EmailData>) => {
                const triggers: Promise<Array<any>> = Promise.map(emailDataList, createTriggeredSend).map(sendTriggeredSend);
                const subscriptions: Promise<Array<any>> = Promise.map(emailDataList, createSubscription).map(subscribeEmailToList);

                return Promise.join(triggers, subscriptions)
                    .map((response: any) => {
                        if (!response.body.Results[0]) throw "No results";
                        return response.body.Results;
                    })
                    .map((result: any) => {
                        if (result.StatusCode !== 'OK') throw result;
                        return result;
                    })
                    .then(() => Promise.resolve(emailDataList));
            })
            .then(list => {
                console.log("FINISHED APPARENTLY");
                console.log(list);
                context.succeed(kinesisEvent);
            })
            .catch(() => context.succeed("Didn't work"));
};