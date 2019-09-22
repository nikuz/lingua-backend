//
const http = require('http');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const _ = require('underscore');
const validator = require('../utils/validator');
const commonUtils = require('../utils/common');
const db = require('../utils/db');

function get(options, callback) {
    const workflow = new EventEmitter();
    const cb = callback || _.noop;
    const word = options.word;

    workflow.on('validateParams', () => {
        validator.check({
            word: ['string', word],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('getWordFromDatabase');
            }
        });
    });

    workflow.on('getWordFromDatabase', () => {
        db.get(
            'SELECT * FROM dictionary WHERE word=$pattern;',
            {
                $pattern: word,
            },
            (error, response) => {
                if (error) {
                    cb(error);
                } else {
                    cb(null, response);
                }
            }
        );
    });

    workflow.emit('validateParams');
}

function find(options, callback) {
    const workflow = new EventEmitter();
    const cb = callback || _.noop;
    const wordPart = options.wordPart;

    workflow.on('validateParams', () => {
        validator.check({
            wordPart: ['string', wordPart],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('search');
            }
        });
    });

    workflow.on('search', () => {
        db.run(
            'SELECT * FROM dictionary WHERE word LIKE $pattern;',
            {
                $pattern: `%${wordPart}%`,
            },
            (error, response) => {
                if (error) {
                    cb(error);
                } else {
                    console.log(response);
                    cb(null, response);
                }
            }
        );
    });

    workflow.emit('validateParams');
}

function set(options, callback) {
    const workflow = new EventEmitter();
    const cb = callback || _.noop;
    const {
        word,
        translation,
        raw,
        pronunciationURL,
        image,
    } = options;
    const imagesPath = commonUtils.getImagesPath();
    const pronunciationsPath = commonUtils.getPronunciationsPath();
    let fileId;
    let imageExtension;

    workflow.on('validateParams', () => {
        validator.check({
            word: ['string', word],
            translation: ['string', translation],
            raw: ['string', raw],
            pronunciationURL: ['string', pronunciationURL],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('checkAlreadyExists');
            }
        });
    });

    workflow.on('checkAlreadyExists', () => {
        get({ word }, (err, response) => {
            if (err) {
                cb(err);
            } else if (response) {
                console.log(response);
                cb('Word already exists in database')
            } else {
                workflow.emit('getFileId');
            }
        });
    });

    workflow.on('getFileId', () => {
        fileId = commonUtils.getFileId(word);
        if (!fileId.length) {
            cb('Can\'t create file id from word');
        } else {
            workflow.emit('saveImage');
        }
    });

    workflow.on('saveImage', () => {
        if (image) {
            const base64Reg = /^data:image\/(jpeg|png|jpg);base64,(.+)$/;
            let imageData = image.match(base64Reg);
            if (!imageData) {
                cb('Image is not in base64 format');
            } else {
                imageExtension = imageData[1];
                fs.writeFileSync(`${imagesPath}/${fileId}.${imageExtension}`, imageData[2], 'base64');
                workflow.emit('savePronunciations');
            }
        } else {
            workflow.emit('savePronunciations');
        }
    });

    workflow.on('savePronunciations', () => {
        let httpGet = http.get;
        if (pronunciationURL.indexOf('https') === 0) {
            httpGet = https.get;
        }

        const pronunciationsFile = `${pronunciationsPath}/${fileId}.mp3`;
        const pronunciationsFileStream = fs.createWriteStream(pronunciationsFile);
        const request = httpGet(pronunciationURL, (response) => {
            if (response.statusCode !== 200) {
                cb(`Image downloading status code is ${response.statusCode}`);
            } else {
                response.pipe(pronunciationsFileStream);
            }
        });

        request.on('error', (err) => {
            fs.unlink(pronunciationsFile);
            cb(err.message);
        });

        pronunciationsFileStream.on('error', (err) => {
            fs.unlink(pronunciationsFile);
            cb(err.message);
        });

        pronunciationsFileStream.on('finish', () => {
            pronunciationsFileStream.close(() => {
                workflow.emit('fillDatabase');
            })
        });
    });

    workflow.on('fillDatabase', () => {
        const imageData = imageExtension ? `/images/${fileId}.${imageExtension}` : '';
        db.run(
            `
                INSERT INTO dictionary (word, translation, pronunciation, raw, image)
                VALUES($word, $translation, $pronunciation, $raw, $imageData);
            `,
            {
                $word: word,
                $translation: translation,
                $pronunciation: '/pronunciations/${fileId}.mp3',
                $raw: raw,
                $image: imageData,
            },
            (error, response) => {
                if (error) {
                    cb(error);
                } else {
                    console.log(response);
                    cb(null, response);
                }
            }
        );
    });

    workflow.emit('validateParams');
}

exports = module.exports = {
    get,
    find,
    set,
};
