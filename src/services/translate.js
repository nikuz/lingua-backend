//
const url = require('url');
const to = require('await-to-js').to;
const browserService = require('./browser');

const defaultSourceLanguage = 'en';
const defaultTargetLanguage = 'ru';

function get(query, sourceLanguage, targetLanguage) {
    return new Promise(async (resolve, reject) => {
        const browser = await browserService.get();
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
                    await to(page.close());
                });
            }
        });

        page.on('error', async error => {
            requestError = error;
            await to(page.close());
        });

        page.on('close', () => {
            if (requestError) {
                reject({
                    error: requestError,
                });
            } else {
                resolve({
                    raw: rawResponse,
                    pronunciationURL,
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
            await to(page.close());
        }
    });
}

exports = module.exports = {
    get,
};
