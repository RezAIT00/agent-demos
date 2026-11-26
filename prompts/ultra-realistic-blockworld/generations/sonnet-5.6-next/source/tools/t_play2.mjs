// play test 2: craft tools, mine stone, torch/door/chest/furnace, smelt, night combat, damage/death/respawn, save + reload
export default async ({ page, url, ready, run, shot, check }) => {
  await page.goto(url()); await ready();
  await run('try{localStorage.clear()}catch(e){}; return 1');
  await page.fill('input[type=text]', '4242');
  await page.getByRole('button', { name: /New world.*Survival/ }).click();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  const info = (label) => run(`const p=G.player; return {pos:p.pos.toArray().map(v=>+v.toFixed(1)), hp:p.health, hunger:+p.hunger.toFixed(1), inv:p.inventory.slots.filter(Boolean).map(s=>s.k+':'+s.n+(s.d!==undefined?'('+Math.ceil(s.d)+')':'')).join(' ')}`).then((r) => console.log(label, JSON.stringify(r)));
  // flat test pad carved out of the world so interactions are unambiguous
  await run(`
    const p=G.player, w=G.world; const bx=Math.floor(p.pos.x), bz=Math.floor(p.pos.z), by=Math.floor(p.pos.y)+9;
    for(let x=-7;x<=7;x++)for(let z=-7;z<=7;z++){ w.setBlock(bx+x,by-1,bz+z,A.B.grass); w.setBlock(bx+x,by-2,bz+z,A.B.stone); for(let y=0;y<6;y++) w.setBlock(bx+x,by+y,bz+z,0); }
    p.pos.set(bx+0.5,by+0.01,bz+0.5); p.vel.set(0,0,0); p.peakY=null; window.__pad={bx,by,bz}; return 1`);
  await page.waitForTimeout(1500);
  await run(`const inv=G.player.inventory; inv.add('oak_log',16); inv.add('coal',6); inv.add('cobble',20); inv.add('raw_iron',3); inv.add('sand',2); return 1`);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(500);
  const recipe = (name) => page.locator('.recipe:not(.locked)', { hasText: name }).first();
  const take = () => page.locator('.grid.out .slot').click({ modifiers: ['Shift'] });
  await recipe('Oak Planks').click({ modifiers: ['Shift'] }); await take(); await page.waitForTimeout(150);
  await recipe('Joiner').click(); await take(); await page.waitForTimeout(150);
  await recipe('Stick').click(); await take(); await recipe('Stick').click(); await take(); await page.waitForTimeout(150);
  await info('batch craft');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  // helper: select an item, aim at a cell on the pad, right click
  const place = async (key, dx, dz, face = 'top') => {
    await run(`
      const p=G.player, {bx,by,bz}=window.__pad; let i=p.inventory.slots.findIndex(s=>s&&s.k===${JSON.stringify(key)});
      if(i>8){ const t=p.inventory.slots[8]; p.inventory.slots[8]=p.inventory.slots[i]; p.inventory.slots[i]=t; i=8; } p.selected=Math.max(0,i);
      const e=p.eyePos(); const tx=bx+${dx}+0.5, ty=by-0.001, tz=bz+${dz}+0.5;
      p.yaw=p.camYaw=Math.atan2(-(tx-e.x),-(tz-e.z)); p.pitch=p.camPitch=Math.atan2(ty-e.y, Math.hypot(tx-e.x,tz-e.z)); return i`);
    await page.waitForTimeout(450);
    await page.mouse.down({ button: 'right' }); await page.waitForTimeout(100); await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(350);
    return run(`const {bx,by,bz}=window.__pad; const v=G.world.getBlock(bx+${dx},by,bz+${dz}); return A.BLOCKS[v&255].name+' meta '+(v>>8)`);
  };
  const aimUse = async (dx, dy, dz) => {
    await run(`const p=G.player,{bx,by,bz}=window.__pad; const e=p.eyePos(); const tx=bx+${dx}+0.5, ty=by+${dy}+0.5, tz=bz+${dz}+0.5; p.yaw=p.camYaw=Math.atan2(-(tx-e.x),-(tz-e.z)); p.pitch=p.camPitch=Math.atan2(ty-e.y, Math.hypot(tx-e.x,tz-e.z)); return 1`);
    await page.waitForTimeout(350);
    await page.mouse.down({ button: 'right' }); await page.waitForTimeout(100); await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(500);
  };
  console.log('bench', await place('crafting_table', -2, -3));
  await aimUse(-2, 0, -3);
  console.log('screen', JSON.stringify(await run('return [G.state,A.UI.screen]')));
  await recipe('Timber Pick').click(); await take(); await page.waitForTimeout(150);
  await recipe('Chest').click(); await take(); await page.waitForTimeout(150);
  await recipe('Door').click(); await take(); await page.waitForTimeout(150);
  await recipe('Kiln Furnace').click(); await take(); await page.waitForTimeout(150);
  await recipe('Torch').click(); await take(); await page.waitForTimeout(150);
  await shot('p2_bench_ui');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  await info('crafted set');
  console.log('chest', await place('chest', 0, -3));
  console.log('furnace', await place('furnace', 2, -3));
  console.log('door', await place('door', -4, -2));
  console.log('torch', await place('torch', 3, -2));
  // open and close the door
  await aimUse(-4, 0, -2);
  console.log('door toggled', await run(`const {bx,by,bz}=window.__pad; return (G.world.getBlock(bx-4,by,bz-2)>>8)&4 ? 'open':'closed'`));
  // chest: open, move a stack in with shift-click
  await aimUse(0, 0, -3);
  console.log('chest screen', JSON.stringify(await run('return [G.state,A.UI.screen]')));
  await page.locator('.panel.inv .grid.hot .slot').nth(0).click({ modifiers: ['Shift'] });
  await page.waitForTimeout(300); await shot('p2_chest');
  console.log('chest holds', JSON.stringify(await run(`const {bx,by,bz}=window.__pad; return G.getChest((bx)+','+by+','+(bz-3)).slots.filter(Boolean).map(s=>s.k+':'+s.n)`)));
  await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  // furnace: smelt iron with coal through the UI
  await aimUse(2, 0, -3);
  console.log('furnace screen', JSON.stringify(await run('return [G.state,A.UI.screen]')));
  await run(`const inv=G.player.inventory; const f=A.UI.furnace; const i=inv.slots.findIndex(s=>s&&s.k==='raw_iron'); f.slots[0]=inv.slots[i]; inv.slots[i]=null; const j=inv.slots.findIndex(s=>s&&s.k==='coal'); if(j>=0){f.slots[1]=inv.slots[j]; inv.slots[j]=null;} else f.slots[1]={k:'coal',n:2}; return 1`);
  await page.waitForTimeout(7500);
  await shot('p2_furnace');
  console.log('furnace', JSON.stringify(await run(`const f=A.UI.furnace; const {bx,by,bz}=window.__pad; return {out:f.slots[2], burning:f.burn>0, progress:+f.progress.toFixed(1), litBlock:!!((G.world.getBlock(bx+2,by,bz-3)>>8)&4)}`)));
  await page.keyboard.press('KeyE'); await page.waitForTimeout(500);
  // mine the stone under the pad with the pick
  await run(`const p=G.player, {bx,by,bz}=window.__pad; const i=p.inventory.slots.findIndex(s=>s&&s.k==='timber_pick'); if(i>8){const t=p.inventory.slots[7]; p.inventory.slots[7]=p.inventory.slots[i]; p.inventory.slots[i]=t; p.selected=7} else p.selected=i; G.world.setBlock(bx+1,by,bz-2,A.B.stone); return 1`);
  await page.waitForTimeout(500);
  await run(`const p=G.player,{bx,by,bz}=window.__pad; const e=p.eyePos(); const tx=bx+1.5, ty=by+0.5, tz=bz-2+0.5; p.yaw=p.camYaw=Math.atan2(-(tx-e.x),-(tz-e.z)); p.pitch=p.camPitch=Math.atan2(ty-e.y, Math.hypot(tx-e.x,tz-e.z)); return 1`);
  await page.mouse.down(); await page.waitForTimeout(430); await shot('p2_cracks'); await page.waitForTimeout(1300); await page.mouse.up();
  console.log('stone mined', JSON.stringify(await run(`const {bx,by,bz}=window.__pad; return {gone:G.world.getId(bx+1,by,bz-2)===0, drops:A.Entities.drops.map(d=>d.key)}`)));
  // look across the pad at the built objects, lit furnace and torch
  await run(`const p=G.player,{bx,by,bz}=window.__pad; p.pos.set(bx+0.5,by+0.01,bz+0.8); p.yaw=p.camYaw=0.12; p.pitch=p.camPitch=-0.36; return 1`);
  await page.waitForTimeout(1200); await shot('p2_built_day');
  // night: spawn hostiles and fight them off with a blade
  await run(`G.time=22.6; const p=G.player; p.inventory.slots[6]={k:'iron_blade',n:1,d:460}; p.selected=6; const {bx,by,bz}=window.__pad; for(const [dx,dz] of [[-1,-5],[3,-5]]) A.Creatures.spawn(dx<0?'gloamstalker':'hollowlantern', bx+dx+0.5, by, bz+dz+0.5); return 1`);
  await page.waitForTimeout(900); await shot('p2_night');
  let maxState = new Set(); let hurtSeen = false;
  for (let i = 0; i < 46; i++) {
    const r = await run(`const p=G.player; const hs=A.Creatures.list.filter(c=>c.spec.hostile&&c.state!=='dying'); if(!hs.length) return {n:0,hp:p.health}; hs.sort((a,b)=>a.pos.distanceTo(p.pos)-b.pos.distanceTo(p.pos)); const c=hs[0]; const e=p.eyePos(); const tx=c.pos.x, ty=c.pos.y+(c.spec.floating?1.3:0.9), tz=c.pos.z; p.yaw=p.camYaw=Math.atan2(-(tx-e.x),-(tz-e.z)); p.pitch=p.camPitch=Math.atan2(ty-e.y, Math.hypot(tx-e.x,tz-e.z)); return {n:hs.length, hp:p.health, states:hs.map(c=>c.state+':'+c.health.toFixed(0)), d:+c.pos.distanceTo(p.pos).toFixed(1), mob:!!p.mobTarget}`);
    if (r.states) r.states.forEach((s) => maxState.add(s.split(':')[0]));
    if (r.hp < 20) hurtSeen = true;
    if (i === 9) await shot('p2_combat');
    if (r.n === 0) break;
    if (i > 6 && r.d < 3.6) { await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); }
    await page.waitForTimeout(290);
  }
  console.log('combat states seen', [...maxState].join(','), 'player hurt', hurtSeen);
  console.log('after combat', JSON.stringify(await run(`return {alive:A.Creatures.list.filter(c=>c.spec.hostile).map(c=>c.type+':'+c.state+':'+c.health.toFixed(0)), hp:G.player.health, drops:A.Entities.drops.map(d=>d.key)}`)));
  // death and respawn
  await run('A.Creatures.reset(); G.player.invulnT=0; G.player.damage(999, G, null, "fall"); return 1');
  await page.waitForTimeout(900); await shot('p2_death');
  await page.getByRole('button', { name: /Return to camp/ }).click(); await page.waitForTimeout(900);
  await info('respawned');
  // fall damage from a height
  await run(`const p=G.player; const {bx,by,bz}=window.__pad; p.health=20; p.pos.set(bx+0.5, by+12, bz+0.5); p.vel.set(0,0,0); p.peakY=null; return 1`);
  await page.waitForTimeout(1800);
  console.log('fall damage hp', JSON.stringify(await run('return G.player.health')));
  // save, reload the page, continue
  const saved = await run(`G.time=14; const ok=G.save(); const {bx,by,bz}=window.__pad; return {ok, pad:window.__pad, size:(localStorage.getItem('ashlar.save.v1')||'').length}`);
  console.log('save', JSON.stringify(saved));
  await page.reload(); await ready();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 60000 });
  await page.waitForTimeout(3500);
  console.log('reloaded', JSON.stringify(await run(`const {bx,by,bz}=${JSON.stringify(saved.pad)}; const n=(x,y,z)=>A.BLOCKS[G.world.getId(x,y,z)].name; return {bench:n(bx-2,by,bz-3), chest:n(bx,by,bz-3), furnace:n(bx+2,by,bz-3), door:n(bx-4,by,bz-2), torch:n(bx+3,by,bz-2), chestItems:G.getChest(bx+','+by+','+(bz-3)).slots.filter(Boolean).map(s=>s.k+':'+s.n)}`)));
  await info('after reload');
  await run(`const p=G.player,{bx,by,bz}=${JSON.stringify(saved.pad)}; p.pos.set(bx+0.5,by+0.01,bz+0.8); p.yaw=p.camYaw=0.12; p.pitch=p.camPitch=-0.36; G.time=21.8; return 1`);
  await page.waitForTimeout(2500); await shot('p2_built_night');
  await check();
};
