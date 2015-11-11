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

var lambdaOptions = {
    region: 'eu-west-1'
};

//Cleaning
gulp.task('clean', function () {
    return gulp.src(['dist/', 'built/'], {read: false})
        .pipe(clean());
});

//Email Ingestion
gulp.task('buildEmailIngestHandler', function() {
    var Config = require('./node_modules/email-signup-config');
    return gulp.src([
            'node_modules/email-signup-config.js',
            'src/emailingest.js',
            'node_modules/validator/*'])
        .pipe(zip('dist/email-ingest-handler.zip'))
        .pipe(gulp.dest('.'));
});

gulp.task('uploadEmailIngestHandler', function() {
    return fs.src('dist/email-ingest-handler.zip')
        .pipe(s3.dest({
            Bucket: 'aws-frontend-artifacts',
            Key: 'lambda'
        }));
});

gulp.task('updateEmailIngestHandler', function() {
    var Config = require('./node_modules/email-signup-config');
    var emailIngestHandlerConfig = {
        FunctionName: Config.CODE.Lambda.emailIngestHandlerName
    };

    return gulp.src('dist/email-ingest-handler.zip')
        .pipe(lambda(emailIngestHandlerConfig, lambdaOptions))
});

gulp.task('emailIngest', function(cb) {
    runSequence('clean', 'buildEmailIngestHandler', 'uploadEmailIngestHandler', 'updateEmailIngestHandler', cb);
});

//Email Subscribe
gulp.task('buildSubscribeHandler', ['typescript'], function() {
    var Config = require('./node_modules/email-signup-config');
    return gulp.src([
            'built/triggersubscriberhandler.js',
            'node_modules/email-signup-config.js',
            'node_modules/fuel-soap**/**/*',
            'node_modules/monapt**/**/*',
            'node_modules/bluebird**/**/*'])
        .pipe(zip('dist/subscribe-handler.zip'))
        .pipe(gulp.dest('.'));
});

gulp.task('uploadSubscribeHandler', function() {
    return fs.src('dist/subscribe-handler.zip')
        .pipe(s3.dest({
            Bucket: 'aws-frontend-artifacts',
            Key: 'lambda'
        }));
});

gulp.task('updateSubscribeHandler', function() {
    var Config = require('./node_modules/email-signup-config');
    var subscribeHandlerConfig = {
        FunctionName: Config.CODE.Lambda.exactTargetHandlerName,
        Timeout: 15
    };

    return gulp.src('dist/subscribe-handler.zip')
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
    return s3.src('s3://aws-frontend-artifacts/lambda/email-signup-config.js', { buffer: false })
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