// opens snowflake.html straight from disk, as a viewer would, and checks it plays
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => logs.push('pageerror: ' + e));
  const url = pathToFileURL(path.join(__dirname, '..', 'snowflake.html')).href;
  const t0 = Date.now();
  await page.goto(url + '?t=0');
  await page.waitForFunction(() => document.getElementById('status').style.display === 'none' || window.__error, null, { timeout: 180000 });
  console.log('playing after', Date.now() - t0, 'ms; error:', await page.evaluate(() => window.__error || null));
  const shot = async (name) => { console.log(name, 'film time', await page.evaluate(() => +window.__filmTime.toFixed(2))); const b = await page.screenshot(); fs.writeFileSync(path.join(__dirname, name), b); return b; };
  await page.waitForTimeout(2500); const a = await shot('live_a.png');
  await page.waitForTimeout(1200); const b = await shot('live_b.png');
  console.log('picture changes while playing:', !a.equals(b));
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 4000) requestAnimationFrame(f); else res((n / ((performance.now() - s) / 1000)).toFixed(1)); }; requestAnimationFrame(f); }));
  console.log('live frame rate:', fps, 'fps');
  console.log(logs.filter((l) => !/toNonIndexed/.test(l)).slice(0, 12).join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
