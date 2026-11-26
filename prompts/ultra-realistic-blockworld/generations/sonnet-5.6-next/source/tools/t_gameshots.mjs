// two gameplay screenshots with the HUD, plus a natural underwater check. High preset, 1920x1080.
export default async ({ page, url, ready, run, shot, check }) => {
  await page.goto(url('test=1&preset=' + (process.env.PRESET || 'high'))); await ready();
  await run('try{localStorage.clear()}catch(e){}; return 1');
  await page.fill('input[type=text]', '4242');
  await page.getByRole('button', { name: /New world.*Survival/ }).click();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 60000 });
  const which = (process.env.SHOTS || 'a,b,c').split(',');
  const settle = async () => { await run('const p=G.player; await G.world.settle(p.pos.x,p.pos.z,A.Q.viewDist); return 1'); };
  if (which.includes('a')) {
    // A: mining a fieldstone outcrop in the morning forest, creatures grazing, survival HUD
    const info = await run(`
      A.Creatures.enabled=false; A.Creatures.reset(); const p=G.player, w=G.world; A.UI.hint.style.opacity=0; G.hintT=0;
      p.mode='creative'; p.flying=true; p.pos.set(-396.5, 100, -3088.5); await w.settle(p.pos.x, p.pos.z, A.Q.viewDist);
      const sy=(x,z)=>{ for(let y=130;y>40;y--){ const id=w.getId(Math.floor(x),y,Math.floor(z)); if(A.BLOCKS[id].solid && !/leaves|log/.test(A.BLOCKS[id].key)) return y+1; } return 80; };
      p.mode='survival'; p.flying=false; p.pos.set(-396.5, sy(-396.5,-3088.5)+0.02, -3088.5); p.vel.set(0,0,0); p.peakY=null;
      const bx=-394, bz=-3088; const gy=sy(bx+0.5,bz+0.5);
      w.setBlock(bx, gy, bz, A.B.mossy_cobble); w.setBlock(bx, gy+1, bz, A.B.stone); w.setBlock(bx, gy, bz-1, A.B.stone); w.setBlock(bx, gy, bz+1, A.B.cobble);
      for (let x=-396;x<=-393;x++) for (let z=-3090;z<=-3086;z++) { const y=sy(x+0.5,z+0.5); const id=w.getId(x,y,z); if(id && !A.BLOCKS[id].solid) w.setBlock(x,y,z,0); }
      G.time=7.35; G.weather.timer=1e9; G.setWeather('clear', true); G.weather.timer=1e9; A.U.uCloudCover.value=0.35;
      const m=A.Creatures.spawn('mossback', -388.2, sy(-388.2,-3091.3), -3091.3, 0.31); m.yaw=-1.6; m.state='graze'; m.timer=999;
      const h=A.Creatures.spawn('plumehare', -391.5, sy(-391.5,-3085.6), -3085.6, 0.52); h.yaw=-2.2; h.timer=999; h.spec=Object.assign({},h.spec,{shy:0});
      p.inventory.slots.fill(null);
      const inv=p.inventory.slots; inv[0]={k:'stone_pick',n:1,d:121}; inv[1]={k:'iron_blade',n:1,d:451}; inv[2]={k:'torch',n:17}; inv[3]={k:'oak_log',n:23}; inv[4]={k:'cobble',n:48}; inv[5]={k:'oak_planks',n:31}; inv[6]={k:'crafting_table',n:1}; inv[7]={k:'roast_meat',n:5}; inv[8]={k:'apple',n:3}; p.selected=0;
      p.health=17; p.hunger=15;
      const e=p.eyePos(); const tx=bx+0.05, ty=gy+1.45, tz=bz+0.45; p.yaw=p.camYaw=Math.atan2(-(tx-e.x),-(tz-e.z)); p.pitch=p.camPitch=Math.atan2(ty-e.y, Math.hypot(tx-e.x,tz-e.z));
      window.__aim=[tx,ty,tz]; return {gy, py:p.pos.y, placed:[A.BLOCKS[w.getId(bx,gy,bz)].key, A.BLOCKS[w.getId(bx,gy+1,bz)].key]};`);
    console.log('A', JSON.stringify(info));
    await settle(); await page.waitForTimeout(3500);
    await run('A.UI.lastBiome=G.biome; A.UI.biomeT=0; return 1');
    await page.mouse.move(960, 540); await page.waitForTimeout(250);
    await run(`const p=G.player; const [tx,ty,tz]=window.__aim; const e=p.eyePos(); p.yaw=p.camYaw=Math.atan2(-(tx-e.x),-(tz-e.z)); p.pitch=p.camPitch=Math.atan2(ty-e.y, Math.hypot(tx-e.x,tz-e.z)); p.lookDX=0; p.lookDY=0; return 1`);
    await page.waitForTimeout(900); await page.mouse.down();
    // freeze the simulation partway through the break so the fracture is on screen
    await run(`const t0=performance.now(); while(performance.now()-t0<3000){ await new Promise(r=>requestAnimationFrame(r)); if(G.player.mining && G.player.mining.progress>=0.68) break; } G.state='paused'; return 1`);
    await page.waitForTimeout(500);
    console.log('mining', JSON.stringify(await run('const p=G.player; return {target:p.target&&A.BLOCKS[p.target.id].name, progress:p.mining&&+p.mining.progress.toFixed(2), debris:A.Entities.debris.length, fps:window.__stats().fps}')));
    await shot('g_mining'); await page.mouse.up(); await run("G.state='playing'; return 1");
  }
  if (which.includes('b')) {
    // B: arriving at the village at dusk with a torch, doors, lamps and campfire
    const info = await run(`
      A.Creatures.enabled=false; A.Creatures.reset(); const p=G.player; A.UI.hint.style.opacity=0; G.hintT=0;
      const seedGen=G.world.gen; let site=null; for(let r=0;r<8&&!site;r++) for(let i=-r;i<=r&&!site;i++) for(let j=-r;j<=r&&!site;j++){ const v=seedGen.villageSite(i,j); if(v) site=v; }
      if(!site) return null;
      p.mode='creative'; p.flying=true; p.pos.set(site.x+0.5, site.y+40, site.z+0.5); await G.world.settle(p.pos.x,p.pos.z,A.Q.viewDist);
      const px=site.x+14.5, pz=site.z+11.5; let y=130; while(y>40){ const id=G.world.getId(Math.floor(px),y,Math.floor(pz)); if(A.BLOCKS[id].solid && !/leaves|log/.test(A.BLOCKS[id].key)) break; y--; }
      p.mode='survival'; p.flying=false; p.health=20; p.pos.set(px, y+1.02, pz); p.vel.set(0,0,0); p.peakY=null; G.time=19.15; G.weather.timer=1e9; G.setWeather('clear', true); G.weather.timer=1e9;
      const tx=site.x+3, tz=site.z+2; p.yaw=p.camYaw=Math.atan2(-(tx-px),-(tz-pz)); p.pitch=p.camPitch=-0.04;
      p.inventory.slots.fill(null); const inv=p.inventory.slots; inv[0]={k:'iron_blade',n:1,d:448}; inv[1]={k:'torch',n:23}; inv[2]={k:'iron_pick',n:1,d:380}; inv[3]={k:'oak_planks',n:40}; inv[4]={k:'lamp',n:6}; inv[5]={k:'glass',n:12}; inv[6]={k:'door',n:2}; inv[7]={k:'berries',n:9}; inv[8]={k:'chest',n:1}; p.selected=1;
      p.health=20; p.hunger=18; return site;`);
    console.log('B village', info && JSON.stringify({ x: info.x, y: info.y, z: info.z }));
    await settle(); await page.waitForTimeout(4500);
    await run('A.UI.lastBiome=G.biome; A.UI.biomeT=0; A.UI.nameT=1.5; return 1');
    await page.waitForTimeout(150);
    console.log('fps', JSON.stringify(await run('return window.__stats()')));
    await shot('g_village');
  }
  if (which.includes('c')) {
    // C: natural underwater view on a reef
    const spot = await run(`const g=G.world.gen; for(let r=20;r<1200;r+=10) for(let a=0;a<6.28;a+=0.15){ const x=Math.round(Math.cos(a)*r), z=Math.round(Math.sin(a)*r); const c=g.column(x,z,{}); if(c.biome===A.BIOME.REEF && c.h<65 && c.h>56) return [x,c.h,z]; } return null`);
    await run(`const p=G.player; p.mode='creative'; p.flying=true; p.pos.set(${spot[0]}, ${spot[1]}+1.4, ${spot[2]}); p.vel.set(0,0,0); p.yaw=p.camYaw=0.7; p.pitch=p.camPitch=0.02; G.time=12.5; return 1`);
    await settle(); await page.waitForTimeout(3000);
    await shot('g_underwater');
  }
  await check();
};
