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

function getFileId(word) {
    return word.trim().replace(/[\s|/|.|,]/g, '-');
}

function getImagesPath() {
    return path.resolve(__dirname, '../../images');
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

exports = module.exports = {
    getResponseCallback,
    getFileId,
    getImagesPath,
    getPronunciationsPath,
    getPronunciationFilePath,
    getApiKeyValidator,
};
