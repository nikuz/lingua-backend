//
const puppeteer = require('puppeteer');
let browser;

async function get() {
    if (!browser) {
        browser = await puppeteer.launch();
    }
    return browser;
}

exports = module.exports = {
    get,
};
