//
const puppeteer = require('puppeteer');
let browser;

async function get() {
    if (!browser) {
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
    }
    return browser;
}

exports = module.exports = {
    get,
};
