declare module 'aws-sdk' {
    export class Kinesis {
        putRecord(record: any, cb: any): any;
    }
}