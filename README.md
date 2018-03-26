# Email Signup

## Setup

### AWS Credentials

Ensure you have valid AWS credentials setup in `~/.aws/credentials` (for the frontend account)


### NPM, Gulp and Typescript

If using [NVM](https://github.com/creationix/nvm):

    nvm use

Then

    npm install
    npm install --global gulp

### Exact Target Credentials

Download Exact Target credentials with:

    gulp downloadCredentials


## Building

There are two handlers:

  - Email ingest (`emailingest.js`)
  - Exact target subscribe (`triggersubscriberhandler.ts`)


### Email Ingestion

To build and update this handler run;

    gulp emailIngest

This runs this following commands:

    gulp clean
    gulp buildEmailIngestHandler
    gulp uploadEmailIngestHandler
    gulp updateEmailIngestHandler

### Subscribe Handler

To build and update this handler run;

    gulp emailSubscribe

This runs this following commands:

    gulp clean
    gulp buildSubscribeHandler
    gulp uploadSubscribeHandler
    gulp updateSubscribeHandler

## Cloudformation

In the case of needing to cloudform there is a `gulp` task to convert the `YAML` to `JSON`, but there is *no* `upload` task.

    `gulp buildCloudformation`

You will need to manually upload the template and specify the parameters.

## Watch Tasks

To watch the `streams` there are two tasks;

    gulp listenEmailIngest

    gulp listenExactTarget

Both support `--prod` to listen to the `PROD` streams.

## Other tasks

    gulp typescript

    gulp clean

    gulp writeConfig
