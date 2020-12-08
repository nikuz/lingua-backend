const fs = require('fs');

const response = fs.readFileSync('./new-google-translate-protocol-response.txt').toString();

const lines = response.split('\n');

const translationMarker = 'MkEWBc';
const pronunciationMarker = 'jQ1olc';

let translation;
let pronunciation;

for (let i = 0, l = lines.length; i < l; i++) {
    if (lines[i].indexOf(translationMarker) !== -1) {
        translation = lines[i] + ']';
        break;
    }
    if (lines[i].indexOf(pronunciationMarker) !== -1) {
        pronunciation = lines[i] + ']';
        break;
    }
}

if (translation) {
    translation = JSON.parse(translation
        .replace(`[["wrb.fr","${translationMarker}","`, '[[')
        .replace(/\\"/g, '"')
        .replace(/\\\\u003cb\\\\u003e/g, '')
        .replace(/\\\\u003c\/b\\\\u003e/g, '')
        .replace(/\\\\u003ci\\\\u003e/g, '')
        .replace(/\\\\u003c\/i\\\\u003e/g, '')
        .replace(/\\n/g, '')
        .replace(/]]",/, ']],')
    );
    fs.writeFileSync(
        './new-google-translate-protocol-response-v2.json',
        JSON.stringify(translation[0][0], null, 2)
    );
}

if (pronunciation) {
    pronunciation = JSON.parse(pronunciation
        .replace(`[["wrb.fr","${pronunciationMarker}","`, '[[')
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '')
        .replace(/]",/, '],')
    );
    // console.log(pronunciation[0][0][0]);
}

