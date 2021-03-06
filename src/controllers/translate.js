//
const EventEmitter = require('events').EventEmitter;
const to = require('await-to-js').to;
const commonUtils = require('../utils/common');
const validator = require('../utils/validator');
const translatorService = require('../services/translate');
const translator = require('../models/translate');
const request = require('request').defaults({ encoding: null });

// ----------------
// public functions
// ----------------

function get(req, res) {
    const workflow = new EventEmitter();
    const cb = commonUtils.getResponseCallback(res);
    const word = commonUtils.trimMacQuotes(req.query.q);
    const authorization = req.headers.authorization;

    const getTranslation = (wordToFind) => {
        return new Promise(async (resolve, reject) => {
            let sourceLanguage = 'en';
            let targetLanguage = 'ru';
            const isCyrillicWord = /[а-яА-Я]/.test(wordToFind);

            if (isCyrillicWord) {
                sourceLanguage = 'ru';
                targetLanguage = 'en';
            }

            const [err, translate] = await to(
                translatorService.get(
                    wordToFind,
                    sourceLanguage,
                    targetLanguage
                )
            );

            if (err) {
                reject(err);
            } else {
                let raw;
                try {
                    raw = JSON.parse(translate.raw);
                } catch (e) {
                    return reject(e);
                }

                resolve({
                    isCyrillicWord,
                    translate,
                    raw,
                });
            }
        });
    };

    const checkCache = (wordToFind) => {
        return new Promise((resolve, reject) => {
            translator.get({
                word: wordToFind,
            }, (err, response) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(response)
                }
            });
        });
    };

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
            word: ['string', word],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('checkCache');
            }
        });
    });

    workflow.on('checkCache', async () => {
        const [err, cacheData] = await to(checkCache(word));
        if (err) {
            cb(err);
        } else if (cacheData) {
            cb(
                null,
                {
                    ...cacheData,
                    remote: true,
                }
            );
        } else {
            workflow.emit('translate');
        }
    });

    workflow.on('translate', async () => {
        const [err, translateData] = await to(getTranslation(word));

        if (err) {
            cb(err);
        } else {
            let { isCyrillicWord, translate, raw } = translateData;
            let version = translate.version;

            if (isCyrillicWord) {
                cb(null, {
                    word,
                    raw,
                    version,
                });
            } else {
                let correctedWord = word;
                let pronunciationURL = translate.pronunciationURL;

                if (version === 1 && raw[0] && raw[0][0] && raw[0][0][1]) {
                    correctedWord = raw[0][0][1];
                } else if (version === 2) {
                    const correctionData = raw[0][1];
                    if (correctionData && correctionData[0] && correctionData[0][0] && correctionData[0][0][1]) {
                        correctedWord = correctionData[0][0][1];
                    }
                }

                if (word !== correctedWord) { // spelling error
                    const [cacheErr, cacheData] = await to(checkCache(correctedWord));
                    if (cacheErr) {
                        return cb(cacheErr);
                    }
                    if (cacheData) {
                        return cb(
                            null,
                            {
                                ...cacheData,
                                remote: true,
                                corrected: true,
                            }
                        );
                    }

                    const [translateErr, fixedTranslateData] = await to(getTranslation(correctedWord));
                    if (translateErr) {
                        return cb(translateErr);
                    }
                    raw = fixedTranslateData.raw;
                    pronunciationURL = fixedTranslateData.translate.pronunciationURL;
                    version = fixedTranslateData.translate.version;
                }

                const result = {
                    word,
                    raw,
                    pronunciation: pronunciationURL,
                    remote: true,
                    version,
                };

                if (pronunciationURL.indexOf('http') !== -1) {
                    request.get(pronunciationURL, (error, response, body) => {
                        if (error || response.statusCode !== 200) {
                            return cb(error || new Error('Can\'t download pronunciation'));
                        }
                        if (response.statusCode === 200) {
                            const type = response.headers['content-type'];
                            const pronunciationBase64 = (
                                `data:${type};base64,${Buffer.from(body).toString('base64')}`
                            );

                            cb(null, {
                                ...result,
                                pronunciation: pronunciationBase64,
                            });
                        }
                    });
                } else {
                    cb(null, result);
                }
            }
        }
    });

    workflow.emit('validateParams');
}

function search(req, res) {
    const workflow = new EventEmitter();
    const cb = commonUtils.getResponseCallback(res);
    const wordPart = commonUtils.trimMacQuotes(req.query.q);
    const from = Number(req.query.from);
    const to = Number(req.query.to);
    const authorization = req.headers.authorization;

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
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

    workflow.on('search', async () => {
        translator.search({
            wordPart,
            from,
            to,
        }, (err, response) => {
            if (err) {
                cb(err);
            } else {
                cb(null, {
                    from,
                    to,
                    totalAmount: response[1],
                    translations: response[0],
                })
            }
        });
    });

    workflow.emit('validateParams');
}

function save(req, res) {
    const workflow = new EventEmitter();
    const body = req.body || {};
    const cb = commonUtils.getResponseCallback(res);
    const authorization = req.headers.authorization;
    const {
        word,
        translation,
        raw,
        pronunciationURL,
        image,
        version,
    } = body;

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
            word: ['string', word],
            translation: ['string', translation],
            raw: ['string', raw],
            pronunciationURL: ['string', pronunciationURL],
            version: ['string', version],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('save');
            }
        });
    });

    workflow.on('save', async () => {
        translator.save({
            word,
            translation,
            raw,
            pronunciationURL,
            image,
            version,
        }, (err, response) => {
            if (err) {
                cb('Can\'t save translation');
            } else {
                cb(null, response);
            }
        });
    });

    workflow.emit('validateParams');
}

function update(req, res) {
    const workflow = new EventEmitter();
    const body = req.body || {};
    const cb = commonUtils.getResponseCallback(res);
    const authorization = req.headers.authorization;
    const {
        word,
        translation,
        image,
    } = body;

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
            word: ['string', word],
            translation: ['string', translation],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('update');
            }
        });
    });

    workflow.on('update', async () => {
        translator.update({
            word,
            translation,
            image: image !== '' ? image : undefined,
        }, (err, response) => {
            if (err) {
                cb('Can\'t update translation');
            } else {
                cb(null, response);
            }
        });
    });

    workflow.emit('validateParams');
}

function deleteTranslation(req, res) {
    const workflow = new EventEmitter();
    const cb = commonUtils.getResponseCallback(res);
    const authorization = req.headers.authorization;
    const id = req.query.id;

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
            id: ['string', id],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('delete');
            }
        });
    });

    workflow.on('delete', async () => {
        translator.deleteTranslation({ id }, (err) => {
            if (err) {
                cb('Can\'t delete translation');
            } else {
                cb(null, {
                    success: true,
                });
            }
        });
    });

    workflow.emit('validateParams');
}

function getList(req, res) {
    const workflow = new EventEmitter();
    const cb = commonUtils.getResponseCallback(res);
    const authorization = req.headers.authorization;
    const from = Number(req.query.from);
    const to = Number(req.query.to);

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
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

    workflow.on('getList', async () => {
        translator.getList({ from, to }, (err, response) => {
            if (err) {
                cb(`Can't get list of translations`);
            } else {
                cb(null, {
                    from,
                    to,
                    totalAmount: response[1],
                    translations: response[0],
                });
            }
        });
    });

    workflow.emit('validateParams');
}

function getListItem(req, res) {
    const workflow = new EventEmitter();
    const cb = commonUtils.getResponseCallback(res);
    const authorization = req.headers.authorization;
    const id = Number(req.params.id);

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
            id: ['number', id],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('getListItem');
            }
        });
    });

    workflow.on('getListItem', async () => {
        translator.getListItem({ id }, (err, response) => {
            if (err) {
                cb(`Can't get list item`);
            } else {
                cb(null, {
                    item: response,
                });
            }
        });
    });

    workflow.emit('validateParams');
}

function getTotalAmount(req, res) {
    const workflow = new EventEmitter();
    const cb = commonUtils.getResponseCallback(res);
    const authorization = req.headers.authorization;

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('getAmount');
            }
        });
    });

    workflow.on('getAmount', async () => {
        translator.getTotalAmount({}, (err, response) => {
            if (err) {
                cb(`Can't get total amount of translations`);
            } else {
                cb(null, {
                    value: response,
                });
            }
        });
    });

    workflow.emit('validateParams');
}

function getRandomWord(req, res) {
    const workflow = new EventEmitter();
    const cb = commonUtils.getResponseCallback(res);
    const authorization = req.headers.authorization;

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('getRandomWord');
            }
        });
    });

    workflow.on('getRandomWord', () => {
        translator.getRandomWord({}, (err, word) => {
            if (err || !word) {
                cb(`Custom words doesn't available`);
            } else {
                cb(null, word);
            }
        });
    });

    workflow.emit('validateParams');
}

function deleteRandomWord(req, res) {
    const workflow = new EventEmitter();
    const cb = commonUtils.getResponseCallback(res);
    const authorization = req.headers.authorization;
    const word = req.query.q;

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
            word: ['string', word],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('deleteRandomWord');
            }
        });
    });

    workflow.on('deleteRandomWord', async () => {
        translator.deleteRandomWord({ word }, (err) => {
            if (err) {
                cb(`Can't delete random word`);
            } else {
                cb(null, null);
            }
        });
    });

    workflow.emit('validateParams');
}

// ---------
// interface
// ---------

exports = module.exports = {
    get,
    search,
    save,
    update,
    deleteTranslation,
    getList,
    getListItem,
    getTotalAmount,
    getRandomWord,
    deleteRandomWord,
};
