// movement measurements on a flat pad: walk, sprint, crouch ledge guard, step onto slab, ladder, swimming, drowning
export default async ({ page, url, ready, run, check }) => {
  await page.goto(url()); await ready();
  await page.fill('input[type=text]', '4242');
  await page.getByRole('button', { name: /New world.*Survival/ }).click();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await run(`
    const p=G.player, w=G.world; A.Creatures.enabled=false; const bx=Math.floor(p.pos.x), bz=Math.floor(p.pos.z), by=Math.floor(p.pos.y)+12;
    for(let x=-5;x<=5;x++)for(let z=-26;z<=6;z++){ w.setBlock(bx+x,by-1,bz+z,A.B.stone_bricks); for(let y=0;y<7;y++) w.setBlock(bx+x,by+y,bz+z,0); }
    window.__pad={bx,by,bz}; return 1`);
  await page.waitForTimeout(1500);
  const reset = (dx, dz) => run(`const p=G.player,{bx,by,bz}=window.__pad; p.pos.set(bx+0.5+${dx},by+0.01,bz+0.5+${dz}); p.vel.set(0,0,0); p.yaw=p.camYaw=0; p.pitch=p.camPitch=0; p.peakY=null; p.health=20; return 1`);
  const measure = async (keys, ms) => {
    await reset(0, 4); await page.waitForTimeout(400);
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(500);
    const a = await run('return {z:G.player.pos.z, t:performance.now()}');
    await page.waitForTimeout(ms);
    const b = await run('return {z:G.player.pos.z, t:performance.now(), sprint:G.player.sprinting, fov:+A.Pipeline.camera.fov.toFixed(1), ground:G.player.onGround}');
    for (const k of [...keys].reverse()) await page.keyboard.up(k);
    return { speed: +((a.z - b.z) / ((b.t - a.t) / 1000)).toFixed(2), sprint: b.sprint, fov: b.fov, ground: b.ground };
  };
  console.log('walk  ', JSON.stringify(await measure(['KeyW'], 1200)));
  console.log('sprint', JSON.stringify(await measure(['ShiftLeft', 'KeyW'], 1200)));
  console.log('crouch', JSON.stringify(await measure(['KeyC', 'KeyW'], 1200)));
  // crouch must not walk off the edge; walking does
  for (const crouch of [true, false]) {
    await reset(0, -24); await page.waitForTimeout(400);
    if (crouch) await page.keyboard.down('KeyC');
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1900); await page.keyboard.up('KeyW');
    const r = await run('const {by,bz}=window.__pad; return {dy:+(G.player.pos.y-by).toFixed(2), z:+(G.player.pos.z-bz).toFixed(2)}');
    if (crouch) await page.keyboard.up('KeyC');
    console.log(crouch ? 'ledge crouched' : 'ledge walking ', JSON.stringify(r));
  }
  // step-up onto a slab without jumping; a full block needs a jump
  await run(`const {bx,by,bz}=window.__pad, w=G.world; for(let x=-2;x<=2;x++){ w.setBlock(bx+x,by,bz-3,A.B.stone_slab); } return 1`);
  await page.waitForTimeout(500); await reset(0, 0); await page.waitForTimeout(300);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
  console.log('slab step', JSON.stringify(await run('const {by,bz}=window.__pad; return {dy:+(G.player.pos.y-by).toFixed(2), z:+(G.player.pos.z-bz).toFixed(2)}')));
  // ladder climb up a wall
  await run(`const {bx,by,bz}=window.__pad, w=G.world; for(let x=-2;x<=2;x++){ w.setBlock(bx+x,by,bz-3,0); for(let y=0;y<5;y++) w.setBlock(bx+x,by+y,bz-4,A.B.cobble); } for(let y=0;y<5;y++) w.setBlock(bx,by+y,bz-3,A.B.ladder|(0<<8)); return 1`);
  await page.waitForTimeout(700); await reset(0, -1.5); await page.waitForTimeout(300);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1700); const lad = await run('const {by}=window.__pad; return {climbed:+(G.player.pos.y-by).toFixed(2), onLadder:G.player.onLadder}'); await page.keyboard.up('KeyW');
  console.log('ladder', JSON.stringify(lad));
  // deep water: swimming, air, drowning damage
  await run(`const {bx,by,bz}=window.__pad, w=G.world; for(let x=-3;x<=3;x++)for(let z=-20;z<=-12;z++){ for(let y=0;y<6;y++){ const wall=Math.abs(x)===3||z===-20||z===-12||y===0; w.setBlock(bx+x,by+y,bz+z, wall?A.B.glass:A.B.water); } } return 1`);
  await page.waitForTimeout(900);
  await run(`const p=G.player,{bx,by,bz}=window.__pad; p.pos.set(bx+0.5,by+1.2,bz-15.5); p.vel.set(0,0,0); p.peakY=null; p.health=20; p.air=10; return 1`);
  await page.waitForTimeout(1200);
  console.log('underwater', JSON.stringify(await run('return {inWater:G.player.inWater, head:G.player.headWater, air:+G.player.air.toFixed(1), post:A.U.uUnderwater.value}')));
  await page.screenshot({ path: 'tools/p_underwater.png' });
  await page.keyboard.down('Space'); await page.waitForTimeout(1500);
  console.log('swim up', JSON.stringify(await run('const {by}=window.__pad; return {dy:+(G.player.pos.y-by).toFixed(2), head:G.player.headWater}')));
  await page.keyboard.up('Space');
  await run(`G.player.air=0.2; G.player.pos.y=window.__pad.by+1.1; G.player.vel.set(0,0,0); return 1`);
  await page.waitForTimeout(2600);
  console.log('drowning hp', JSON.stringify(await run('return G.player.health')));
  // lava damage
  await run(`const {bx,by,bz}=window.__pad, w=G.world; w.setBlock(bx+3,by,bz+2,A.B.lava); G.player.pos.set(bx+3.5,by+0.2,bz+2.5); G.player.health=20; G.player.invulnT=0; return 1`);
  await page.waitForTimeout(900);
  console.log('lava hp', JSON.stringify(await run('return G.player.health')));
  // eat to restore hunger through the real mouse button
  await run(`const p=G.player,{bx,by,bz}=window.__pad; p.pos.set(bx+0.5,by+0.01,bz+4.5); p.health=20; p.hunger=8; p.selected=1; p.pitch=p.camPitch=0.6; return 1`);
  await page.waitForTimeout(500);
  await page.mouse.down({ button: 'right' }); await page.waitForTimeout(1700); await page.mouse.up({ button: 'right' });
  console.log('eating', JSON.stringify(await run('return {hunger:+G.player.hunger.toFixed(1), apples:G.player.inventory.count("apple")}')));
  // falling sand and water flow into a broken wall
  await run(`const {bx,by,bz}=window.__pad, w=G.world; w.setBlock(bx-4,by+4,bz+2,A.B.sand); w.setBlock(bx-3,by+2,bz-16,0); return 1`);
  await page.waitForTimeout(2500);
  console.log('physics', JSON.stringify(await run('const {bx,by,bz}=window.__pad, w=G.world; return {sandLanded:w.getId(bx-4,by,bz+2)===A.B.sand, waterFlowed:w.getId(bx-3,by+2,bz-16)===A.B.water}')));
  await check();
};
