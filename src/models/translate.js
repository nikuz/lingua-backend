//
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events').EventEmitter;
const _ = require('underscore');
const asyncParallel = require('async/parallel');
const validator = require('../utils/validator');
const commonUtils = require('../utils/common');
const db = require('../utils/db');
const randomWords = require('../../database/random-words');

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
    const {
        wordPart,
        from,
        to,
    } = options;

    workflow.on('validateParams', () => {
        validator.check({
            wordPart: ['string', wordPart],
            from: ['number', from],
            to: ['number', to],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('search');
            }
        });
    });

    workflow.on('search', () => {
        asyncParallel([
            (callback) => {
                db.all(
                    `
                        SELECT id, word, pronunciation, translation, image, created_at, updated_at 
                        FROM dictionary 
                        WHERE 
                            word LIKE $pattern 
                            OR translation LIKE $pattern 
                        ORDER BY
                            CASE
                                WHEN word LIKE $word THEN 1
                                WHEN translation LIKE $word THEN 1
                                WHEN word LIKE $patternEnd THEN 2
                                WHEN translation LIKE $patternEnd THEN 2
                                WHEN word LIKE $patternStart THEN 3
                                WHEN translation LIKE $patternStart THEN 3
                                ELSE 4
                            END,
                            word ASC,
                            created_at DESC
                        LIMIT $limit OFFSET $offset;
                    `,
                    {
                        $word: wordPart,
                        $pattern: `%${wordPart}%`,
                        $patternStart: `%${wordPart}`,
                        $patternEnd: `${wordPart}%`,
                        $limit: to - from,
                        $offset: from,
                    },
                    callback
                );
            },
            (callback) => {
                const columnName = 'COUNT(id)';
                db.get(
                    `
                    SELECT ${columnName} 
                    FROM dictionary 
                    WHERE
                        word LIKE $pattern 
                        OR translation LIKE $pattern;
                    `,
                    {
                        $pattern: `%${wordPart}%`,
                    },
                    (error, response) => {
                        if (error) {
                            callback(error);
                        } else {
                            callback(null, response[columnName]);
                        }
                    }
                );
            },
        ], cb);
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

// this function is needed because we store pronunciation mp3 file for every search translation before we actually store
// a word to the database, and if user decided to not store the word and just close the translation window,
// we wipe the temporary pronunciation file
function pronunciationRemove(options, callback) {
    const workflow = new EventEmitter();
    const cb = callback || _.noop;
    const { word, force } = options;
    const pronunciationsPath = commonUtils.getPronunciationsPath();
    let fileId;

    workflow.on('validateParams', () => {
        validator.check({
            word: ['string', word],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                if (force) {
                    workflow.emit('getFileId');
                } else {
                    workflow.emit('checkAlreadyExists');
                }
            }
        });
    });

    // we have to check if word was already saved into database by another user in parallel
    workflow.on('checkAlreadyExists', () => {
        get({ word }, (err, response) => {
            if (err) {
                cb(err);
            } else if (response) {
                cb('Can\'t remove pronunciation for word saved in database')
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

function imageSave({ image, fileId }, callback) {
    const imagesPath = commonUtils.getImagesPath();
    const base64Reg = /^data:image\/(jpeg|png|jpg);base64,(.+)$/;
    let imageData = image.match(base64Reg);
    if (!imageData) {
        callback('Image is not in base64 format');
    } else {
        const imageExtension = imageData[1];
        fs.writeFileSync(`${imagesPath}/${fileId}.${imageExtension}`, imageData[2], 'base64');
        callback(null, imageExtension);
    }
}

function imageRemove({ word, image }, callback) {
    const fileId = commonUtils.getFileId(word);
    if (!fileId.length) {
        callback('Can\'t create file id from word');
    } else {
        const imagesPath = commonUtils.getImagesPath();
        let extension = image.match(/\.(.+)$/);
        if (!extension) {
            extension = 'jpeg';
        } else {
            extension = extension[1];
        }

        const imageFile = `${imagesPath}/${fileId}.${extension}`;

        if (fs.existsSync(imageFile)) {
            fs.unlink(imageFile, (err) => {
                if (err) {
                    callback(err);
                } else {
                    callback(null, null);
                }
            });
        } else {
            callback(null, null);
        }
    }
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
            imageSave({image, fileId}, (err, response) => {
                if (err) {
                    cb(err);
                } else {
                    imageExtension = response;
                    workflow.emit('fillDatabase');
                }
            });
        } else {
            workflow.emit('fillDatabase');
        }
    });

    workflow.on('fillDatabase', () => {
        const imageUrl = imageExtension ? `/images/${fileId}.${imageExtension}` : '';
        db.run(
            `
                INSERT INTO dictionary (word, translation, pronunciation, raw, image, updated_at)
                VALUES($word, $translation, $pronunciation, $raw, $image, datetime('now'));
            `,
            {
                $word: word.toLowerCase(),
                $translation: translation.toLowerCase(),
                $pronunciation: pronunciationURL,
                $raw: raw,
                $image: imageUrl,
            },
            (error) => {
                if (error) {
                    cb(error);
                } else {
                    workflow.emit('checkRandomWordDuplicate');
                }
            }
        );
    });

    workflow.on('checkRandomWordDuplicate', () => {
        const randomWordsDuplicateIndex = randomWords.findIndex(item => item === word);
        if (randomWordsDuplicateIndex !== -1) {
            randomWords.splice(randomWordsDuplicateIndex, 1);
            fs.writeFileSync(
                path.resolve(__dirname, '../../database/random-words.json'),
                JSON.stringify(randomWords, null, 2)
            );
        }

        get({ word }, cb);
    });

    workflow.emit('validateParams');
}

function update(options, callback) {
    const workflow = new EventEmitter();
    const cb = callback || _.noop;
    const {
        word,
        translation,
        image,
    } = options;
    let translationData;
    let fileId;
    let imageExtension;

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
                translationData = response;
                workflow.emit('getFileId');
            }
        });
    });

    workflow.on('getFileId', () => {
        fileId = commonUtils.getFileId(word);
        if (!fileId.length) {
            cb('Can\'t create file id from word');
        } else {
            workflow.emit('deleteOldImage');
        }
    });

    workflow.on('deleteOldImage', () => {
        if (image) {
            imageRemove({
                word: translationData.word,
                image: translationData.image,
            }, err => {
                if (err) {
                    cb(err);
                } else {
                    workflow.emit('saveNewImage');
                }
            });
        } else {
            workflow.emit('saveNewImage');
        }
    });

    workflow.on('saveNewImage', () => {
        if (image) {
            imageSave({image, fileId}, (err, response) => {
                if (err) {
                    cb(err);
                } else {
                    imageExtension = response;
                    workflow.emit('updateDatabase');
                }
            });
        } else {
            workflow.emit('updateDatabase');
        }
    });

    workflow.on('updateDatabase', () => {
        let imageTransaction = '';
        if (image) {
            imageTransaction = ', image=$image';
        }
        const imageUrl = imageExtension ? `/images/${fileId}.${imageExtension}` : '';

        db.run(
            `
                UPDATE dictionary
                SET translation=$translation, updated_at=datetime('now') ${imageTransaction}
                WHERE word=$word;
            `,
            {
                $word: word,
                $translation: translation.toLowerCase(),
                $image: imageExtension ? imageUrl : undefined,
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
        pronunciationRemove({ word: translation.word, force: true }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('deleteImage');
            }
        });
    });

    workflow.on('deleteImage', () => {
        imageRemove({
            word: translation.word,
            image: translation.image,
        }, err => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('deleteDbBRow');
            }
        });
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

function getTotalAmount(options, callback) {
    const cb = callback || _.noop;
    const columnName = 'COUNT(id)';

    db.get(
        `SELECT ${columnName} FROM dictionary;`,
        {},
        (error, response) => {
            if (error) {
                cb(error);
            } else {
                cb(null, response[columnName]);
            }
        }
    );
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
        asyncParallel([
            (callback) => {
                db.all(
                    `
                    SELECT id, word, pronunciation, translation, image, created_at, updated_at
                    FROM dictionary
                    ORDER BY created_at DESC
                    LIMIT $limit OFFSET $offset;
                `,
                    {
                        $limit: to - from,
                        $offset: from,
                    },
                    callback
                );
            },
            (callback) => getTotalAmount({}, callback),
        ], cb);
    });

    workflow.emit('validateParams');
}

function getListItem(options, callback) {
    const workflow = new EventEmitter();
    const cb = callback || _.noop;
    const { id } = options;

    workflow.on('validateParams', () => {
        validator.check({
            id: ['number', id],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('getListItem');
            }
        });
    });

    workflow.on('getListItem', () => {
        db.all(
            `
                SELECT id, word, pronunciation, translation, image, created_at, updated_at
                FROM dictionary
                WHERE id=$id
            `,
            {
                $id: id,
            },
            (error, response) => {
                if (error) {
                    cb(error);
                } else {
                    cb(null, response[0]);
                }
            }
        );
    });

    workflow.emit('validateParams');
}

function getRandomWord(options, callback) {
    const cb = callback || _.noop;

    cb(null, randomWords[Math.floor(Math.random() * randomWords.length)]);
}

function deleteRandomWord(options, callback) {
    const workflow = new EventEmitter();
    const cb = callback || _.noop;
    const { word } = options;

    workflow.on('validateParams', () => {
        validator.check({
            word: ['string', word],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('deleteRandomWord');
            }
        });
    });

    workflow.on('deleteRandomWord', () => {
        const wordIndex = randomWords.findIndex(item => item === word);
        if (wordIndex !== -1) {
            randomWords.splice(wordIndex, 1);
            workflow.emit('saveRandomWords');
        } else {
            cb('Word doesn\'t exists');
        }
    });

    workflow.on('saveRandomWords', () => {
        fs.writeFileSync(
            path.resolve(__dirname, '../../database/random-words.json'),
            JSON.stringify(randomWords, null, 2)
        );
        cb(null, null);
    });

    workflow.emit('validateParams');
}

exports = module.exports = {
    get,
    search,
    pronunciationSave,
    pronunciationRemove,
    save,
    update,
    deleteTranslation,
    getTotalAmount,
    getList,
    getListItem,
    getRandomWord,
    deleteRandomWord,
};
