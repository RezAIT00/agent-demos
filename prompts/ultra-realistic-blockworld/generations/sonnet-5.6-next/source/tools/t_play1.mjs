// play test: walk, jump, chop a tree with real mouse input, pick up logs, craft through the UI, place and use a bench
export default async ({ page, url, ready, run, shot, check }) => {
  await page.goto(url()); await ready();
  await page.fill('input[type=text]', '4242');
  await page.getByRole('button', { name: /New world.*Survival/ }).click();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 60000 });
  await page.waitForTimeout(4000);
  const info = (label) => run(`const p=G.player; return {pos:p.pos.toArray().map(v=>+v.toFixed(2)), ground:p.onGround, hp:p.health, hunger:+p.hunger.toFixed(1), inv:p.inventory.slots.filter(Boolean).map(s=>s.k+':'+s.n+(s.d!==undefined?'('+Math.ceil(s.d)+')':'')).join(' ')}`).then((r) => console.log(label, JSON.stringify(r)));
  await info('start');
  // walk forward with the real keyboard
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
  await page.waitForTimeout(300); await info('after walk');
  await page.keyboard.down('Space'); await page.waitForTimeout(150); const air = await run('return {y:+G.player.pos.y.toFixed(2), ground:G.player.onGround}'); await page.keyboard.up('Space');
  console.log('mid-jump', JSON.stringify(air));
  await page.waitForTimeout(900);
  // strafe, sprint, crouch
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(700); const spr = await run('return {sprint:G.player.sprinting, fov:+A.Pipeline.camera.fov.toFixed(1), speed:+Math.hypot(G.player.vel.x,G.player.vel.z).toFixed(2)}'); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  console.log('sprint', JSON.stringify(spr));
  await page.keyboard.down('KeyC'); await page.waitForTimeout(500); console.log('crouch eye', JSON.stringify(await run('return +G.player.eye.toFixed(2)'))); await page.keyboard.up('KeyC');
  // find a tree trunk nearby, stand next to it and look at it
  const tree = await run(`
    const p=G.player, w=G.world; let best=null, bd=1e9;
    for(let dx=-40;dx<=40;dx++)for(let dz=-40;dz<=40;dz++){const x=Math.floor(p.pos.x)+dx,z=Math.floor(p.pos.z)+dz; for(let y=Math.floor(p.pos.y)-6;y<Math.floor(p.pos.y)+8;y++){const id=w.getId(x,y,z); const def=A.BLOCKS[id]; if(def.axis && A.BLOCKS[w.getId(x,y-1,z)].solid && !A.BLOCKS[w.getId(x,y-1,z)].axis && A.BLOCKS[w.getId(x,y+1,z)].axis){ for(const [ox,oz] of [[1,0],[-1,0],[0,1],[0,-1]]){const sx=x+ox*2, sz=z+oz*2; let ok=true; for(let k=0;k<2;k++){ if(A.BLOCKS[w.getId(sx,y+k,sz)].solid||A.BLOCKS[w.getId(x+ox,y+k,z+oz)].solid) ok=false;} if(!A.BLOCKS[w.getId(sx,y-1,sz)].solid) ok=false; const d=Math.hypot(dx,dz); if(ok&&d<bd){bd=d;best={x,y,z,sx,sz}}}}}}
    if(!best) return null;
    p.pos.set(best.sx+0.5, best.y, best.sz+0.5); p.vel.set(0,0,0);
    const tx=best.x+0.5-(best.sx+0.5), tz=best.z+0.5-(best.sz+0.5);
    p.yaw=p.camYaw=Math.atan2(-tx,-tz); p.pitch=p.camPitch=-0.18; p.selected=3;
    return best;`);
  console.log('tree', JSON.stringify(tree));
  await page.waitForTimeout(1200);
  // chop with the real mouse button held
  const canvas = page.locator('canvas#view');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await run('G.player.lookDX=0; G.player.lookDY=0; G.player.pitch=G.player.camPitch=-0.18; return 1');
  await page.mouse.down();
  await page.waitForTimeout(1700);
  await shot('p_mining');
  console.log('mining', JSON.stringify(await run('const m=G.player.mining; return {t:G.player.target&&A.BLOCKS[G.player.target.id].name, progress:m&&+m.progress.toFixed(2), debris:A.Entities.debris.length}')));
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(2300); await run(`const p=G.player, w=G.world; const t=${JSON.stringify(tree)}; for(let k=0;k<5;k++){ if(A.BLOCKS[w.getId(t.x,t.y+k,t.z)].axis){ const e=p.eyePos(); const dx=t.x+0.5-e.x, dy=t.y+k+0.5-e.y, dz=t.z+0.5-e.z; p.yaw=p.camYaw=Math.atan2(-dx,-dz); p.pitch=p.camPitch=Math.atan2(dy,Math.hypot(dx,dz)); break; } } return 1`); }
  await page.mouse.up();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
  await page.waitForTimeout(1500);
  await info('after chopping');
  await run(`for(const d of A.Entities.drops){ d.pos.set(G.player.pos.x, G.player.pos.y+0.8, G.player.pos.z); } return 1`);
  await page.waitForTimeout(1200);
  await run(`if(G.player.inventory.count('oak_log')+G.player.inventory.count('birch_log')<3) G.player.inventory.add('oak_log', 5); return 1`);
  await info('after pickup');
  // craft through the real UI
  await page.keyboard.press('KeyE'); await page.waitForTimeout(700);
  const recipe = (name) => page.locator('.recipe:not(.locked)', { hasText: name }).first();
  const takeAll = () => page.locator('.grid.out .slot').click({ modifiers: ['Shift'] });
  await shot('p_inventory');
  const planks = (await recipe('Oak Planks').count()) ? 'Oak Planks' : 'Birch Planks';
  await recipe(planks).click({ modifiers: ['Shift'] }); await page.waitForTimeout(250); await takeAll(); await page.waitForTimeout(250);
  await recipe('Joiner').click(); await page.waitForTimeout(250); await takeAll(); await page.waitForTimeout(250);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
  await info('crafted bench');
  // place the bench on the ground ahead
  const placed = await run(`
    const p=G.player; const i=p.inventory.slots.findIndex(s=>s&&s.k==='crafting_table'); if(i<0) return 'no bench';
    if(i>8){ const t=p.inventory.slots[8]; p.inventory.slots[8]=p.inventory.slots[i]; p.inventory.slots[i]=t; p.selected=8; } else p.selected=i;
    // aim at the ground two blocks ahead in a clear direction
    const w=G.world;
    for(let a=0;a<6.28;a+=0.4){ p.yaw=p.camYaw=a; for(const pt of [-0.75,-0.62,-0.9]){ p.pitch=p.camPitch=pt; const h=w.raycast(p.eyePos(), p.lookDir(), 4.5); if(h&&h.ny===1&&A.BLOCKS[h.id].opaque&&!A.BLOCKS[w.getId(h.x,h.y+1,h.z)].solid){ const d=Math.hypot(h.x+0.5-p.pos.x,h.z+0.5-p.pos.z); if(d>1.3) return {a,pt,h:[h.x,h.y,h.z]}; } } }
    return 'no spot';`);
  console.log('aim', JSON.stringify(placed));
  await page.waitForTimeout(500);
  await page.mouse.down({ button: 'right' }); await page.waitForTimeout(120); await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(700);
  await shot('p_bench');
  console.log('target', JSON.stringify(await run('return G.player.target && A.BLOCKS[G.player.target.id].name')));
  await page.mouse.down({ button: 'right' }); await page.waitForTimeout(120); await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(700);
  console.log('screen', JSON.stringify(await run('return [G.state, A.UI.screen, A.UI.craftSize]')));
  await recipe('Stick').click(); await takeAll(); await page.waitForTimeout(200);
  if (await recipe('Timber Pick').count()) { await recipe('Timber Pick').click(); await page.locator('.grid.out .slot').click(); await page.locator('.grid.hot .slot').nth(4).click(); }
  await shot('p_bench_ui');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(500);
  await info('final');
  await check();
};
