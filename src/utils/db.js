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
            'word' VARCHAR NOT NULL COLLATE NOCASE,
            'pronunciation' VARCHAR,
            'translation' VARCHAR COLLATE NOCASE,
            'raw' TEXT NOT NULL,
            'image' VARCHAR,
            'created_at' TEXT DEFAULT CURRENT_TIMESTAMP,
            'updated_at' TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

function run(query, params, callback) {
    db.serialize(() => {
        db.run(query, params, callback);
    });
}

function get(query, params, callback) {
    db.get(query, params, callback);
}

function all(query, params, callback) {
    db.all(query, params, callback);
}

function close() {
    db.close();
}

exports = module.exports = {
    initiate,
    run,
    get,
    all,
    close,
};
