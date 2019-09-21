//
const _ = require('underscore');
const async = require('async');
const constants = require('../constants')();

// ----------------
// public functions
// ----------------

function isString(value) {
    if (!_.isString(value)) {
        return false;
    } else {
        return value.trim().length > 0;
    }
}

function isNumber(value) {
    return _.isNumber(value);
}

function isEmail(value) {
    return /^[^@.]+@[^@.]+\.[^@.]+$/.test(value);
}

function isArray(value) {
    return _.isArray(value);
}

function isObject(value) {
    return _.isObject(value);
}

function isDate(value) {
    value = new Date(value);
    return value.getTime();
}

function isFunction(value) {
    return _.isFunction(value);
}

function isBoolean(value) {
    return _.isBoolean(value);
}

/*
 structure for checking item
 {
   item_name: [
     'type',
     value,
     additionalRule1,
     additionalRuleN
   ]
 }
 Additional rules is optional fields. It's should be functions as for async.series loop:
 function(callback) {
   // checking stuff
   callback(err);
 }

 All together:
 validator.check({
   field1: ['string', field1_value],
   field2: ['email', field2_value],
   field3: [
     'number',
     field3_value,
     function() {
        // additional checking stuff
     }
   ],
 }, function(err) {

 });
 */
function check(options, callback) {
    const opts = options || {};
    const cb = callback || _.noop;
    const errors = [];
    const typesToChecking = [
        'string',
        'number',
        'email',
        'array',
        'object',
        'date',
        'function',
        'boolean',
        'any',
    ];

    const items = _.map(opts, (item, key) => {
        return {
            options: item,
            key: key,
        };
    });

    async.each(items, (item, internalCallback) => {
        if (!item.options) {
            return internalCallback();
        }
        const type = item.options[0];
        const name = item.key;
        const value = item.options[1];
        const rules = item.options.splice(2, item.options.length - 1);
        let typeError;

        if (!_.isString(type) || !_.contains(typesToChecking, type)) {
            errors.push(constants.VALIDATOR_WRONG_TYPE(type));
            return internalCallback();
        }
        if (rules.length && !_.every(rules, _.isFunction)) {
            errors.push(constants.VALIDATOR_WRONG_OPTIONS_FORMAT(name));
            return internalCallback();
        }

        switch (type) {
            case 'string':
                if (!isString(value)) {
                    errors.push(constants.STRING_REQUIRED(name));
                    typeError = true;
                }
                break;
            case 'number':
                if (!isNumber(value)) {
                    errors.push(constants.NUMBER_REQUIRED(name));
                    typeError = true;
                }
                break;
            case 'email':
                if (!isEmail(value)) {
                    errors.push(constants.EMAIL_REQUIRED(name));
                    typeError = true;
                }
                break;
            case 'array':
                if (!isArray(value)) {
                    errors.push(constants.ARRAY_REQUIRED(name));
                    typeError = true;
                }
                break;
            case 'object':
                if (!isObject(value)) {
                    errors.push(constants.OBJECT_REQUIRED(name));
                    typeError = true;
                }
                break;
            case 'date':
                if (!isDate(value)) {
                    errors.push(constants.DATE_REQUIRED(name));
                    typeError = true;
                }
                break;
            case 'function':
                if (!isFunction(value)) {
                    errors.push(constants.FUNCTION_REQUIRED(name));
                    typeError = true;
                }
                break;
            case 'boolean':
                if (!isBoolean(value)) {
                    errors.push(constants.BOOLEAN_REQUIRED(name));
                    typeError = true;
                }
                break;
            case 'any':
                if (_.isUndefined(value)) {
                    errors.push(constants.REQUIRED(name));
                    typeError = true;
                }
                break;
        }
        if (!typeError && rules.length) {
            async.series(rules, (err) => {
                if (err) {
                    errors.push(err);
                }
                internalCallback();
            });
        } else {
            internalCallback();
        }
    }, () => {
        if (errors.length) {
            cb(errors);
        } else {
            cb();
        }
    });
}

// ---------
// interface
// ---------

exports = module.exports = {
    isString,
    isNumber,
    isEmail,
    isArray,
    isObject,
    isDate,
    check,
};
