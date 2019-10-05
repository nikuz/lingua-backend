//
const EventEmitter = require('events').EventEmitter;
const to = require('await-to-js').to;
const validator = require('../utils/validator');
const commonUtils = require('../utils/common');
const imageSeeker = require('../services/image');

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
            word: ['string', word],
        }, (err) => {
            if (err) {
                cb(err);
            } else {
                workflow.emit('getImage');
            }
        });
    });

    workflow.on('getImage', async () => {
        const [err, translate] = await to(imageSeeker.get(word));
        if (err) {
            cb(err);
        } else {
            cb(null, translate);
        }
    });

    workflow.emit('validateParams');
}

// ---------
// interface
// ---------

exports = module.exports = {
    get,
};
