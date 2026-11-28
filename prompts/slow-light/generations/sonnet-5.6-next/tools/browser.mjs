// Launch the machine's Chrome/Edge on the real GPU and open slow-light.html?render=1
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function openPage(query = '') {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter(p => p && fs.existsSync(p));
  const browser = await chromium.launch({
    executablePath: candidates[0], headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-watchdog', '--force_high_performance_gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { errors.push(m.text()); console.log('[page]', m.text().slice(0, 3000)); } });
  page.on('pageerror', e => { errors.push(String(e)); console.log('[pageerror]', String(e).slice(0, 3000)); });
  await page.goto(pathToFileURL(path.join(root, 'slow-light.html')).href + '?render=1' + (query ? '&' + query : ''));
  try { await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 }); }
  catch (e) { await browser.close(); throw new Error('page never became ready\n' + errors.slice(0, 6).join('\n').slice(0, 4000)); }
  const info = await page.evaluate(() => ({ gpu: window.gpuInfo, ...window.sceneInfo }));
  if (/swiftshader|software/i.test(info.gpu)) { await browser.close(); throw new Error('software WebGL: ' + info.gpu); }
  return { browser, page, info, errors, exe: candidates[0] };
}
