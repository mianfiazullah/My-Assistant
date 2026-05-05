const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  page.on('pageerror', err => {
    console.log('PAGE ERROR STR:', err.toString());
    console.log('PAGE ERROR STACK:', err.stack);
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR TEXT:', msg.text());
    }
  });

  try {
    await page.goto('http://localhost:3000/');
    await new Promise(resolve => setTimeout(resolve, 5000));
  } catch (error) {
    console.log('GOTO ERROR:', error);
  } finally {
    await browser.close();
  }
})();
