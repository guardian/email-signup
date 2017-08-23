var AWS = require('aws-sdk');
var Promise = require('bluebird');
var fs = require('fs');

function s3Upload(projectName, srcRootDir, srcArtifactFile) {

    if (!projectName) throw Error('s3Upload requires packageName');
    if (!process.env.BRANCH_NAME) throw Error('No env.BRANCH_NAME set (%teamcity.build.branch%)');
    if (!srcRootDir) throw Error('s3Upload requires leadDir');
    if (!process.env.BUILD_NUMBER) throw Error('No env.BUILD_NUMBER set');
    if (!srcArtifactFile) throw Error('s3Upload requires srcArtifactFile');

    const buildId = process.env.BUILD_NUMBER;
    const branch = process.env.BRANCH_NAME;
    const revision = process.env.BUILD_VCS_NUMBER;

    const s3 = new AWS.S3();

    const destRootDir = [projectName, buildId].join("/");

    function uploadFileToS3(src, dest, bucket) {
        return new Promise(function (resolve, reject) {
            console.log('Uploading local file: ' + src);
            console.log(`Uploading to ${bucket}/${dest}`);

            const params = {
                Bucket: bucket,
                Key: dest,
                Body: fs.createReadStream(src),
                ACL: "bucket-owner-full-control"
            };

            s3.upload(params, function (err, success) {
                if (err) {
                    console.log(`Upload error: ${JSON.stringify(err)}`);
                    throw Error(err);
                }
                console.log(`Successfully uploaded to ${success.Location}`);
                return resolve(success);
            });
        });
    }

    function uploadManifestFile(dest, bucket) {
        new Promise(function(resolve, reject){

            const src = {
                branch: branch,
                vcsURL: 'https://github.com/guardian/email-signup',
                revision: revision,
                startTime: (new Date()).toISOString(),
                buildNumber: buildId,
                projectName: projectName
            };

            console.log(`Uploading manifest: ${JSON.stringify(src)}`);
            console.log(`Uploading to ${bucket}/${dest}`);

            s3.upload({
                Bucket: bucket,
                Key: dest,
                ContentType: 'application/json',
                Body: JSON.stringify(src),
                ACL: "bucket-owner-full-control"
            }, function(err, success){
                if (err) {
                    console.log(`Upload error: ${JSON.stringify(err)}`);
                    throw err;
                }
                console.log(`Successfully uploaded to ${success.Location}`);
                return resolve(success);
            });
        });
    }

    const manifestPromise = uploadManifestFile(
        destRootDir + "/build.json",
        "riffraff-builds");

    const riffRaffYamlPromise = uploadFileToS3(
        srcRootDir + "/" + "riff-raff.yaml",
        destRootDir + "/" + "riff-raff.yaml",
        'riffraff-artifact'
    );

    const artifactPromise = uploadFileToS3(
        srcRootDir + "/" + srcArtifactFile,
        destRootDir + "/" + srcArtifactFile,
        'riffraff-artifact'
    );

    return Promise.all([manifestPromise, riffRaffYamlPromise, artifactPromise]);
}

module.exports = {
    s3Upload: s3Upload
};