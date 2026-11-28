// Same time in, same pixels out: different frame order, and a second browser session.
const crypto = require('crypto');
const { startServer, openFilm } = require('./serve.js');
const A = [1.7, 3.5, 8.35, 15.6, 18.15, 19.65];
const B = [19.65, 0.0, 8.35, 18.15, 1.7, 12.0, 15.6, 3.5];
(async () => {
  const store = new Map();
  let bad = 0, compared = 0;
  const { server, port } = await startServer(async () => {});
  for (const [name, order] of [['session 1, forward', A], ['session 1, shuffled', B], ['session 2, shuffled', B]]) {
    if (name.startsWith('session 2') || !global.view) {
      if (global.view) await global.view.browser.close();
      global.view = await openFilm(port, '?render=1&res=2160', false);
      await global.view.page.waitForFunction('window.__ready === true || window.__error', null, { timeout: 180000 });
    }
    for (const t of order) {
      const hash = await global.view.page.evaluate(async (t) => {
        window.renderAt(t);
        const d = await crypto.subtle.digest('SHA-1', window.grabFrame());
        return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }, t);
      if (store.has(t)) {
        compared++;
        if (store.get(t) !== hash) { bad++; console.log('DIFFERENT', name, t); }
      } else store.set(t, hash);
    }
    console.log(name, 'done');
  }
  console.log(JSON.stringify({ distinctTimes: store.size, comparisons: compared, mismatches: bad }));
  await global.view.browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
