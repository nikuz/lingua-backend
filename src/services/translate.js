//
const url = require('url');
const puppeteer = require('puppeteer');
const to = require('await-to-js').to;

const defaultSourceLanguage = 'en';
const defaultTargetLanguage = 'ru';
const translationMarker = 'MkEWBc';
const pronunciationMarker = 'jQ1olc';

const parseTranslation = (raw) => {
    const lines = raw.split('\n');
    let result = '';

    for (let i = 0, l = lines.length; i < l; i++) {
        if (lines[i].indexOf(translationMarker) !== -1) {
            result += lines[i];
            break;
        }
    }

    result = JSON.parse(result
        .replace(`[["wrb.fr","${translationMarker}","`, '[[')
        .replace(/\\"/g, '"')
        .replace(/\\\\u003cb\\\\u003e/g, '')
        .replace(/\\\\u003c\/b\\\\u003e/g, '')
        .replace(/\\\\u003ci\\\\u003e/g, '')
        .replace(/\\\\u003c\/i\\\\u003e/g, '')
        .replace(/\\n/g, '')
        .replace(/]]",/, ']],')
    );

    return JSON.stringify(result[0][0]);
};

const parsePronunciation = (raw) => {
    const lines = raw.split('\n');
    let result = '';

    for (let i = 0, l = lines.length; i < l; i++) {
        if (lines[i].indexOf(pronunciationMarker) !== -1) {
            result += lines[i];
            break;
        }
    }

    result = JSON.parse(result
        .replace(`[["wrb.fr","${pronunciationMarker}","`, '[[')
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '')
        .replace(/]",/, '],')
    );

    return `data:audio/mpeg;base64,${result[0][0][0]}`;
};

function get(query, sourceLanguage, targetLanguage) {
    return new Promise(async (resolve, reject) => {
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
        await page.setViewport({
            width: 1024,
            height: 768,
        });

        let requestError;
        let rawResponse;
        let pronunciationURL;
        let version = 1;

        page.on('response', response => {
            const responseUrl = url.parse(response.url(), true);
            const requestQuery = responseUrl.query;
            if (responseUrl.pathname.indexOf('batchexecute') !== -1) {
                response.text().then(async raw => {
                    if (raw.indexOf(translationMarker) !== -1) {
                        rawResponse = parseTranslation(raw);
                        await page.hover(`div[data-text="${query}"]`);
                        version = 2;
                    }
                    if (raw.indexOf(pronunciationMarker) !== -1) {
                        pronunciationURL = parsePronunciation(raw);
                        await to(browser.close());
                    }
                });
            } else if (requestQuery.q === query) {
                if (requestQuery.tk) {
                    pronunciationURL = process.env.PRONUNCIATION_URL
                        .replace('{query}', encodeURIComponent(query))
                        .replace('{queryLen}', query.length)
                        .replace('{tk}', requestQuery.tk);
                }

                response.text().then(async raw => {
                    rawResponse = raw;
                    await to(browser.close());
                });
            }
        });

        page.on('error', async error => {
            requestError = error;
            await to(browser.close());
        });

        browser.on('disconnected', () => {
            if (requestError && !rawResponse) {
                reject({
                    error: requestError,
                });
            } else {
                resolve({
                    raw: rawResponse,
                    pronunciationURL,
                    version,
                });
            }
        });


        const sourceLang = sourceLanguage || defaultSourceLanguage;
        const targetLang = targetLanguage || defaultTargetLanguage;
        const requestUrl = process.env.TRANSLATE_URL
            .replace('{sourceLang}', sourceLang)
            .replace('{targetLang}', targetLang)
            .replace('{query}', query);

        let requestResponse;
        [requestError, requestResponse] = await to(page.goto(requestUrl));
        if (requestError || (requestResponse && requestResponse.status() !== 200)) {
            if (!requestError) {
                requestError = requestResponse.status();
            }
            await to(browser.close());
        }
    });
}

exports = module.exports = {
    get,
};
