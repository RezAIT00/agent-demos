// survive a whole night: natural spawning on, a scripted player that defends itself with the real mouse and keys
export default async ({ page, url, ready, run, shot, check }) => {
  await page.goto(url()); await ready();
  await run('try{localStorage.clear()}catch(e){}; return 1');
  await page.fill('input[type=text]', '4242');
  await page.getByRole('button', { name: /New world.*Survival/ }).click();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  // a modest kit, torches placed around camp, dusk, and a compressed day so the night lasts about 100 seconds
  await run(`
    const p=G.player, w=G.world; p.inventory.slots.fill(null);
    p.inventory.slots[0]={k:'stone_blade',n:1,d:150}; p.inventory.slots[1]={k:'roast_meat',n:6}; p.inventory.slots[2]={k:'torch',n:12}; p.selected=0;
    const bx=Math.floor(p.pos.x), by=Math.floor(p.pos.y), bz=Math.floor(p.pos.z); let placed=0;
    for(const [dx,dz] of [[5,0],[-5,0],[0,5],[0,-5],[4,4],[-4,-4]]){ for(let y=by+5;y>by-6;y--){ if(w.getId(bx+dx,y-1,bz+dz)&&A.BLOCKS[w.getId(bx+dx,y-1,bz+dz)].solid&&w.getId(bx+dx,y,bz+dz)===0){ w.setBlock(bx+dx,y,bz+dz,A.B.torch); placed++; break; } } }
    A.Settings.dayLength=3.5; G.time=19.0; window.__camp=[p.pos.x,p.pos.y,p.pos.z]; window.__seen=new Set(); window.__kills=0; return placed`);
  let minHp = 20, shots = 0, hits = 0, ate = 0, last = 0, spawnedMax = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 200000) {
    const r = await run(`
      const p=G.player; if(p.dead) return {dead:true, cause:p.deathCause, time:G.time};
      for(const c of A.Creatures.list) if(c.spec.hostile){ window.__seen.add(c.id); if(c.state==='dying' && !c.__counted){c.__counted=true; window.__kills++;} }
      const hs=A.Creatures.list.filter(c=>c.spec.hostile&&c.state!=='dying').map(c=>({c,d:c.pos.distanceTo(p.pos)})).filter(o=>o.d<14).sort((a,b)=>a.d-b.d);
      let attack=false, kind='';
      if(hs.length){ const c=hs[0].c; kind=c.type; const e=p.eyePos(); const tx=c.pos.x, ty=c.pos.y+(c.spec.floating?1.3:0.9), tz=c.pos.z; p.yaw=Math.atan2(-(tx-e.x),-(tz-e.z)); p.pitch=Math.atan2(ty-e.y, Math.hypot(tx-e.x,tz-e.z)); attack=hs[0].d<3.7; }
      return {dead:false, hp:p.health, hunger:p.hunger, time:G.time, near:hs.length, attack, kind, alive:A.Creatures.list.filter(c=>c.spec.hostile).length, kills:window.__kills, seen:window.__seen.size};`);
    if (r.dead) { console.log('died', r.cause, 'at', r.time.toFixed(1)); await page.getByRole('button', { name: /Return to camp/ }).click(); await page.waitForTimeout(800); continue; }
    minHp = Math.min(minHp, r.hp); spawnedMax = Math.max(spawnedMax, r.alive);
    if (r.attack) { await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); hits++; }
    if (r.near === 0 && (r.hunger < 15 || r.hp < 12) && Date.now() - last > 4000) {
      await run('G.player.selected=1; G.player.pitch=0.7; return 1'); await page.waitForTimeout(250);
      await page.mouse.down({ button: 'right' }); await page.waitForTimeout(1600); await page.mouse.up({ button: 'right' });
      await run('G.player.selected=0; return 1'); ate++; last = Date.now();
    }
    if (r.near > 0 && shots < 2 && r.attack) { await shot('p_night_fight' + (++shots)); }
    if (r.time > 6.05 && r.time < 12) break;
    await page.waitForTimeout(240);
  }
  const end = await run(`const p=G.player; return {time:+G.time.toFixed(2), day:G.day, hp:p.health, hunger:+p.hunger.toFixed(1), kills:window.__kills, hostilesSeen:window.__seen.size, inv:p.inventory.slots.filter(Boolean).map(s=>s.k+':'+s.n+(s.d!==undefined?'('+Math.ceil(s.d)+')':''))}`);
  console.log('night result', JSON.stringify(end), '| lowest hp', minHp, '| swings', hits, '| meals', ate, '| max hostiles alive', spawnedMax, '| real seconds', ((Date.now() - t0) / 1000).toFixed(0));
  await page.waitForTimeout(1500); await shot('p_dawn');
  await check();
};
