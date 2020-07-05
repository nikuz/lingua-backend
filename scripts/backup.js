//
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
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

const zipOutput = fs.createWriteStream(`${__dirname}/${fileName}`);
const archive = archiver('zip', {
    zlib: { level: 9 },
});

archive.on('error', err => {
    throw err;
});

zipOutput.on('close', async () => {
    console.log('Zip done...');
    const filesRequest = await drive.files.list({
        fields: 'files(id, name, webViewLink)',
    });

    const files = filesRequest.data.files;
    console.log(files);
    const folder = files.find(item => item.name === 'lingua');
    const alreadySaved = files.find(item => item.name === fileName);
    if (folder) {
        console.log('Upload...');
        const newFileRequest = await drive.files.create({
            resource: {
                name: fileName,
            },
            media: {
                mimeType: 'application/zip',
                body: fs.createReadStream(path.join(__dirname, fileName)),
            },
            fields: 'id',
        });

        const newFile = newFileRequest.data;
        console.log('New file Id: ', newFile.id);

        if (alreadySaved) {
            console.log('Remove previous backup...');
            await drive.files.delete({
                'fileId': alreadySaved.id,
            });
        }

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
});


archive.pipe(zipOutput);

archive.directory('../database');
archive.directory('../images');
archive.directory('../pronunciations');

archive.finalize();
