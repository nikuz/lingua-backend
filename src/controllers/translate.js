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
    const request = req.query.q;

    workflow.on('validateParams', () => {
        validator.check({
            q: ['string', request, (internalCallback) => {
                if (/^[a-zA-Z -]+$/.test(request)) {
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
            word: request,
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
        const [err, translate] = await to(translatorService.get(request));
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
                        word: request,
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

    workflow.on('validateParams', () => {
        validator.check({
            key: ['string', body.key, (internalCallback) => {
                if (body.key === process.env.API_KEY) {
                    internalCallback();
                } else {
                    internalCallback('API key is wrong');
                }
            }],
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

// ---------
// interface
// ---------

exports = module.exports = {
    get,
    set,
};
