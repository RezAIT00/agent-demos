export default async ({ page, url, ready, run }) => {
  await page.goto(url('test=1&preset=high&play=survival&seed=4242')); await ready();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 90000 });
  await page.waitForTimeout(15000);
  console.log(JSON.stringify(await run(`
    const w = G.world, count = {};
    const orig = w.pool.run.bind(w.pool);
    w.pool.run = (m, p, t) => { count[m.type] = (count[m.type] || 0) + 1; return orig(m, p, t); };
    let tU = 0, tL = 0, tF = 0, tPost = 0, n = 0;
    const a = w._updateLOD.bind(w); w._updateLOD = (...x) => { const t0 = performance.now(); a(...x); tL += performance.now() - t0; };
    const b = w.update.bind(w); w.update = (...x) => { const t0 = performance.now(); b(...x); tU += performance.now() - t0; n++; };
    for (let i = 0; i < 240; i++) await new Promise(r => requestAnimationFrame(r));
    w.pool.run = orig;
    return { count, perFrameUpdate: tU / n, perFrameLOD: tL / n, missing: w.missing, genInflight: w.genInflight, meshInflight: w.meshInflight, lodPending: w.lodPending, lodInflight: w.lodInflight, queue: w.pool.queue.length, farPending: w.farPending, chunks: w.chunks.size, lodA: w.lod[0].size, lodB: w.lod[1].size };
  `)));
};
