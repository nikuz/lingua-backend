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
        res.sendFile(path.resolve(__dirname + '/../public/index.html'));
    });

    // public
    app.use(express.static(path.resolve(__dirname + '/../public')));
    app.use('/images', express.static(path.resolve(__dirname + '/images')));
    app.use('/pronunciations', express.static(path.resolve(__dirname + '/pronunciations')));

    // translation
    app.get('/translate', controllers.translate.get);
    app.get('/image', controllers.images.get);
};
