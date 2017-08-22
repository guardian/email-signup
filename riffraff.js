var AWS = require('aws-sdk');
var Promise = require('bluebird');
var fs = require('fs');


function s3Upload(packageName, leadDir) {

    if (!packageName) throw Error('s3Upload requires packageName');
    if (!process.env.BRANCH_NAME) throw Error('No env.BRANCH_NAME set (%teamcity.build.branch%)');
    if (!leadDir) throw Error('s3Upload requires leadDir');
    if (!process.env.BUILD_NUMBER) throw Error('No env.BUILD_NUMBER set');

    var buildId = process.env.BUILD_NUMBER;
    var branch = process.env.BRANCH_NAME;
    var revision = process.env.BUILD_VCS_NUMBER;

    var SETTINGS = {
        leadDir: leadDir,
        packageName: packageName,
        buildId: buildId,
        artifactsFilename: 'artifacts.zip',
        artifactBucket: 'riffraff-artifact',
        manifestFile: 'build.json',
        manifestBucket: 'riffraff-builds'
    };

    var now = new Date();
    var MANIFEST = {
        branch: branch,
        vcsURL: 'https://github.com/guardian/email-signup',
        revision: revision,
        startTime: now.toISOString(),
        buildNumber: buildId,
        projectName: packageName
    };


    var s3 = new AWS.S3();
    console.log(new AWS.Config().credentials);
    var localArtifactFile = SETTINGS.leadDir + "/" + SETTINGS.artifactsFilename;
    console.log('Loading local artifact from ' + localArtifactFile);

    // build the path
    var rootPath = [SETTINGS.packageName, SETTINGS.buildId].join("/");
    console.log('Root path for deploy is '+ rootPath);

    var artifactPromise = new Promise(function(resolve, reject){
        var artifactPath = rootPath + "/" + SETTINGS.artifactsFilename;
        console.log("Uploading artifact to " + artifactPath);

        var stream = fs.createReadStream(localArtifactFile);
        var params = {
            Bucket: SETTINGS.artifactBucket,
            Key: artifactPath,
            Body: stream,
            ACL: "bucket-owner-full-control"
        };
        s3.upload(params, function(err, success){
            if (err) {
                console.log("Artifact Upload Error: " + err);
                console.log(JSON.stringify(err));
                throw Error(err);
            }
            console.log("Artifact Upload Success: " + JSON.stringify(success));
            console.log(["Uploaded riffraff artifact to", artifactPath, "in",
                SETTINGS.artifactBucket].join(" "));
            return resolve(success);
        });
    });


    // upload the manifest
    var manifestPromise = new Promise(function(resolve, reject){
        var manifestPath = rootPath + "/" + SETTINGS.manifestFile;
        console.log("Uploading manifest to " + manifestPath);

        s3.upload({
            Bucket: SETTINGS.manifestBucket,
            Key: manifestPath,
            ContentType: 'application/json',
            Body: JSON.stringify(MANIFEST),
            ACL: "bucket-owner-full-control"
        }, function(err, success){
            if (err) {
                console.log("Manifest Upload Error: " + err);
                throw err;
            }
            console.log("Manifest Upload Success: " + JSON.stringify(success));
            console.log(["Uploaded riffraff manifest to", manifestPath, "in",
                SETTINGS.manifestBucket].join(" "));
            return resolve(success);
        });
    });

    return Promise.all([manifestPromise, artifactPromise]);
}

module.exports = {
    s3Upload: s3Upload
};