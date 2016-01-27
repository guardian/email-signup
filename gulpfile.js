var fs = require('vinyl-fs');
var gulp   = require('gulp');
var lambda = require('gulp-awslambda');
var zip    = require('gulp-zip');
var yaml = require('gulp-yaml');
var s3 = require('vinyl-s3');
var fail   = require('gulp-fail');
var flatten = require('gulp-flatten');
var runSequence = require('gulp-run-sequence');
var clean = require('gulp-clean');
var ts = require('gulp-typescript');
var rename = require('gulp-rename');
var kinesis = require('kinesis');
var taskListing = require('gulp-task-listing');
var riffraff = require('./riffraff');

var region = 'eu-west-1';

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
            'node_modules/validator/*',
            'node_modules/bluebird**/**/*'])
        .pipe(zip('dist/packages/email-ingest/email-ingest-handler-' + env + '.zip'))
        .pipe(gulp.dest('.'));
});

gulp.task('uploadEmailIngestHandler', function() {
    var emailIngestHandler = 'email-ingest-handler-' + env +'.zip';
    return fs.src('dist/' + emailIngestHandler)
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

    return gulp.src('dist/' + emailIngestHandler)
        .pipe(lambda(emailIngestHandlerConfig, lambdaOptions))
});

gulp.task('emailIngest', function(cb) {
    runSequence('clean', 'buildEmailIngestHandler', 'uploadEmailIngestHandler', 'updateEmailIngestHandler', cb);
});

//Email Subscribe
gulp.task('buildSubscribeHandler', ['typescript', 'writeConfig'], function() {
    return gulp.src([
            'built/triggersubscriberhandler.js',
            'node_modules/email-signup-config.js',
            'node_modules/fuel-soap**/**/*',
            'node_modules/monapt**/**/*',
            'node_modules/bluebird**/**/*'])
        .pipe(zip('dist/packages/email-signup/subscribe-handler-' + env + '.zip'))
        .pipe(gulp.dest('.'));
});

gulp.task('uploadSubscribeHandler', function() {
    var subscribeHandler = 'subscribe-handler-' + env +'.zip';
    return fs.src('dist/' + subscribeHandler)
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

    return gulp.src('dist/' + subscribeHandler)
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
    return s3.src('s3://aws-frontend-artifacts/lambda/email-signup-config-*.js', { buffer: false })
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

var tempDir = process.env.TMPDIR ? process.env.TMPDIR + 'target/riffraff' : 'target/riffraff';

gulp.task('buildEmailIngestDeployZip', function() {
    gulp.src(['dist/**/*', 'deploy/email-ingest/deploy.json'])
        .pipe(zip(tempDir + '/artifacts.zip'))
        .pipe(gulp.dest('.'));
});

gulp.task('uploadEmailIngestToRiffraff', function() {
    var packageName = 'dotcom:email-signup-ingest';
    var branch = 'master';
    var leadDir = tempDir;

    return riffraff.s3Upload(packageName, branch, leadDir);
});

gulp.task('emailIngestToRiffRaff', function(cb) {
    runSequence('clean', 'buildEmailIngestHandler', 'buildEmailIngestDeployZip', 'uploadEmailIngestToRiffraff', cb);
});
