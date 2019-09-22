//
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
let db;

if (!db) {
    db = new sqlite3.Database(path.resolve(__dirname, '../../database/dictionary.SQLITE3'));
}

function initiate() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS dictionary (
            'id' INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            'word' VARCHAR NOT NULL,
            'pronunciation' VARCHAR NOT NULL,
            'translation' VARCHAR,
            'translation_raw' TEXT NOT NULL,
            'image' VARCHAR,
            'created_at' TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

function run(query, params, callback) {
    db.serialize(() => {
        db.run(query, params, callback);
    });
}

function get(query, params, callback) {
    db.serialize(() => {
        db.get(query, params, callback);
    });
}

function close() {
    db.close();
}

exports = module.exports = {
    initiate,
    get,
    run,
    close,
};
