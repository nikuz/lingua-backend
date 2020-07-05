//
/* eslint-disable no-console */
const eachSeries = require('async/eachSeries');
const waterfall = require('async/waterfall');
const db = require('../src/utils/db');

db.run(`CREATE TABLE IF NOT EXISTS 'dictionary-new' (
    'id' INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    'word' VARCHAR NOT NULL COLLATE NOCASE,
    'pronunciation' VARCHAR,
    'translation' VARCHAR COLLATE NOCASE,
    'raw' TEXT NOT NULL,
    'image' VARCHAR,
    'created_at' TEXT DEFAULT CURRENT_TIMESTAMP,
    'updated_at' TEXT DEFAULT CURRENT_TIMESTAMP
)`);

db.all(
    `SELECT * FROM dictionary;`,
    {},
    (dbErr, translations) => {
        if (dbErr) {
            console.error(dbErr);
        } else {
            waterfall([
                (callback) => eachSeries(
                    translations,
                    (item, seriesCallback) => db.run(
                        `
                            INSERT INTO 'dictionary-new' (word, translation, pronunciation, raw, image, created_at, updated_at)
                            VALUES($word, $translation, $pronunciation, $raw, $image, datetime($createdAt), datetime($updatedAt));
                        `,
                        {
                            $word: item.word,
                            $translation: item.translation,
                            $pronunciation: item.pronunciation,
                            $raw: item.raw,
                            $image: item.image,
                            $createdAt: item.created_at,
                            $updatedAt: item.updated_at,
                        },
                        seriesCallback
                    ),
                    callback
                ),
                (callback) => db.run(
                    `DROP TABLE dictionary;`,
                    {},
                    callback
                ),
                (callback) => db.run(
                    `ALTER TABLE 'dictionary-new' RENAME TO dictionary;`,
                    {},
                    callback
                ),
            ], (err) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log('Done!');
                }
            });
        }
    }
);
