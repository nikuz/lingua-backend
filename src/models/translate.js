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
            (error, res) => {
                if (error) {
                    cb(error);
                } else if (res) {
                    const response = {
                        ...res,
                        raw: JSON.parse(res.raw),
                    };
                    cb(null, response);
                } else {
                    cb(null, null);
                }
            }
        );
    });

    workflow.emit('validateParams');
}

function search(options, callback) {
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
        db.all(
            'SELECT * FROM dictionary WHERE word LIKE $pattern ORDER BY created_at DESC;',
            {
                $pattern: `%${wordPart}%`,
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

function pronunciationSave(options, callback) {
    const workflow = new EventEmitter();
    const cb = callback || _.noop;
    const {
        word,
        pronunciationURL,
    } = options;
    const pronunciationsPath = commonUtils.getPronunciationsPath();
    let fileId;

    workflow.on('validateParams', () => {
        validator.check({
            word: ['string', word],
            pronunciationURL: ['string', pronunciationURL],
        }, (err) => {
            if (err) {
                cb(err);
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
            workflow.emit('savePronunciations');
        }
    });

    workflow.on('savePronunciations', () => {
        let httpGet = http.get;
        if (pronunciationURL.indexOf('https') === 0) {
            httpGet = https.get;
        }

        const pronunciationsFile = commonUtils.getPronunciationFilePath(pronunciationsPath, fileId);
        const pronunciationsFileStream = fs.createWriteStream(pronunciationsFile);
        const request = httpGet(pronunciationURL, (response) => {
            if (response.statusCode !== 200) {
                cb(`Image downloading status code is ${response.statusCode}`);
            } else {
                response.pipe(pronunciationsFileStream);
            }
        });

        request.on('error', (err) => {
            cb(err.message);
        });

        pronunciationsFileStream.on('error', (err) => {
            cb(err.message);
        });

        pronunciationsFileStream.on('finish', () => {
            pronunciationsFileStream.close(() => {
                cb(null, `/pronunciations/${fileId}.mp3`);
            })
        });
    });

    workflow.emit('validateParams');
}

function pronunciationRemove(options, callback) {
    const workflow = new EventEmitter();
    const cb = callback || _.noop;
    const { word } = options;
    const pronunciationsPath = commonUtils.getPronunciationsPath();
    let fileId;

    workflow.on('validateParams', () => {
        validator.check({
            word: ['string', word],
        }, (err) => {
            if (err) {
                cb(err);
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
            workflow.emit('removePronunciations');
        }
    });

    workflow.on('removePronunciations', () => {
        const pronunciationsFile = commonUtils.getPronunciationFilePath(pronunciationsPath, fileId);
        if (fs.existsSync(pronunciationsFile)) {
            fs.unlink(pronunciationsFile, cb);
        } else {
            cb();
        }
    });

    workflow.emit('validateParams');
}

function save(options, callback) {
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
                workflow.emit('fillDatabase');
            }
        } else {
            workflow.emit('fillDatabase');
        }
    });

    workflow.on('fillDatabase', () => {
        const imageUrl = imageExtension ? `/images/${fileId}.${imageExtension}` : '';
        db.run(
            `
                INSERT INTO dictionary (word, translation, pronunciation, raw, image)
                VALUES($word, $translation, $pronunciation, $raw, $image);
            `,
            {
                $word: word,
                $translation: translation,
                $pronunciation: pronunciationURL,
                $raw: raw,
                $image: imageUrl,
            },
            (error) => {
                if (error) {
                    cb(error);
                } else {
                    get({ word }, cb);
                }
            }
        );
    });

    workflow.emit('validateParams');
}

function update(options, callback) {
    const workflow = new EventEmitter();
    const cb = callback || _.noop;
    const {
        word,
        translation,
    } = options;

    workflow.on('validateParams', () => {
        validator.check({
            word: ['string', word],
            translation: ['string', translation],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('checkExiting');
            }
        });
    });

    workflow.on('checkExiting', () => {
        get({ word }, (err, response) => {
            if (err) {
                cb(err);
            } else if (!response) {
                cb('Word doesn\'t exists in database')
            } else {
                workflow.emit('updateDatabase');
            }
        });
    });

    workflow.on('updateDatabase', () => {
        db.run(
            `
                UPDATE dictionary
                SET translation=$translation
                WHERE word=$word;
            `,
            {
                $word: word,
                $translation: translation,
            },
            (error) => {
                if (error) {
                    cb(error);
                } else {
                    get({ word }, cb);
                }
            }
        );
    });

    workflow.emit('validateParams');
}

function deleteTranslation(options, callback) {
    const workflow = new EventEmitter();
    const cb = callback || _.noop;
    const { id } = options;
    let translation;

    workflow.on('validateParams', () => {
        validator.check({
            id: ['string', id],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('checkExiting');
            }
        });
    });

    workflow.on('checkExiting', () => {
        db.get(
            'SELECT * FROM dictionary WHERE id=$id;',
            {
                $id: id,
            },
            (error, res) => {
                if (error) {
                    cb(error);
                } else if (!res) {
                    cb('Translation doesn\'t exists');
                } else {
                    translation = res;
                    workflow.emit('deletePronunciation');
                }
            }
        );
    });

    workflow.on('deletePronunciation', () => {
        pronunciationRemove({ word: translation.word }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('deleteImage');
            }
        });
    });

    workflow.on('deleteImage', () => {
        const fileId = commonUtils.getFileId(translation.word);
        if (!fileId.length) {
            cb('Can\'t create file id from word');
        } else {
            const imagesPath = commonUtils.getImagesPath();
            let imageExtension = translation.image.match(/\.(.+)$/);
            if (!imageExtension) {
                imageExtension = 'jpeg';
            } else {
                imageExtension = imageExtension[1];
            }

            const imageFile = `${imagesPath}/${fileId}.${imageExtension}`;

            if (fs.existsSync(imageFile)) {
                fs.unlink(imageFile, (err) => {
                    if (err) {
                        cb(err);
                    } else {
                        workflow.emit('deleteDbBRow');
                    }
                });
            } else {
                workflow.emit('deleteDbBRow');
            }
        }
    });

    workflow.on('deleteDbBRow', () => {
        db.run(
            `DELETE FROM dictionary WHERE id=$id;`,
            {
                $id: id,
            },
            (error) => {
                if (error) {
                    cb(error);
                } else {
                    cb();
                }
            }
        );
    });

    workflow.emit('validateParams');
}

function getList(options, callback) {
    const workflow = new EventEmitter();
    const cb = callback || _.noop;
    const {
        from,
        to,
    } = options;

    workflow.on('validateParams', () => {
        validator.check({
            from: ['number', from],
            to: ['number', to],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('getList');
            }
        });
    });

    workflow.on('getList', () => {
        db.all(
            `
                SELECT * FROM dictionary
                ORDER BY created_at DESC
                LIMIT $limit OFFSET $offset;
            `,
            {
                $limit: to - from,
                $offset: from,
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

function getTotalAmount(options, callback) {
    const cb = callback || _.noop;
    const columnName = 'COUNT(id)';

    db.all(
        `SELECT ${columnName} FROM dictionary;`,
        {},
        (error, response) => {
            if (error) {
                cb(error);
            } else {
                cb(null, response[0][columnName]);
            }
        }
    );
}

exports = module.exports = {
    get,
    search,
    pronunciationSave,
    pronunciationRemove,
    save,
    update,
    deleteTranslation,
    getList,
    getTotalAmount,
};
