// node tools/shot.mjs <out.png> "<query>" [--w 1280] [--h 720] [--wait ms] [--eval "js"] [--frames n]
import { chromium } from 'playwright-core';
import { serve, EDGE, GPU_ARGS } from './serve.mjs';
const args = process.argv.slice(2);
const out = args[0], query = args[1] || '';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const { server, port } = await serve();
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: GPU_ARGS });
const page = await browser.newPage({ viewport: { width: +opt('w', 1280), height: +opt('h', 720) }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { const t = m.text(); logs.push(`[${m.type()}] ${t.slice(0, 1500)}`); });
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').slice(0, 800)));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/blockworld.html?${query}`);
let ok = true;
try { await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: +opt('timeout', 90000) }); }
catch { ok = false; logs.push('[tool] timed out waiting for __ready'); }
const readyMs = Date.now() - t0;
const ev = opt('eval', '');
if (ok && ev) { const r = await page.evaluate(`(async()=>{ ${ev} })()`); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
await page.waitForTimeout(+opt('wait', 1500));
await page.screenshot({ path: out });
const info = await page.evaluate(() => (window.__stats ? window.__stats() : null)).catch(() => null);
console.log('ready in', readyMs, 'ms', info ? JSON.stringify(info) : '');
const errs = logs.filter((l) => !l.includes('[debug]'));
if (errs.length) console.log(errs.slice(0, 40).join('\n'));
await browser.close(); server.close();
