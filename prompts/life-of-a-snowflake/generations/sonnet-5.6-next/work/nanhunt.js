// scans the HDR buffers for NaN / Inf pixels across the film
//   node nanhunt.js [step-in-frames]
const { startServer, openFilm } = require('./serve.js');
(async () => {
  const every = +(process.argv[2] || 3);
  const { server, port } = await startServer(async () => {});
  const { browser, page } = await openFilm(port, '?render=1&res=2160', false);
  await page.waitForFunction('window.__ready === true || window.__error', null, { timeout: 180000 });
  const found = [];
  let scanned = 0;
  for (let base = 0; base < 600; base += 60) {
    const part = await page.evaluate(([base, every]) => {
      const d = window.__dbg, out = [];
      const buf = new Uint16Array(2160 * 2160 * 4);
      let n = 0;
      for (let f = base; f < base + 60; f += every) {
        window.renderAt(f / 30); n++;
        for (const [name, rt] of [['opaque', d.opaqueRT], ['scene', d.sceneRT], ['dofOut', d.post.out]]) {
          d.renderer.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, buf);
          let bad = 0, first = null;
          const len = rt.width * rt.height * 4;
          for (let i = 0; i < len; i += 4) {
            // non-finite, or negative by more than rounding noise (below -2^-6)
            const wrong = (h) => (h & 0x7c00) === 0x7c00 || (h >= 0x8000 && (h & 0x7fff) > 0x2400);
            if (wrong(buf[i]) || wrong(buf[i + 1]) || wrong(buf[i + 2])) {
              bad++; if (!first) first = [(i / 4) % rt.width, rt.height - 1 - Math.floor(i / 4 / rt.width)];
            }
          }
          if (bad) { out.push({ frame: f, t: +(f / 30).toFixed(2), buffer: name, bad, first }); break; }
        }
      }
      return { out, n };
    }, [base, every]);
    scanned += part.n;
    found.push(...part.out);
  }
  console.log('frames scanned', scanned, ' frames with non-finite or negative pixels', found.length);
  for (const r of found.slice(0, 60)) console.log(JSON.stringify(r));
  await browser.close();
  server.close();
})();
