//
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const controllers = require('./controllers/index');

exports = module.exports = (app) => {
    // settings
    app.use(bodyParser.urlencoded({
        extended: false,
    }));
    app.use(bodyParser.raw({
        type: 'application/yaml',
    }));
    app.use(bodyParser.json());
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        next();
    });

    // main page
    app.get('/', (req, res) => {
        res.sendFile(path.resolve(process.cwd() + '/public/index.html'));
    });

    // public
    app.use(express.static(process.cwd() + '/public'));
    app.use('/images', express.static(process.cwd() + '/images'));
    app.use('/pronunciations', express.static(process.cwd() + '/pronunciations'));

    // translation
    app.get('/translate', controllers.translate.get);
    app.get('/image', controllers.images.get);
};
