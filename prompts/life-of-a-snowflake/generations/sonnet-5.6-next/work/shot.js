// Preview frames:  node shot.js <res> <outdir> t1 t2 t3 ...
const fs = require('fs');
const path = require('path');
const { startServer, openFilm } = require('./serve.js');
(async () => {
  const res = +process.argv[2];
  const out = path.resolve(__dirname, process.argv[3]);
  const times = process.argv.slice(4).map(Number);
  fs.mkdirSync(out, { recursive: true });
  const { server, port } = await startServer(async () => {});
  const t0 = Date.now();
  const { browser, page } = await openFilm(port, `?render=1&res=${res}`);
  try {
    await page.waitForFunction('window.__ready === true || window.__error', null, { timeout: 180000 });
    const err = await page.evaluate('window.__error || null');
    if (err) throw new Error(err);
    console.log('ready after', Date.now() - t0, 'ms', JSON.stringify(await page.evaluate('window.filmInfo')));
    for (const t of times) {
      const t1 = Date.now();
      const url = await page.evaluate((t) => { window.renderAt(t); return document.getElementById('view').toDataURL('image/png'); }, t);
      fs.writeFileSync(path.join(out, `t${t.toFixed(2).padStart(5, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
      console.log('t', t, (Date.now() - t1) + 'ms');
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
