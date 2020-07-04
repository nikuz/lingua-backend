//
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const db = require('../src/utils/db');
const eachSeries = require('async/eachSeries');
const waterfall = require('async/waterfall');

function getAllFiles(folder, all) {
    const files = fs.readdirSync(folder);
    let file, path, stat, i;

    for(i in files){
        file = files[i];
        path = folder + file;
        stat = fs.statSync(path);
        if(stat.isDirectory()){
            arguments.callee(path +'/', all);
        } else {
            all.push(path);
        }
    }

    return all;
}

const updateItem = (id, field, oldValue, newValue, cb) => {
    const oldFileUrl = path.join(__dirname, '..', oldValue);
    const newFileUrl = path.join(__dirname, '..', newValue);
    fs.renameSync(oldFileUrl, newFileUrl);

    db.run(
        `
            UPDATE dictionary
            SET ${field}=$value
            WHERE id=$id;
        `,
        {
            $id: id,
            $value: newValue,
        },
        cb
    );
};

const removeFiles = (type, translations) => {
    const reg = new RegExp(`^.+(\\/${type}s\\/.+$)`);
    const files = getAllFiles(path.join(__dirname, `../${type}s/`), []).map(item => ({
        url: item,
        [type]: item.replace(reg, '$1'),
    }));

    for (let i = 0, l = translations.length; i < l; i++) {
        const fileIndex = files.findIndex(file => file[type] === translations[i][type]);
        if (fileIndex !== -1) {
            files.splice(fileIndex, 1);
        } else {
            const lowerCaseFileIndex = files.findIndex(file => (
                file[type].toLowerCase() === translations[i][type]
            ));
            if (lowerCaseFileIndex !== -1) {
                const file = files[lowerCaseFileIndex];
                fs.renameSync(
                    file.url,
                    path.join(__dirname, '..', file[type].toLowerCase())
                );
            }
            files.splice(lowerCaseFileIndex, 1);
        }
    }

    for (let i = 0, l = files.length; i < l; i++) {
        fs.unlinkSync(files[i].url);
    }

    return files.length;
};

db.all(
    `SELECT * FROM dictionary;`,
    {},
    (dbErr, translations) => {
        if (dbErr) {
            console.error(dbErr);
        } else {
            const upperCaseReg = /[A-Z]/g;
            const apostropheReg = /'/g;
            const doubleDashReg = /--/g;
            let pronunciationsLowerCaseCounter = 0;
            let imagesLowerCaseCounter = 0;
            let pronunciationsApostrophesCounter = 0;
            let imagesApostrophesCounter = 0;
            let pronunciationsDoubleDashesCounter = 0;
            let imagesDoubleDashesCounter = 0;
            let pronunciationsRemoveCounter = 0;
            let imagesRemoveCounter = 0;

            waterfall([
                (callback) => eachSeries(
                    translations,
                    (item, seriesCallback) => {
                        const translation = item;
                        waterfall([
                            (cb) => { // lowercase pronunciation
                                if (upperCaseReg.test(path.basename(translation.pronunciation))) {
                                    pronunciationsLowerCaseCounter++;
                                    const oldPronunciation = translation.pronunciation;
                                    const newPronunciation = oldPronunciation.toLowerCase();
                                    translation.pronunciation = newPronunciation;
                                    updateItem(
                                        translation.id,
                                        'pronunciation',
                                        oldPronunciation,
                                        newPronunciation,
                                        cb
                                    );
                                } else {
                                    cb();
                                }
                            },
                            (cb) => { // lowercase image
                                if (upperCaseReg.test(path.basename(translation.image))) {
                                    imagesLowerCaseCounter++;
                                    const oldImage = translation.image;
                                    const newImage = oldImage.toLowerCase();
                                    translation.image = newImage;
                                    updateItem(
                                        translation.id,
                                        'image',
                                        oldImage,
                                        newImage,
                                        cb
                                    );
                                } else {
                                    cb();
                                }
                            },
                            (cb) => { // remove apostrophes at pronunciation
                                if (apostropheReg.test(path.basename(translation.pronunciation))) {
                                    pronunciationsApostrophesCounter++;
                                    const oldPronunciation = translation.pronunciation;
                                    const newPronunciation = oldPronunciation.replace(apostropheReg, '');
                                    translation.pronunciation = newPronunciation;
                                    updateItem(
                                        translation.id,
                                        'pronunciation',
                                        oldPronunciation,
                                        newPronunciation,
                                        cb
                                    );
                                } else {
                                    cb();
                                }
                            },
                            (cb) => { // remove apostrophes at image
                                if (apostropheReg.test(path.basename(translation.image))) {
                                    imagesApostrophesCounter++;
                                    const oldImage = translation.image;
                                    const newImage = oldImage.replace(apostropheReg, '');
                                    translation.image = newImage;
                                    updateItem(
                                        translation.id,
                                        'image',
                                        oldImage,
                                        newImage,
                                        cb
                                    );
                                } else {
                                    cb();
                                }
                            },
                            (cb) => { // double dash at pronunciation
                                if (doubleDashReg.test(path.basename(translation.pronunciation))) {
                                    pronunciationsDoubleDashesCounter++;
                                    const oldPronunciation = translation.pronunciation;
                                    const newPronunciation = oldPronunciation.replace(doubleDashReg, '');
                                    translation.pronunciation = newPronunciation;
                                    updateItem(
                                        translation.id,
                                        'pronunciation',
                                        oldPronunciation,
                                        newPronunciation,
                                        cb
                                    );
                                } else {
                                    cb();
                                }
                            },
                            (cb) => { // double dash at image
                                if (doubleDashReg.test(path.basename(translation.image))) {
                                    imagesDoubleDashesCounter++;
                                    const oldImage = translation.image;
                                    const newImage = oldImage.replace(doubleDashReg, '');
                                    translation.image = newImage;
                                    updateItem(
                                        translation.id,
                                        'image',
                                        oldImage,
                                        newImage,
                                        cb
                                    );
                                } else {
                                    cb();
                                }
                            },
                        ], seriesCallback);
                    },
                    callback
                ),
                (callback) => {
                    pronunciationsRemoveCounter = removeFiles('pronunciation', translations);
                    callback();
                },
                (callback) => {
                    imagesRemoveCounter = removeFiles('image', translations);
                    callback();
                },
            ], (err) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log('Lowercased pronunciations:', pronunciationsLowerCaseCounter);
                    console.log('Lowercased images:', imagesLowerCaseCounter);
                    console.log('Deapostrophed pronunciations:', pronunciationsApostrophesCounter);
                    console.log('Deapostrophed images:', imagesApostrophesCounter);
                    console.log('Dedoubledashing pronunciations:', pronunciationsDoubleDashesCounter);
                    console.log('Dedoubledashing images:', imagesDoubleDashesCounter);
                    console.log('Pronunciation removed:', pronunciationsRemoveCounter);
                    console.log('Images removed:', imagesRemoveCounter);
                    console.log('Done!');
                }
            });
        }
    }
);
