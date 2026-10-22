// Renders short.html frame by frame into frames/ (jpeg), driven by window.render(t)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const fps = Number(process.argv[2] || 30);
  const only = process.argv[3]; // optional: single time for a preview still
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.resolve('short.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  if (only) {
    for (const t of only.split(',')) {
      await page.evaluate(t => render(t), Number(t));
      await page.screenshot({ path: `preview_${t}.png` });
    }
  } else {
    fs.mkdirSync('frames', { recursive: true });
    const total = await page.evaluate(() => window.TOTAL);
    const n = Math.round(total * fps);
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => render(t), i / fps);
      await page.screenshot({ path: `frames/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 });
    }
    console.log('frames', n, 'total', total);
  }
  await browser.close();
})();
