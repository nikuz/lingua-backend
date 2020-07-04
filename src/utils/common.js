//
const path = require('path');

function getResponseCallback(res, code) {
    return (error, response) => {
        if (error) {
            const errorCode = code | 500;
            res.status(errorCode);
            res.send({
                error: errorCode,
                message: error,
            });
        } else {
            res.send(response);
        }
    };
}

function getFileId(id, word) {
    const cleanedWord = word.split(' ')
        .map(part => (part.trim().replace(/[^A-Za-z0-9]/g, '')))
        .join('-')
        .toLowerCase();

    if (cleanedWord.length === 0) {
        return '';
    }

    return `${id}-${cleanedWord}`;
}

function getImagesPath() {
    return path.resolve(__dirname, '../../images');
}

function getImageFilePath(imagesPath, fileId) {
    return `${imagesPath}/${fileId}.jpeg`;
}

function getPronunciationsPath() {
    return path.resolve(__dirname, '../../pronunciations');
}

function getPronunciationFilePath(pronunciationsPath, fileId) {
    return `${pronunciationsPath}/${fileId}.mp3`;
}

function getApiKeyValidator(authorization) {
    return ['string', authorization, (internalCallback) => {
        if (authorization === process.env.API_KEY) {
            internalCallback();
        } else {
            internalCallback('Wrong API KEY');
        }
    }]
}

function trimMacQuotes(word) {
    return word.trim()
        .replace(/[\u2018\u2019]/g, "'") // single quotes ‘’
        .replace(/[\u201C\u201D]/g, '"'); // double quotes “”
}

exports = module.exports = {
    getResponseCallback,
    getFileId,
    getImagesPath,
    getImageFilePath,
    getPronunciationsPath,
    getPronunciationFilePath,
    getApiKeyValidator,
    trimMacQuotes,
};
