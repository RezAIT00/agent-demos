// play test 3: a full kill with drops, creature close-ups, creative flight, underwater, cave + torches, settings change, crack overlay
export default async ({ page, url, ready, run, shot, check }) => {
  await page.goto(url()); await ready();
  await page.fill('input[type=text]', '4242');
  await page.getByRole('button', { name: /New world.*Survival/ }).click();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await run(`
    const p=G.player, w=G.world; const bx=Math.floor(p.pos.x), bz=Math.floor(p.pos.z), by=Math.floor(p.pos.y)+10;
    for(let x=-12;x<=12;x++)for(let z=-14;z<=8;z++){ w.setBlock(bx+x,by-1,bz+z,A.B.grass); w.setBlock(bx+x,by-2,bz+z,A.B.dirt); for(let y=0;y<6;y++) w.setBlock(bx+x,by+y,bz+z,0); }
    p.pos.set(bx+0.5,by+0.01,bz+0.5); p.peakY=null; window.__pad={bx,by,bz}; A.Creatures.enabled=false; return 1`);
  await page.waitForTimeout(1500);
  // one hostile, fought to the death
  await run(`G.time=22.5; const p=G.player, {bx,by,bz}=window.__pad; p.inventory.slots[6]={k:'iron_blade',n:1,d:460}; p.selected=6; A.Creatures.spawn('gloamstalker', bx+0.5, by, bz-4.5, 0.3); return 1`);
  let dyingShot = false, result = null;
  for (let i = 0; i < 70; i++) {
    result = await run(`const p=G.player; p.health=20; const c=A.Creatures.list.find(c=>c.type==='gloamstalker'); if(!c) return null; const e=p.eyePos(); const tx=c.pos.x, ty=c.pos.y+0.85, tz=c.pos.z; p.yaw=p.camYaw=Math.atan2(-(tx-e.x),-(tz-e.z)); p.pitch=p.camPitch=Math.atan2(ty-e.y, Math.hypot(tx-e.x,tz-e.z)); return {s:c.state, hp:+c.health.toFixed(1), d:+c.pos.distanceTo(p.pos).toFixed(1)}`);
    if (!result) break;
    if (result.s === 'dying') { if (!dyingShot) { await page.waitForTimeout(420); await shot('p3_death_anim'); dyingShot = true; } }
    else if (result.d < 3.5) { await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up(); }
    await page.waitForTimeout(260);
  }
  console.log('kill', result === null ? 'creature removed' : JSON.stringify(result), 'dying seen', dyingShot);
  console.log('drops', JSON.stringify(await run('return {drops:A.Entities.drops.map(d=>d.key), inv:G.player.inventory.slots.filter(Boolean).map(s=>s.k+":"+s.n)}')));
  // passive creature line-up in daylight
  await run(`G.time=9.2; A.Creatures.reset(); const p=G.player, {bx,by,bz}=window.__pad; p.pos.set(bx+0.5,by+0.01,bz+1.5); p.yaw=p.camYaw=0; p.pitch=p.camPitch=-0.2; p.selected=0; p.mode='creative';
    const a=A.Creatures.spawn('mossback', bx-2.2, by, bz-3.2, 0.1); a.yaw=0.75; const b=A.Creatures.spawn('plumehare', bx+0.4, by, bz-1.9, 0.5); b.yaw=-0.6; const c=A.Creatures.spawn('reedstrider', bx+2.6, by, bz-3.0, 0.7); c.yaw=-0.9; const d=A.Creatures.spawn('mossback', bx-3.5, by, bz-6, 0.9); d.yaw=-0.4;
    for (const k of A.Creatures.list) { k.timer=999; k.state='idle'; k.spec = Object.assign({}, k.spec, {shy:0}); } d.state='graze'; return 1`);
  await page.waitForTimeout(2200); await shot('p3_animals');
  await run(`const p=G.player,{bx,by,bz}=window.__pad; p.pos.set(bx-1.1,by+0.01,bz-1.2); p.yaw=p.camYaw=0.52; p.pitch=p.camPitch=-0.36; return 1`);
  await page.waitForTimeout(900); await shot('p3_mossback');
  console.log('animals alive', JSON.stringify(await run('return A.Creatures.list.map(c=>c.type+":"+c.state+" "+c.pos.y.toFixed(1))')));
  // crack overlay close up
  await run(`A.Creatures.reset(); const p=G.player,{bx,by,bz}=window.__pad; p.mode='survival'; G.world.setBlock(bx,by,bz-2,A.B.stone); G.world.setBlock(bx,by+1,bz-2,A.B.stone); p.pos.set(bx+0.5,by+0.01,bz+0.4); p.yaw=p.camYaw=0.0; p.pitch=p.camPitch=-0.1; p.selected=0; return 1`);
  await page.waitForTimeout(900);
  await page.mouse.down(); await page.waitForTimeout(3600); await shot('p3_cracks'); await page.mouse.up();
  // creative flight by double-tapping space
  await run(`G.player.mode='creative'; return 1`);
  await page.keyboard.press('Space'); await page.waitForTimeout(90); await page.keyboard.press('Space');
  await page.keyboard.down('Space'); await page.waitForTimeout(900); await page.keyboard.up('Space');
  console.log('flight', JSON.stringify(await run('return {flying:G.player.flying, y:+G.player.pos.y.toFixed(1), padY:window.__pad.by}')));
  await page.keyboard.press('KeyE'); await page.waitForTimeout(800); await shot('p3_palette'); await page.keyboard.press('KeyE');
  // a cave: find the grand cavern nearest to spawn and walk in with a torch
  const cave = await run(`const g=G.world.gen; const p=G.player; let best=null, bd=1e9; for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){ const gx=Math.floor(p.pos.x/448)+i, gz=Math.floor(p.pos.z/448)+j; const list=g.cavernList(gx*28+10, gz*28+10); for(const f of list){ const d=Math.hypot(f.x-p.pos.x,f.z-p.pos.z); if(d<bd){bd=d;best=f;} } } return best`);
  console.log('cavern', JSON.stringify(cave));
  await run(`const c=${JSON.stringify(cave)}; const p=G.player; p.flying=true; p.mode='creative'; p.pos.set(c.x - c.rx*0.55, c.y-2, c.z); p.vel.set(0,0,0); p.yaw=p.camYaw=-1.571; p.pitch=p.camPitch=-0.12; p.inventory.slots[0]={k:'torch',n:20}; p.selected=0; await G.world.settle(c.x, c.z, A.Q.viewDist); return 1`);
  await page.waitForTimeout(3500); await shot('p3_cave');
  console.log('cave light', JSON.stringify(await run('const p=G.player; return {l:G.world.getLight(Math.floor(p.pos.x), p.pos.y+1.5, Math.floor(p.pos.z)), cave:+G.env.cave.toFixed(2), camSky:+A.U.uCamSky.value.toFixed(2), lights:A.Pipeline.shared.uPointCount.value, stats:window.__stats()}')));
  // settings: switch preset through the real menu
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await shot('p3_pause');
  await page.getByRole('button', { name: 'Settings' }).click(); await page.waitForTimeout(300);
  await page.locator('.form select').first().selectOption('medium');
  await shot('p3_settings');
  await page.getByRole('button', { name: /Apply/ }).click(); await page.waitForTimeout(6000);
  await page.getByRole('button', { name: 'Resume' }).click(); await page.waitForTimeout(2500);
  console.log('after preset change', JSON.stringify(await run('return window.__stats()')));
  await shot('p3_medium');
  await run("A.Settings.preset='high'; A.Settings.save(); return 1");
  await check();
};
