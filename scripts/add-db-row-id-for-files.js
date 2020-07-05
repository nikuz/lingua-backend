//
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const db = require('../src/utils/db');
const eachSeries = require('async/eachSeries');
const waterfall = require('async/waterfall');

const updateItem = (item, field, cb) => {
    const value = item[field];
    const name = path.basename(value);
    if (name === '') {
        return cb();
    }

    const newName = `${item.id}-${name}`;
    const newValue = value.replace(name, newName);

    const oldFileUrl = path.join(__dirname, '..', value);
    const newFileUrl = path.join(__dirname, '..', newValue);
    if (fs.existsSync(oldFileUrl)) {
        fs.renameSync(oldFileUrl, newFileUrl);
    }

    db.run(
        `
            UPDATE dictionary
            SET ${field}=$value
            WHERE id=$id;
        `,
        {
            $id: item.id,
            $value: newValue,
        },
        cb
    );
};

db.all(
    `SELECT * FROM dictionary;`,
    {},
    (dbErr, translations) => {
        if (dbErr) {
            console.error(dbErr);
        } else {
            eachSeries(
                translations,
                (item, seriesCallback) => {
                    waterfall([
                        (callback) => updateItem(item, 'pronunciation', callback),
                        (callback) => updateItem(item, 'image', callback),
                    ], seriesCallback);
                },
                (err) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('Done!');
                    }
                }
            );
        }
    }
);
