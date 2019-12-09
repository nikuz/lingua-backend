//
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const eachSeries = require('async/eachSeries');
const db = require('../src/utils/db');
const randomWords = require('../database/random-words');

const uniqueWords = [];

eachSeries(
    randomWords,
    (word, callback) => {
        // console.log('Process word:', word);
        db.get(
            'SELECT * FROM dictionary WHERE word=$word;',
            {
                $word: word,
            },
            (err, res) => {
                if (err) {
                    callback(err);
                } else {
                    if (!res) {
                        uniqueWords.push(word);
                    } else {
                        // console.log('Duplicate word:', word);
                    }
                    callback(null, null);
                }
            }
        );
    },
    (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log('Duplicates:', randomWords.length - uniqueWords.length);
            console.log('New unique words:', uniqueWords.length);
            fs.writeFileSync(
                path.resolve(__dirname, '../database/random-words.json'),
                JSON.stringify(uniqueWords, null, 2)
            );
            console.log('Done!');
        }
    }
);
