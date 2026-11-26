// (1) real pointer lock without the test flag, (2) measure the synthesised audio with an analyser tap
export default async ({ page, url, ready, run, shot, check }) => {
  await page.goto(url('preset=high')); await ready();
  await run('try{localStorage.clear()}catch(e){}; return 1');
  await page.fill('input[type=text]', '4242');
  await page.getByRole('button', { name: /New world.*Survival/ }).click();
  await page.waitForFunction(() => window.__ashlar.Game.state === 'playing', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  let locked = await page.evaluate(() => !!document.pointerLockElement);
  if (!locked) { await page.mouse.click(800, 450); await page.waitForTimeout(700); locked = await page.evaluate(() => !!document.pointerLockElement); }
  console.log('pointer lock acquired:', locked, '| state', await run('return G.state'));
  const yaw0 = await run('return G.player.yaw');
  await page.mouse.move(800, 450); await page.mouse.move(900, 470, { steps: 8 }); await page.waitForTimeout(300);
  console.log('mouse look changed yaw by', (await run('return G.player.yaw') - yaw0).toFixed(3));
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  console.log('after Esc: state', await run('return G.state'), '| screen', await run('return A.UI.screen'));
  await page.getByRole('button', { name: 'Resume' }).click(); await page.waitForTimeout(600);
  console.log('after resume: state', await run('return G.state'));
  // analyser on the final mix
  console.log('audio context', JSON.stringify(await run(`const au=A.Audio; if(!au.ready) return 'not initialised'; const an=au.ctx.createAnalyser(); an.fftSize=2048; au.comp.connect(an); window.__an=an; return {state:au.ctx.state, rate:au.ctx.sampleRate, volume:au.master.gain.value}`)));
  const measure = (label, ms) => run(`const an=window.__an, buf=new Float32Array(an.fftSize), f=new Float32Array(an.frequencyBinCount); let sum=0,n=0,peak=0,cen=0,cn=0; const t0=performance.now(); while(performance.now()-t0<${ms}){ an.getFloatTimeDomainData(buf); let s=0; for(const v of buf){s+=v*v; peak=Math.max(peak,Math.abs(v));} sum+=Math.sqrt(s/buf.length); n++; an.getFloatFrequencyData(f); let a=0,b=0; for(let i=1;i<f.length;i++){ const p=Math.pow(10,f[i]/10); a+=p*i*A.Audio.ctx.sampleRate/an.fftSize; b+=p; } if(b>1e-12){cen+=a/b;cn++;} await wait(30);} return {rms:+(sum/n).toFixed(4), peak:+peak.toFixed(3), centroidHz: cn? Math.round(cen/cn):0}`).then((r) => console.log(label.padEnd(26), JSON.stringify(r)));
  await run(`A.Creatures.enabled=false; A.Creatures.reset(); G.setWeather('clear', true); G.time=10; return 1`);
  await page.waitForTimeout(2500); await measure('day ambience, standing', 5000);
  await page.keyboard.down('KeyW'); await page.keyboard.down('Space'); const p = measure('walking and jumping', 3500); await p; await page.keyboard.up('Space'); await page.keyboard.up('KeyW');
  await run(`for(const m of ['grass','gravel','stone','sand','snow','wood','water','glass','metal','cloth','leaves']) { A.Audio.step(m, 1); await wait(220); } return 1`);
  await run(`A.Audio.thunder(80); return 1`); await measure('thunder strike', 3000);
  await run(`G.setWeather('storm', true); return 1`); await page.waitForTimeout(3000); await measure('storm: rain and wind', 4000);
  await run(`G.setWeather('clear', true); G.time=23; return 1`); await page.waitForTimeout(3500); await measure('night ambience', 5000);
  await run(`G.env.caveT=1; window.__probe=G.probe; G.probe=()=>{}; G.env.cave=1; return 1`); await page.waitForTimeout(3000); await measure('cave (drips, rumble)', 5000);
  await run(`G.probe=window.__probe; return A.Audio.send.gain.value`).then((v) => console.log('reverb send in cave', v));
  await check();
};
