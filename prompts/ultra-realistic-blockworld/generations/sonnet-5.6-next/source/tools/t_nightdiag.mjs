// where do night hostiles spawn, and do they reach a player who stands still?
export default async ({ page, url, ready, run, check }) => {
  await page.goto(url()); await ready();
  await run('try{localStorage.clear()}catch(e){}; return 1');
  await page.fill('input[type=text]', '4242');
  await page.getByRole('button', { name: /New world.*Survival/ }).click();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  await run(`A.Settings.dayLength=3.5; G.time=20.0; G.player.health=20; return 1`);
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(5500);
    console.log(JSON.stringify(await run(`const p=G.player; p.health=Math.max(p.health,12); return {t:+G.time.toFixed(1), hp:p.health, mobs:A.Creatures.list.filter(c=>c.spec.hostile).map(c=>[c.type.slice(0,5), c.state, +c.pos.distanceTo(p.pos).toFixed(0), +(c.pos.y-p.pos.y).toFixed(0), +c.light.w.toFixed(1)].join(':'))}`)));
  }
  await check();
};
