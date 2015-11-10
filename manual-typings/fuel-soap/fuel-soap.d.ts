/// <reference path="../tsd.d.ts" />

declare interface ExtraAttribute {
    Name: string;
    Value: string;
}

declare interface ListSubscriber {
    ID: number;
    Status: string;
}

declare interface Subscriber {
    EmailAddress: string;
    SubscriberKey: string;
    Lists?: Array<ListSubscriber>;
    Attributes?: Array<ExtraAttribute>;
}

declare interface TriggeredSendDefinition {
    CustomerKey: string;
}

declare interface TriggeredSend {
    TriggeredSendDefinition: TriggeredSendDefinition;
    Subscribers: Array<Subscriber>;
}

declare interface SaveOptionProperty {
    PropertyName: string;
    SaveAction: string;
}

declare interface SaveOption {
    SaveOption: SaveOptionProperty;
}

declare interface CreateOption {
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