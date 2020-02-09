//
/* eslint-disable no-console */
const eachSeries = require('async/eachSeries');
const db = require('../src/utils/db');

db.all('SELECT id, word, translation FROM dictionary;', {}, (err, res) => {
    if (err) {
        console.error(err);
    } else {
        eachSeries(
            res,
            (item, callback) => {
                let capitalized = false;
                if (/[A-Z]/.test(item.word) || /[А-Я]/.test(item.translation)) {
                    capitalized = true;
                }

                if (capitalized) {
                    console.log(item);
                    db.run(
                        `
                            UPDATE dictionary
                            SET translation=$translation, word=$word
                            WHERE id=$id;
                        `,
                        {
                            $id: item.id,
                            $word: item.word.toLowerCase(),
                            $translation: item.translation.toLowerCase(),
                        },
                        callback
                    );
                } else {
                    callback(null, null);
                }
            },
            (err) => {
                if (err) {
                    console.error(err);
                } else {
                    console.log('Done!');
                }
            }
        );
    }
});
