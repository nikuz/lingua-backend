//
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const db = require('../src/utils/db');
const eachSeries = require('async/eachSeries');

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
                    const image = path.join(__dirname, '..', item.image);
                    if (item.image === '' || !fs.existsSync(image)) {
                        console.log(`"${item.word}" doesn't have image: ${item.image}`);
                    }

                    const pronunciation = path.join(__dirname, '..', item.pronunciation);
                    if (item.pronunciation === '' || !fs.existsSync(pronunciation)) {
                        console.log(`"${item.word}" doesn't have pronunciation: ${item.pronunciation}`);
                    }

                    seriesCallback();
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
