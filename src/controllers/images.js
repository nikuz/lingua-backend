//
const EventEmitter = require('events').EventEmitter;
const to = require('await-to-js').to;
const validator = require('../utils/validator');
const imageSeeker = require('../services/image');

// ----------------
// public functions
// ----------------

function get(req, res) {
    const workflow = new EventEmitter();
    const cb = (error, response) => {
        if (error) {
            res.send({
                error,
            });
        } else {
            res.send(response);
        }
    };
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
                workflow.emit('getImage');
            }
        });
    });

    workflow.on('getImage', async () => {
        const [err, translate] = await to(imageSeeker.get(request));
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
