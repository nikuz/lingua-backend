//
const puppeteer = require('puppeteer');
const to = require('await-to-js').to;

function get(query) {
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
        let imageResponse;

        page.on('error', async (error) => {
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
                    image: imageResponse,
                });
            }
        });

        const requestUrl = process.env.IMAGE_URL.replace('{query}', query);
        let response;
        [requestError, response] = await to(page.goto(requestUrl));

        if (requestError || response.status() !== 200) {
            if (!requestError) {
                requestError = response.status();
            }
            await to(page.close());
        }

        await Promise.all([
            page.click("button[type=submit]"),
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
        ]);

        imageResponse = await page.$$eval('img', images => {
            let firstImageSrc;
            const reg = /^data:image\/(jpeg|png|jpg);base64,/;

            for (let i = 0; i < images.length; i++) {
                const src = images[i].getAttribute('src');
                if (reg.test(src)) {
                    firstImageSrc = src;
                    break;
                }
            }

            return firstImageSrc;
        });

        await to(page.close());
    });
}

exports = module.exports = {
    get,
};
