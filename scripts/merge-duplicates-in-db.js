//
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const db = require('../src/utils/db');
const eachSeries = require('async/eachSeries');
const waterfall = require('async/waterfall');

db.all(
    `SELECT * FROM dictionary;`,
    {},
    (dbErr, translations) => {
        if (dbErr) {
            console.error(dbErr);
        } else {
            const processedDuplicates = [];

            eachSeries(
                translations,
                (item, seriesCallback) => {
                    const duplicate = translations.find(translation => (
                        translation.word === item.word
                        && translation.created_at !== item.created_at
                    ))
                    if (duplicate && !processedDuplicates.includes(duplicate.word)) {
                        processedDuplicates.push(duplicate.word);
                        console.log(`"${duplicate.word}" has duplicate`);
                        const result = { ...item };

                        if (
                            (
                                item.image === ''
                                || !fs.existsSync(path.join(__dirname, '..', item.image))
                            )
                            && (
                                duplicate.image !== ''
                                && fs.existsSync(path.join(__dirname, '..', duplicate.image))
                            )
                        ) {
                            result.image = duplicate.image;
                        }

                        if (
                            (
                                item.pronunciation === ''
                                || !fs.existsSync(path.join(__dirname, '..', item.pronunciation))
                            )
                            && (
                                duplicate.pronunciation !== ''
                                && fs.existsSync(path.join(__dirname, '..', duplicate.pronunciation))
                            )
                        ) {
                            result.pronunciation = duplicate.pronunciation;
                        }

                        waterfall([
                            (cb) => db.run(
                                `
                                    UPDATE dictionary
                                    SET image=$image, pronunciation=$pronunciation, updated_at=datetime('now')
                                    WHERE id=$id;
                                `,
                                {
                                    $id: result.id,
                                    $image: result.image,
                                    $pronunciation: result.pronunciation,
                                },
                                cb
                            ),
                            (cb) => db.run(
                                `DELETE FROM dictionary WHERE id=$id;`,
                                {
                                    $id: duplicate.id,
                                },
                                cb
                            ),
                        ], seriesCallback);
                    } else {
                        seriesCallback();
                    }
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
