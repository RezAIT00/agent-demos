// Drives the real game in Edge. Usage: node tools/play.mjs script.mjs [--w 1600 --h 900]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { serve, EDGE, GPU_ARGS } from './serve.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const { server, port } = await serve();
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: GPU_ARGS });
const context = await browser.newContext({ viewport: { width: +opt('w', 1600), height: +opt('h', 900) } });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/X3595|X4000/.test(t)) logs.push(`[${m.type()}] ${t.slice(0, 900)}`); });
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').slice(0, 900)));
const url = (q = 'test=1&preset=high') => `http://127.0.0.1:${port}/blockworld.html?${q}`;
const ready = async () => { await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: 120000 }); };
const run = (js) => page.evaluate(`(async()=>{ const A = window.__ashlar; const G = A.Game; const wait=(ms)=>new Promise(r=>setTimeout(r,ms)); ${js} })()`);
const shot = (n) => page.screenshot({ path: 'tools/' + n + '.png' });
const check = async () => { const e = await page.evaluate(() => window.__lastError || null); if (e) logs.push('[loop error] ' + e); };
try {
  const mod = await import(pathToFileURL(path.resolve(args[0])).href);
  await mod.default({ page, url, ready, run, shot, check, logs });
} catch (e) { console.log('SCRIPT ERROR', e.message.slice(0, 1500)); }
await check();
if (logs.length) console.log('--- browser log ---\n' + [...new Set(logs)].slice(0, 25).join('\n'));
await browser.close(); server.close();
