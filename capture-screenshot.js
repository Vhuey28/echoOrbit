#!/usr/bin/env node
/* Optional dev tool: load every screen in headless Chrome, screenshot it
   and report console errors.

   The original version hardcoded one absolute path on a single laptop, so
   it could not run anywhere else. It now serves the project itself and
   writes into ./screenshots (gitignored).

   Requires the optional puppeteer dev dependency:
     npm install --no-save puppeteer
     npx puppeteer browsers install chrome
   Then:  node capture-screenshot.js [--mobile]
*/

const path = require('path');
const fs = require('fs');

const OUT_DIR = process.env.SCREENSHOT_DIR || path.join(__dirname, 'screenshots');
const PAGES = [
  '/index.html',
  '/echoorbit-path.html',
  '/echoorbit-gameplay.html?unit=k1',
  '/echoorbit-sayit.html?unit=k1'
];

(async () => {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('puppeteer is not installed. Run:\n'
      + '  npm install --no-save puppeteer && npx puppeteer browsers install chrome');
    process.exit(1);
  }

  const { createServer } = require('./serve');
  const server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const mobile = process.argv.includes('--mobile');
  let errorCount = 0;

  for (const page of PAGES){
    const tab = await browser.newPage();
    await tab.setViewport(mobile
      ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { width: 1280, height: 900 });

    const errors = [];
    tab.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    tab.on('pageerror', err => errors.push(err.message));
    tab.on('requestfailed', req => errors.push('request failed: ' + req.url()));

    await tab.goto(base + page, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));   // let animations settle

    const name = page.replace(/[/?=&]/g, '_').replace(/^_+/, '') + (mobile ? '_mobile' : '');
    const file = path.join(OUT_DIR, name + '.png');
    await tab.screenshot({ path: file, fullPage: true });
    await tab.close();

    console.log((errors.length ? 'ERRORS ' : 'ok     ') + page + ' -> ' + path.relative(__dirname, file));
    errors.forEach(e => console.log('         ' + e));
    errorCount += errors.length;
  }

  await browser.close();
  server.close();
  console.log('\n' + (errorCount ? errorCount + ' console error(s)' : 'no console errors'));
  process.exit(errorCount ? 1 : 0);
})();
