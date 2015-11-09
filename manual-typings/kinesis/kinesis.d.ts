interface KinesisData {
    partitionKey: string,
    data: string,
    kinesisSchemaVersion: string,
    sequenceNumber: string
}

interface KinesisRecord {
    eventId: string,
    eventVersion: string,
    kinesis: KinesisData,
    invokeIdentityArn: string,
    eventName: string,
    eventSourceArn: string,
    eventSource: string,
    awsRegion: string
}

interface KinesisEvent {
    Records: Array<KinesisRecord>
}

declare module 'kinesis' {
    export default KinesisEvent;
}