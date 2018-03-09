var fs = require('vinyl-fs');
var gulp   = require('gulp');
var lambda = require('gulp-awslambda');
var zip    = require('gulp-zip');
var yaml = require('gulp-yaml');
var s3 = require('vinyl-s3');
var fail   = require('gulp-fail');
var flatten = require('gulp-flatten');
var runSequence = require('run-sequence');
var clean = require('gulp-clean');
var ts = require('gulp-typescript');
var rename = require('gulp-rename');
var kinesis = require('kinesis');
var taskListing = require('gulp-task-listing');
var riffraff = require('./riffraff');

var region = 'eu-west-1';

var AWS = require('aws-sdk');
AWS.config = new AWS.Config();
AWS.config.region = "eu-west-1";
var frontendS3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID_FRONTEND,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_FRONTEND});

var lambdaOptions = {
    region: region
};

var env = (function() {
  function prod(str) { return /prod/gi.test(str); }

  return process.argv.some(prod) ? 'PROD' : 'CODE';
})();

var envConfig = 'email-signup-config-' + env + '.js';
var config = 'email-signup-config.js';


function getConfig() {
  return require(envConfig);
}

//Help
gulp.task('help', taskListing);

gulp.task('default', ['help']);

//Cleaning
gulp.task('clean', function () {
    return gulp.src(['dist/', 'built/'], {read: false})
        .pipe(clean());
});

gulp.task('writeConfig', function() {
    return gulp.src('./node_modules/' + envConfig)
        .pipe(rename(config))
        .pipe(gulp.dest('./node_modules'));
});

//Email Ingestion
gulp.task('buildEmailIngestHandler', ['writeConfig'], function() {
    var Config = require('./node_modules/email-signup-config');
    return gulp.src([
            'node_modules/email-signup-config.js',
            'src/emailingest.js',
            'node_modules**/**/*.*'])
        .pipe(zip('dist/email-ingest/email-ingest-handler-' + env + '.zip'))
        .pipe(gulp.dest('.'));
});

gulp.task('uploadEmailIngestHandler', function() {
    var emailIngestHandler = 'email-ingest-handler-' + env +'.zip';
    return fs.src('dist/email-ingest/' + emailIngestHandler)
        .pipe(s3.dest({
            Bucket: 'aws-frontend-artifacts',
            Key: 'lambda'
        }));
});

gulp.task('updateEmailIngestHandler', function() {
    var emailIngestHandlerConfig = {
        FunctionName: getConfig().Lambda.emailIngestHandlerName
    };

    var emailIngestHandler = 'email-ingest-handler-' + env +'.zip';

    return gulp.src('dist/email-ingest/' + emailIngestHandler)
        .pipe(lambda(emailIngestHandlerConfig, lambdaOptions))
});

gulp.task('emailIngest', function(cb) {
    runSequence('clean', 'buildEmailIngestHandler', 'uploadEmailIngestHandler', 'updateEmailIngestHandler', cb);
});

//Email Subscribe
gulp.task('buildSubscribeHandler', ['writeConfig'], function() {
    return gulp.src([
        'built/triggersubscriberhandler.js',
        'node_modules**/**/*.*'])
        .pipe(zip('dist/exact-target-handler/subscribe-handler-' + env + '.zip'))
        .pipe(gulp.dest('./'));
});

gulp.task('uploadSubscribeHandler', function() {
    var subscribeHandler = 'subscribe-handler-' + env +'.zip';
    return fs.src('dist/exact-target-handler/' + subscribeHandler)
        .pipe(s3.dest({
            Bucket: 'aws-frontend-artifacts',
            Key: 'lambda'
        }));
});

gulp.task('updateSubscribeHandler', function() {
    var subscribeHandlerConfig = {
        FunctionName: getConfig().Lambda.exactTargetHandlerName,
        Timeout: 15
    };

    var subscribeHandler = 'subscribe-handler-' + env +'.zip';

    return gulp.src('dist/exact-target-handler/' + subscribeHandler)
        .pipe(lambda(subscribeHandlerConfig, lambdaOptions))
});

gulp.task('emailSubscribe', function(cb) {
    runSequence('clean', 'buildSubscribeHandler', 'uploadSubscribeHandler', 'updateSubscribeHandler', cb);
});

//Cloudformation Tasks
gulp.task('buildCloudformation', function() {
    return gulp.src('./cloudformation/*.yml')
        .pipe(yaml({ schema: 'DEFAULT_SAFE_SCHEMA' }))
        .pipe(gulp.dest('./dist'));
});

//Credentials
gulp.task('downloadCredentials', function() {
    return s3.src('s3://aws-frontend-artifacts/lambda/email-signup-config-*.js',
     { buffer: false, s3: frontendS3 })
        .pipe(flatten())
        .pipe(gulp.dest('./node_modules'));
});

gulp.task('typescript', function () {
    return gulp.src('src/triggersubscriberhandler.ts')
        .pipe(ts({
            noImplicitAny: true,
            module: 'commonjs'
        }))
        .pipe(gulp.dest('built'));
});

//Kinesis Listeners
function kinesisPrinter(streamName) {
    function extractDataFromKinesisEvent(event) {
        return event.Data.toString("utf-8");
    }

    function dataPrinter(event) {
        console.log(extractDataFromKinesisEvent(event));
    }

    var kinesisSource = kinesis.stream({region: region, name: streamName, oldest: false});
    kinesisSource.on('data', dataPrinter);
    return kinesisSource;
}

gulp.task('listenEmailIngest', function() {
    var streamName = getConfig().Streams.ingestionStream;
    console.log("Listening to " + streamName);
    return kinesisPrinter(getConfig().Streams.ingestionStream);
});

gulp.task('listenExactTarget', function() {
    var streamName = getConfig().Streams.exactTargetStatusStream;
    console.log("Listening to " + streamName);
    return kinesisPrinter(getConfig().Streams.exactTargetStatusStream);
});

gulp.task('buildEmailIngestRiffRaffPackage', function() {
   return gulp.src(['dist/**/*', 'deploy/email-ingest/riff-raff.yaml'])
        .pipe(gulp.dest('target/riffraff/'));
});

gulp.task('uploadEmailIngestToRiffraff', function() {
    const projectName = 'dotcom:email-signup-ingest';
    const srcRootDir = 'target/riffraff';
    const srcArtifactFile = 'email-ingest/email-ingest-handler-' + env + '.zip';

    return riffraff.s3Upload(projectName, srcRootDir, srcArtifactFile);
});

gulp.task('buildExactTargetHandlerRiffRaffPackage', function() {
   return gulp.src(['dist/**/*', 'deploy/subscribe-handler/riff-raff.yaml'])
       .pipe(gulp.dest('target/riffraff/'));
});

gulp.task('uploadExactTargetHandlerToRiffraff', function() {
    const projectName = 'dotcom:email-signup-exact-target-handler';
    const srcRootDir = 'target/riffraff';
    const srcArtifactFile = 'exact-target-handler/subscribe-handler-' + env + '.zip';

    return riffraff.s3Upload(projectName, srcRootDir, srcArtifactFile);
});

gulp.task('emailIngestToRiffRaff', function(callback) {
    runSequence(
        'clean',
        'typescript',
        'downloadCredentials',
        'buildEmailIngestHandler',
        'buildEmailIngestRiffRaffPackage',
        'uploadEmailIngestToRiffraff'
    );
});

gulp.task('exactTargetHandlerToRiffRaff', function(callback) {
    runSequence(
        'clean',
        'typescript',
        'downloadCredentials',
        'buildSubscribeHandler',
        'buildExactTargetHandlerRiffRaffPackage',
        'uploadExactTargetHandlerToRiffraff'
    );
});
