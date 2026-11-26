// frame-time spikes while flying fast into never-visited terrain (every chunk has to be generated, meshed, uploaded)
export default async ({ page, url, ready, run, check }) => {
  await page.goto(url()); await ready();
  await page.fill('input[type=text]', '4242');
  await page.getByRole('button', { name: /New world.*Creative/ }).click();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 60000 });
  await page.waitForTimeout(12000);
  const measure = (label, ms) => run(`const d=[]; const w=G.world; const x0=G.player.pos.x, z0=G.player.pos.z; let last=performance.now(); const t0=last;
    while(performance.now()-t0<${ms}){ await new Promise(r=>requestAnimationFrame(r)); const n=performance.now(); d.push(n-last); last=n; }
    d.sort((a,b)=>a-b); const q=(f)=>+d[Math.min(d.length-1,Math.floor(d.length*f))].toFixed(1);
    return {frames:d.length, median:q(0.5), p99:q(0.99), p999:q(0.999), max:+d[d.length-1].toFixed(1), over16:d.filter(v=>v>16.7).length, over33:d.filter(v=>v>33.4).length, metres:Math.round(Math.hypot(G.player.pos.x-x0,G.player.pos.z-z0))}`).then((r) => console.log(label.padEnd(22), JSON.stringify(r)));
  await measure('standing still', 5000);
  await run('const p=G.player; p.flying=true; p.pos.y=212; p.pitch=p.camPitch=-0.2; return 1');
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
  await measure('fast flight, new land', 20000);
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  await check();
};
