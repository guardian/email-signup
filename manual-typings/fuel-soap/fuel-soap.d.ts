/// <reference path="../tsd.d.ts" />

interface ExtraAttribute {
    Name: string;
    Value: string;
}

interface ListSubscriber {
    ID: number;
    Status: string;
}

interface Subscriber {
    EmailAddress: string;
    SubscriberKey: string;
    Lists?: Array<ListSubscriber>;
    Attributes?: Array<ExtraAttribute>;
}

interface TriggeredSendDefinition {
    CustomerKey: string;
}

interface TriggeredSend {
    TriggeredSendDefinition: TriggeredSendDefinition;
    Subscribers: Array<Subscriber>;
}

interface SaveOptionProperty {
    PropertyName: string;
    SaveAction: string;
}

interface SaveOption {
    SaveOption: SaveOptionProperty;
}

interface CreateOption {
    SaveOptions: Array<SaveOption>;
}

declare class FuelSoap {
    constructor(config: FuelSoapCredentials);

    create(soapType:string,
           triggeredSend:TriggeredSend,
           createOption:any,
           callback:(error:any, response:any) => any): any;
}

declare module 'fuel-soap' {
    export = FuelSoap
}