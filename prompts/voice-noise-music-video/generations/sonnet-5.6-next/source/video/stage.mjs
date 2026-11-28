// Opens the engine in headless Edge with the GPU switched on.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

export async function openStage() {
  const data = fs.readFileSync(path.join(here, '..', 'out', 'events.json'), 'utf8');
  fs.writeFileSync(path.join(here, 'data.js'), 'window.DATA=' + data + ';\n');
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: true, protocolTimeout: 600000,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force_high_performance_gpu',
      '--allow-file-access-from-files', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  const problems = [];
  page.on('pageerror', e => { problems.push(e.message); console.error('PAGE ERROR:', e.stack || e.message); });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text()); });
  await page.goto(pathToFileURL(path.join(here, 'index.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return { page, problems, close: () => browser.close() };
}
