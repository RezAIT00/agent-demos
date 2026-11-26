export default async ({ page, url, ready, run, shot, check }) => {
  await page.goto(url()); await ready();
  // click the real menu button
  await page.fill('input[type=text]', '4242');
  await page.getByRole('button', { name: /New world.*Survival/ }).click();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 60000 });
  await page.waitForTimeout(5000);
  await check();
  console.log(JSON.stringify(await run(`const p=G.player; return {pos:p.pos.toArray().map(v=>+v.toFixed(1)), ground:p.onGround, biome:G.biome, stats:window.__stats(), inv:p.inventory.slots.filter(Boolean).map(s=>s.k+':'+s.n)}`)));
  await shot('p_spawn');
};
