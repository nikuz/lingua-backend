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

function set(req, res) {
    const workflow = new EventEmitter();
    const body = req.body || {};
    const cb = commonUtils.getResponseCallback(res);
    const authorization = req.headers.authorization;

    workflow.on('validateParams', () => {
        validator.check({
            authorization: commonUtils.getApiKeyValidator(authorization),
            word: ['string', body.word],
            translation: ['string', body.translation],
            raw: ['string', body.raw],
            pronunciationURL: ['string', body.pronunciationURL],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('save');
            }
        });
    });

    workflow.on('save', async () => {

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

// ---------
// interface
// ---------

exports = module.exports = {
    get,
    set,
    removePronunciation,
};
