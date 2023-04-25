import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import core from '@actions/core';
import path from 'path';
import fs from 'fs';

const stream2buffer = (stream) => {
    return new Promise((resolve, reject) => {
        const _buf = [];

        stream.on("data", (chunk) => _buf.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(_buf)));
        stream.on("error", (err) => reject(err));
    });
}

const getLastItem = pathStr => pathStr.substring(pathStr.lastIndexOf('/') + 1);

const getBucketPaths = (destinationPath, currentDirectory) => {
    const paths = [];
    const files = fs.promises.readdir(currentDirectory);
    for (const file of files) {
        const fileStat = fs.promises.lstat(path.join(currentDirectory, file));
        if (fileStat.isFile()) {
            paths.push(path.join(destinationPath, file));
        } else if (fileStat.isDirectory()) {
            paths.push(...getBucketPaths(destinationPath, path.join(currentDirectory, file)));
        }
    }
    return paths;
};

const deployFile = async ({ s3Client, bucket, key, fileStream }) => {
    core.debug(`deployingFile: key: ${key}, bucket:${bucket}`);

    const fileBuffer = await stream2buffer(fileStream);
    const data = await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fileBuffer }));
    return data.Location;
}

const deployToS3 = async ({ s3Client, bucket, sourcePath, destinationPath }) => {
    const fullSourcePath = path.join(process.cwd(), sourcePath);
    const fileStats = await fs.promises.lstat(fullSourcePath);

    const bucketPaths = [];

    if (fileStats.isFile()) {
        core.debug(`${sourcePath} is a file`);
        core.debug(`destinationPath: ${destinationPath}`);

        const constructedPath = path.join(destinationPath, getLastItem(fullSourcePath));

        core.debug(`constructedPath: ${constructedPath}`);

        bucketPaths.push(constructedPath);
    } else if (fileStats.isDirectory()) {
        core.debug(`${sourcePath} is a directory`);
        bucketPaths.push(...getBucketPaths(destinationPath, fullSourcePath));
    } else {
        throw new Error('unsupported source path');
    }

    const deployPromises = bucketPaths.map((bucketPath) => {
        core.debug(`bucketPath: ${bucketPath}`);
        const fileStream = fs.createReadStream(fullSourcePath);
        return deployFile({ s3Client, bucket, key: bucketPath, fileStream });
    });

    return await Promise.all(deployPromises);
}


const init = async () => {
    try {
        const awsAccessKeyId = core.getInput('aws_access_key_id', {
            required: true,
        });
        const awsSecretAccessKey = core.getInput('aws_secret_access_key', {
            required: true,
        });
        const region = core.getInput('region', {
            required: false,
        });
        const bucket = core.getInput('bucket', {
            required: true,
        });
        const sourcePath = core.getInput('source_path', {
            required: true,
        });
        const destinationPath = core.getInput('destination_path', {
            required: false,
        });

        const s3Client = new S3Client({
            region: region,
            credentials: {
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey
            },
            signatureVersion: 'v4',
        });

        core.debug(`current working directory: ${process.cwd()}`);

        const files = await fs.promises.readdir(process.cwd());

        core.debug(`files: ${files}`);

        const locations = await deployToS3({ s3Client, bucket, sourcePath, destinationPath });
        core.setOutput('object_key', destinationPath);
        core.setOutput('object_locations', locations);
    } catch (error) {
        core.error(error);
        core.setFailed(error);
    }
}

init();