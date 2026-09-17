const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const consoleErrors = [];
  const consoleLogs = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      consoleErrors.push(text);
    }
    consoleLogs.push({ type, text });
  });

  page.on('pageerror', error => {
    consoleErrors.push(error.message);
  });

  const filePath = 'file:///Users/vaughnhuey/Homework/code/echoOrbit/echoorbit-prototype.html';
  await page.goto(filePath, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait a bit for any async JS to execute
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Take screenshot
  await page.screenshot({ path: '/Users/vaughnhuey/Homework/code/echoOrbit/screenshot.png', fullPage: true });

  // Get viewport size
  const viewport = page.viewport();

  await browser.close();

  console.log('=== CONSOLE LOGS ===');
  consoleLogs.forEach(log => console.log(`[${log.type}] ${log.text}`));

  console.log('\n=== CONSOLE ERRORS ===');
  if (consoleErrors.length === 0) {
    console.log('No errors found');
  } else {
    consoleErrors.forEach(err => console.log(err));
  }

  console.log('\n=== VIEWPORT ===');
  console.log(viewport);
})();