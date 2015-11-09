/// <reference path="typings/tsd.d.ts" />
/// <reference path="manual-typings/tsd.d.ts" />

import FuelSoap from 'fuel-soap';
import * as Promise from 'bluebird';
import * as Config from 'email-signup-config';

const SoapClient: FuelSoap = new FuelSoap(Config.fuelSoapCredentials);

const createOption: CreateOption = {
    SaveOptions: [{
        SaveOption: {
            PropertyName: '*',
            SaveAction: 'UpdateAdd'
        }
    }]
};

const createTriggeredSend = (email: string, triggeredSendKey: number, emailGroup: string): TriggeredSend => {
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
            CustomerKey: triggeredSendKey.toString()
        },
        Subscribers: [subscriber]
    };
};

function sendTriggeredSend(email: string, triggeredSendKey: number, emailGroup: string): Promise<any> {
    const triggeredSend: TriggeredSend = createTriggeredSend(email, triggeredSendKey, emailGroup);

    return new Promise(function (resolve, reject) {
        SoapClient.create(
            'TriggeredSend',
            triggeredSend,
            createOption,
            function (err, res) {
                if (err) return reject(err);
                resolve(res);
            }
        );
    });
}







