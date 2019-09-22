//
const path = require('path');

function getResponseCallback(res) {
    return (error, response) => {
        if (error) {
            res.send({
                error,
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
    return path.resolve(__dirname, '/../../images');
}

function getPronunciationsPath() {
    return path.resolve(__dirname, '/../../pronunciations');
}

exports = module.exports = {
    getResponseCallback,
    getFileId,
    getImagesPath,
    getPronunciationsPath,
};
