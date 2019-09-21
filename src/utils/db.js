//
const sqlite3 = require('sqlite3').verbose();
let db;

if (!db) {
    db = new sqlite3.Database('./database/dictionary');
}

function initiate() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS 'dictionary' (
            'id' INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            'word' VARCHAR NOT NULL,
            'pronunciation' VARCHAR NOT NULL,
            'translation' VARCHAR,
            'translation_raw' TEXT NOT NULL,
            'image' VARCHAR
        )`);
    });

    db.close();
}

function set(word, pronunciation, translation_raw, image) {
    db.serialize(() => {
        db.run(`
            INSERT INTO 'dictionary' ('word', 'pronunciation', 'translation_raw', 'image')
            VALUES('${word}', '${pronunciation}', '${translation_raw}', '${image}');
        `);
    });

    db.close();
}

function get(pattern) {
    db.serialize(() => {
        db.run(`
            SELECT *
            FROM 'dictionary'
            WHERE 'word' LIKE '%${pattern}%';
        `);
    });

    db.close();
}

exports = module.exports = {
    initiate,
    set,
    get,
};
