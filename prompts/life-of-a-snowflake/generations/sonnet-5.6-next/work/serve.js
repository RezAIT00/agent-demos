// Tiny local server + headless Chrome launcher shared by the preview and render scripts.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..');

function startServer(onFrame) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/frame') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        try { await onFrame(+url.searchParams.get('i'), Buffer.concat(chunks)); res.writeHead(200); res.end('ok'); }
        catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
      });
      return;
    }
    if (url.pathname === '/snowflake.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      fs.createReadStream(path.join(ROOT, 'snowflake.html')).pipe(res);
      return;
    }
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => {
    const tryListen = () => {
      const port = 40000 + Math.floor(Math.random() * 9999);
      server.once('error', tryListen);
      server.listen(port, '127.0.0.1', () => resolve({ server, port }));
    };
    tryListen();
  });
}

async function openFilm(port, query, log = true) {
  const browser = await chromium.launch({
    channel: 'msedge', headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-driver-bug-workarounds', '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning') errors.push(t); if (log && (m.type() === 'error' || m.type() === 'warning' || m.type() === 'log')) console.log('[page]', t.slice(0, 3000)); });
  page.on('pageerror', (e) => { errors.push(String(e)); console.log('[pageerror]', String(e).slice(0, 3000)); });
  await page.goto(`http://127.0.0.1:${port}/snowflake.html${query}`, { timeout: 150000, waitUntil: "domcontentloaded" });
  return { browser, page, errors };
}
module.exports = { startServer, openFilm, ROOT };
