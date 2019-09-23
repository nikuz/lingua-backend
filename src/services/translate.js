//
const url = require('url');
const puppeteer = require('puppeteer');
const to = require('await-to-js').to;
const translate = require('../models/translate');

const defaultSourceLanguage = 'en';
const defaultTargetLanguage = 'ru';

function get(query, sourceLanguage, targetLanguage) {
    return new Promise(async (resolve, reject) => {
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
        await page.setViewport({
            width: 600,
            height: 600,
        });

        let requestError;
        let rawResponse;
        let pronunciationURL;

        page.on('response', response => {
            const responseUrl = url.parse(response.url(), true);
            const requestQuery = responseUrl.query;
            if (requestQuery.q === query) {
                if (requestQuery.tk) {
                    pronunciationURL = process.env.PRONUNCIATION_URL
                        .replace('{query}', query)
                        .replace('{queryLen}', query.length)
                        .replace('{tk}', requestQuery.tk);
                }

                response.text().then(async raw => {
                    rawResponse = raw;
                    await browser.close();
                });
            }
        });

        page.on('error', async error => {
            requestError = error;
            await browser.close();
        });

        browser.on('disconnected', () => {
            if (requestError && !rawResponse) {
                reject({
                    error: requestError,
                });
            } else {
                translate.savePronunciation({
                    word: query,
                    pronunciationURL,
                }, (err, value) => {
                    if (err) {
                        reject({
                            error: err,
                        });
                    } else {
                        resolve({
                            raw: rawResponse,
                            pronunciationURL: value,
                        });
                    }
                });
            }
        });


        const sourceLang = sourceLanguage || defaultSourceLanguage;
        const targetLang = targetLanguage || defaultTargetLanguage;
        const requestUrl = process.env.TRANSLATE_URL
            .replace('{sourceLang}', sourceLang)
            .replace('{targetLang}', targetLang)
            .replace('{query}', query);

        let response;
        [requestError, response] = await to(page.goto(requestUrl));
        if (requestError || response.status() !== 200) {
            if (!requestError) {
                requestError = response.status();
            }
            await browser.close();
        }
    });
}

exports = module.exports = {
    get,
};
