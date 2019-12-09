//
/* eslint-disable no-console */
const fs = require('fs');
const { spawn } = require('child_process');
const { google } = require('googleapis');
const credentials = require('../Lingua-bdcce9a76860.json');

const fileName = 'backup.zip';

const scopes = ['https://www.googleapis.com/auth/drive'];

const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    scopes
);

const drive = google.drive({ version: 'v3', auth });

const zip = spawn(
    'zip',
    [
        '-rX',
        fileName,
        '../database',
        '../images',
        '../pronunciations',
    ]
);

zip.stdout.on('data', () => {
    // console.log(`${data}`);
});

zip.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
});

zip.on('close', async (code) => {
    console.log('Zip done...');
    if (code === 0) {
        const filesRequest = await drive.files.list({
            fields: 'files(id, name, webViewLink)',
        });

        const files = filesRequest.data.files;
        console.log(files);
        const folder = files.find(item => item.name === 'lingua');
        const alreadySaved = files.find(item => item.name === fileName);
        if (folder) {
            if (alreadySaved) {
                console.log('Remove previous backup...');
                await drive.files.delete({
                    'fileId': alreadySaved.id,
                });
            }

            console.log('Upload...');
            const newFileRequest = await drive.files.create({
                resource: {
                    name: fileName,
                },
                media: {
                    mimeType: 'application/zip',
                    body: fs.createReadStream(fileName),
                },
                fields: 'id',
            });

            const newFile = newFileRequest.data;
            console.log('New file Id: ', newFile.id);

            console.log('Move to lingua folder...');
            await drive.files.update({
                fileId: newFile.id,
                addParents: folder.id,
                fields: 'id, parents',
            });

            console.log('Done!');
            process.exit(0);
        } else {
            console.error('No folder access');
            process.exit(1);
        }
    } else {
        console.log(`Code: ${code}`);
    }
});
