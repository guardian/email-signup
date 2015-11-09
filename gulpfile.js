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

var lambdaOptions = {
    region: 'eu-west-1'
};

var env = (function() {
  function prod(str) { return /prod/gi.test(str); }

  return process.argv.some(prod) ? 'PROD' : 'CODE';
})();

var getConfig = function() {
    return require('./email-signup-config')[env];
};

//Cleaning
gulp.task('clean', function () {
    return gulp.src('dist/', {read: false})
        .pipe(clean());
});

//Email Ingestion
gulp.task('buildEmailIngestHandler', function() {
    return gulp.src([
            'email-signup-config.js',
            'emailingest.js',
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
    var emailIngestHandlerConfig = {
        FunctionName: getConfig().Lambda.emailIngestHandlerName
    };

    return gulp.src('dist/email-ingest-handler.zip')
        .pipe(lambda(emailIngestHandlerConfig, lambdaOptions))
});

gulp.task('emailIngest', function(cb) {
    runSequence('clean', 'buildEmailIngestHandler', 'uploadEmailIngestHandler', 'updateEmailIngestHandler', cb);
});

//Email Subscribe
gulp.task('buildSubscribeHandler', function() {
    return gulp.src([
            'subscribehandler.js',
            'email-signup-config.js',
            'node_modules/fuel-soap**/**/*',
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
    var subscribeHandlerConfig = {
        FunctionName: getConfig().Lambda.exactTargetHandlerName,
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
        .pipe(gulp.dest('.'));
});
