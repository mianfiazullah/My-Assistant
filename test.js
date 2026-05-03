import { JSDOM } from 'jsdom';

(async () => {
  const html = await fetch('https://mianfiazullah.github.io/My-Assistant/').then(r => r.text());
  
  const dom = new JSDOM(html, { 
    runScripts: 'dangerously', 
    resources: 'usable',
    url: 'https://mianfiazullah.github.io/My-Assistant/'
  });

  dom.window.addEventListener('error', (event) => {
    console.error('PAGE ERROR:', event.error);
  });

  dom.window.console.log = (...args) => console.log('PAGE LOG:', ...args);
  dom.window.console.error = (...args) => console.log('PAGE CONSOLE ERROR:', ...args);

  await new Promise(r => setTimeout(r, 6000));
})();
