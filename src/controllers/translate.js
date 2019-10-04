//
const EventEmitter = require('events').EventEmitter;
const to = require('await-to-js').to;
const commonUtils = require('../utils/common');
const validator = require('../utils/validator');
const translatorService = require('../services/translate');
const translator = require('../models/translate');

// ----------------
// public functions
// ----------------

function get(req, res) {
    const workflow = new EventEmitter();
    const cb = commonUtils.getResponseCallback(res);
    const word = req.query.q;
    const authorization = req.headers.authorization;

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
            word: ['string', word, (internalCallback) => {
                if (/^[a-zA-Z -]+$/.test(word)) {
                    internalCallback();
                } else {
                    internalCallback('Request contains wrong symbols');
                }
            }],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('checkCache');
            }
        });
    });

    workflow.on('checkCache', async () => {
        translator.get({
            word,
        }, (err, response) => {
            if (err) {
                cb(err);
            } else if (response) {
                cb(null, response)
            } else {
                workflow.emit('translate');
            }
        });
    });

    workflow.on('translate', async () => {
        const [err, translate] = await to(translatorService.get(word));
        if (err) {
            cb(err);
        } else {
            let raw;
            let err;
            try {
                raw = JSON.parse(translate.raw);
            } catch (e) {
                err = e;
            } finally {
                if (err) {
                    cb(err);
                } else {
                    cb(null, {
                        word,
                        raw,
                        pronunciation: translate.pronunciationURL,
                    });
                }
            }
        }
    });

    workflow.emit('validateParams');
}

function search(req, res) {
    const workflow = new EventEmitter();
    const cb = commonUtils.getResponseCallback(res);
    const wordPart = req.query.q;
    const authorization = req.headers.authorization;

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
            wordPart: ['string', wordPart, (internalCallback) => {
                if (/^[a-zA-Z -]+$/.test(wordPart)) {
                    internalCallback();
                } else {
                    internalCallback('Request contains wrong symbols');
                }
            }],
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
        }, (err, response) => {
            if (err) {
                cb(err);
            } else {
                cb(null, {
                    from: 0,
                    to: response.length,
                    translations: response.map(item => ({
                        ...item,
                        raw: JSON.parse(item.raw),
                    })),
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
    } = body;

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
            word: ['string', word],
            translation: ['string', translation],
            raw: ['string', raw],
            pronunciationURL: ['string', pronunciationURL],
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
        translator.deleteTranslation({ id }, (err, response) => {
            if (err) {
                cb('Can\'t delete translation');
            } else {
                cb(null, response);
            }
        });
    });

    workflow.emit('validateParams');
}

function removePronunciation(req, res) {
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
                workflow.emit('removeFile');
            }
        });
    });

    workflow.on('removeFile', async () => {
        translator.pronunciationRemove({ word }, (err) => {
            if (err) {
                cb(`Can't remove pronunciation file for '${word}' word`);
            } else {
                cb();
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
                    translations: response.map(item => ({
                        ...item,
                        raw: JSON.parse(item.raw),
                    })),
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

// ---------
// interface
// ---------

exports = module.exports = {
    get,
    search,
    save,
    update,
    deleteTranslation,
    removePronunciation,
    getList,
    getTotalAmount,
};
