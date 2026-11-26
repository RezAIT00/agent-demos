// per-pass GPU timing using timer queries, wrapped around the pipeline from outside
export default async ({ page, url, ready, run, shot }) => {
  await page.goto(url('test=1&preset=' + (process.env.PRESET || 'high') + '&play=survival&seed=4242')); await ready();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 90000 });
  await page.waitForTimeout(7000);
  const result = await run(`
    const P = A.Pipeline, gl = A.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const sums = {}, counts = {}; const pending = []; let current = null;
    const begin = (n) => { if (current) return false; const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); current = { n, q }; return true; };
    const end = () => { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(current); current = null; };
    const wrap = (obj, fn, label) => { const o = obj[fn].bind(obj); obj[fn] = (...a) => { const l = typeof label === 'function' ? label(...a) : label; const mine = begin(l); const r = o(...a); if (mine) end(); return r; }; return () => { obj[fn] = o; }; };
    const undo = [];
    for (const k of ['aoPass','aoBlur','cloudPass','lightPass','ssrPass','volPass','compPass','taaPass','lumPass','reducePass','adaptPass','downPass','upPass','tonePass','sharpPass']) undo.push(wrap(P[k], 'render', k));
    undo.push(wrap(P, 'renderShadows', 'shadows')); undo.push(wrap(P, 'prepareSky', 'sky'));
    const names = new Map([[P.scenes.gbuf,'gbuffer'],[P.scenes.lod,'lod'],[P.scenes.view,'viewmodel'],[P.scenes.water,'water'],[P.scenes.glass,'glass'],[P.scenes.fx,'effects']]);
    const orender = A.renderer.render.bind(A.renderer);
    A.renderer.render = (s, c) => { const n = names.get(s); const mine = n ? begin(n) : false; orender(s, c); if (mine) end(); };
    for (let i = 0; i < 90; i++) await new Promise(r => requestAnimationFrame(r));
    A.renderer.render = orender; undo.forEach(u => u());
    await wait(500);
    for (const p of pending) { if (gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) { sums[p.n] = (sums[p.n] || 0) + gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6; } }
    const out = Object.entries(sums).map(([k, v]) => [k, +(v / 90).toFixed(2)]).sort((a, b) => b[1] - a[1]);
    // cpu breakdown of one tick
    const t = {}; const G2 = A.Game;
    const time = (obj, fn, label) => { const o = obj[fn].bind(obj); obj[fn] = (...a) => { const t0 = performance.now(); const r = o(...a); t[label] = (t[label] || 0) + performance.now() - t0; return r; }; return () => { obj[fn] = o; }; };
    const u2 = [time(G2.world, 'update', 'world.update'), time(G2.world, 'applyPending', 'applyPending'), time(G2, 'applyEnvironment', 'environment'), time(A.Effects, 'update', 'effects'), time(A.Creatures, 'update', 'creatures'), time(G2, 'probe', 'probe'), time(G2.world, 'updateGrass', 'grass'), time(G2, 'render', 'render-submit'), time(G2, 'tick', 'tick-total')];
    for (let i = 0; i < 90; i++) await new Promise(r => requestAnimationFrame(r));
    u2.forEach(u => u());
    return { gpu: out, total: +out.reduce((a, b) => a + b[1], 0).toFixed(2), cpu: Object.entries(t).map(([k, v]) => [k, +(v / 90).toFixed(2)]), stats: window.__stats() };
  `);
  console.log(JSON.stringify(result));
};
