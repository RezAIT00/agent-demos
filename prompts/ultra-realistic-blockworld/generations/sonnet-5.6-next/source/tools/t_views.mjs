// render candidate viewpoints. VIEWS env: JSON [{n, x, y, z, yaw|dir, pitch, t, w:{...}, fov}]
export default async ({ page, url, ready, run, shot, check }) => {
  await page.goto(url('test=1&preset=' + (process.env.PRESET || 'high'))); await ready();
  const views = JSON.parse(process.env.VIEWS);
  await run(`document.getElementById('ui').style.display='none'; G.state='film'; return 1`);
  for (const v of views) {
    await run(`
      const v=${JSON.stringify(v)}; const cam=A.Pipeline.camera;
      let y=v.y; if (y===undefined) y = G.world.gen.column(v.x, v.z, {}).h + (v.dy||3);
      const yaw = v.dir!==undefined ? Math.atan2(-Math.cos(v.dir), -Math.sin(v.dir)) : v.yaw;
      cam.position.set(v.x, y, v.z); cam.rotation.set(v.pitch||0, yaw, 0, 'YXZ'); cam.fov=v.fov||65;
      G.time=v.t; G.setWeather('clear', true); Object.assign(G.weather, v.w||{}); G.weather.timer=1e9;
      await G.world.settle(v.x, v.z, A.Q.viewDist);
      G.env.probeT=0; G.tick(0.016); G.applyEnvironment(0.016, true); A.Pipeline.dirtyHistory=true;
      for (let i=0;i<40;i++) await new Promise(r=>requestAnimationFrame(r));
      return y`).then((y) => console.log(v.n, 'y', Number(y).toFixed(1)));
    await shot('v_' + v.n);
  }
  await check();
};
