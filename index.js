//
const express = require('express');
const path = require('path');
require('dotenv').config({
    path: path.join(__dirname, '/.env'),
});
const db = require('./src/utils/db');
const routes = require('./src/routes');

process.argv.forEach(function(val) {
    if (val === 'prod') {
        process.env.NODE_ENV = 'PROD';
    }
});

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'DEV';
}

console.log('Running %s server...', process.env.NODE_ENV);

db.initiate();

const app = express();
app.SERVER = process.env.SERVER_NAME;
app.PORT = process.env.PORT;

routes(app);

app.listen(app.PORT, function() {
    console.log(`${app.SERVER}:${app.PORT} - ${new Date()}`);
});
