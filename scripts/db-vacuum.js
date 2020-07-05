//
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database(path.resolve(__dirname, 'dictionary.SQLITE3'));

db.serialize(() => {
    db.run(`VACUUM;`);
});
