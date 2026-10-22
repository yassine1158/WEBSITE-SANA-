const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 800, height: 800 } });
  await p.goto('file://' + path.resolve('logo.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'njarbou_lik_logo.png' });
  await b.close();
})();
