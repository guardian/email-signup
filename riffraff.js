var AWS = require('aws-sdk');
var Promise = require('bluebird');
var fs = require('fs');


function s3Upload(packageName, branch, leadDir) {

    if (!packageName) throw Error('s3Upload requires packageName');
    if (!branch) throw Error('s3Upload requires branch');
    if (!leadDir) throw Error('s3Upload requires leadDir');
    if (!process.env.BUILD_NUMBER) throw Error('No BUILD_NUMBER set');

    var buildId = process.env.BUILD_NUMBER;

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
        revision: 'unknownRevision',
        startTime: now.toISOString(),
        buildNumber: buildId,
        projectName: packageName
    };


    const s3 = new AWS.S3();
    const localArtifactFile = SETTINGS.leadDir + "/" + SETTINGS.artifactsFilename;
    console.log('Loading local artifact from ' + localArtifactFile);

    // build the path
    const rootPath = [SETTINGS.packageName, SETTINGS.buildId].join("/");
    console.log('Root path for deploy is '+ rootPath);

    var artifactPromise = new Promise((resolve, reject) => {
        const artifactPath = rootPath + "/" + SETTINGS.artifactsFilename;
        console.log("Uploading artifact to " + artifactPath);

        const stream = fs.createReadStream(localArtifactFile);
        const params = {
            Bucket: SETTINGS.artifactBucket,
            Key: artifactPath,
            Body: stream,
            ACL: "bucket-owner-full-control"
        };
        s3.upload(params, (err, success) => {
            if (err) {
                throw Error(err);
            }
            console.log("Artifact Upload Error: " + err);
            console.log("Artifact Upload Success: " + JSON.stringify(success));
            console.log(["Uploaded riffraff artifact to", artifactPath, "in",
                SETTINGS.artifactBucket].join(" "));
            resolve();
        });
    });


    // upload the manifest
    var manifestPromise = new Promise((resolve, reject) => {
        const manifestPath = rootPath + "/" + SETTINGS.manifestFile;
        console.log("Uploading manifest to " + manifestPath);

        s3.upload({
            Bucket: SETTINGS.manifestBucket,
            Key: manifestPath,
            ContentType: 'application/json',
            Body: JSON.stringify(MANIFEST),
            ACL: "bucket-owner-full-control"
        }, (err, success) => {
            if (err) {
                throw err;
            }
            console.log("Manifest Upload Error: " + err);
            console.log("Manifest Upload Success: " + JSON.stringify(success));
            console.log(["Uploaded riffraff manifest to", manifestPath, "in",
                SETTINGS.manifestBucket].join(" "));
            resolve();
        });
    });

    return Promise.all([manifestPromise, artifactPromise]);
}

module.exports = {
    s3Upload: s3Upload
};