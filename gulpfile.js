var gulp   = require('gulp');
var lambda = require('gulp-awslambda');
var zip    = require('gulp-zip');
var yaml = require('gulp-yaml');
var s3 = require('vinyl-s3');
var fail   = require('gulp-fail');
var flatten = require('gulp-flatten');

var lambdaOptions = {
    region: 'eu-west-1'
};

gulp.task('updateEmailIngest', function() {
    var Config = require('./email-signup-config');

    var emailIngestHandlerConfig = {
      FunctionName: Config.Lambda.emailIngestHandlerName
    };

    return gulp.src(['email-signup-config.js', 'emailingest.js', 'node_modules/validator/*'])
        .pipe(zip('dist/email-ingest-handler.zip'))
        .pipe(lambda(emailIngestHandlerConfig, lambdaOptions))
        .pipe(gulp.dest('.'));
});

gulp.task('updateSubscribeHandler', function() {
    var Config = require('./email-signup-config');

    var subscribeHandlerConfig = {
      FunctionName: Config.Lambda.exactTargetHandlerName,
      Timeout: 15
    };

    return gulp.src([
      'subscribehandler.js',
      'email-signup-config.js',
      'node_modules/fuel-soap**/**/*',
      'node_modules/bluebird**/**/*'])
        .pipe(zip('dist/subscribe-handler.zip'))
        .pipe(lambda(subscribeHandlerConfig, lambdaOptions))
        .pipe(gulp.dest('.'));
});

//Cloudformation Tasks
gulp.task('buildCloudformation', function() {
  return gulp.src('./cloudformation/*.yml')
    .pipe(yaml({ schema: 'DEFAULT_SAFE_SCHEMA' }))
    .pipe(gulp.dest('./dist'));
});

gulp.task('downloadCredentials', function() {
    return s3.src('s3://aws-frontend-artifacts/lambda/email-signup-config.js', { buffer: false })
        .pipe(flatten())
        .pipe(gulp.dest('.'));
});
