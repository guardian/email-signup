declare class Auth {
    clientId: string;
    clientSecret: string;
}

declare class FuelSoapCredentials {
    auth: Auth;
    soapEndpoint: string;
}

declare class Streams {
    ingestionStream: string;
    exactTargetStatusStream: string;
}

declare class Lambda {
    emailIngestHandlerName: string;
    exactTargetHandlerName: string;
}

//declare class ExportType {
//    fuelSoapCredentials: FuelSoapCredentials;
//    streams: Streams;
//    lambda: Lambda;
//}

declare module 'email-signup-config' {
    export var fuelSoapCredentials: FuelSoapCredentials;
    export var streams: Streams;
    export var lambda: Lambda;
}