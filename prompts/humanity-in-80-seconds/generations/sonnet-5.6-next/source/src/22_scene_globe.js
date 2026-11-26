// 11 - 18 s : out of Africa to Asia, Australia and Europe.
// 25.2 - 27 s : into the Americas.
(() => {
  const R = {
    south: GLOBE.route('37,6 33,-4 28,-13 26,-22 22,-31', 2),
    west: GLOBE.route('37,6 27,6 17,8 6,10 -4,12 -13,13', 3),
    north: GLOBE.route('37,6 34,15 32,23 31,29', 4),
    arabia: GLOBE.route('37,6 41,10.5 43.4,12.6 47,14.5 53,17 58,21.5 56.5,25.5', 5),
    india: GLOBE.route('56.5,25.5 62,25.8 68,24.5 73,19 76,11 79,11 80.5,16 86,20.5 89,23', 6),
    sunda: GLOBE.route('89,23 95,20 100,15 101,7 103,2 102,-1 105,-4 107,-6.6 112,-7.4 115,-8.4', 7),
    sahul: GLOBE.route('115,-8.4 120,-8.6 125,-8.9 130,-12 133,-15 135,-21 139,-28 146,-34', 8),
    sulawesi: GLOBE.route('109,0 114,0 118,-1.5 120.5,-3.5', 9),
    guinea: GLOBE.route('120.5,-3.5 128,-2.5 134,-2.5 139,-4.5 145,-6', 10),
    centre: GLOBE.route('56.5,25.5 57,31 60,37 68,41 78,45 88,48 98,45 108,40 115,35 119,31', 11),
    east: GLOBE.route('101,15 106,19 111,23 118,28 121,34 127,37 134,35 139,36', 12),
    europe: GLOBE.route('31,29 35,32 36,36 32,39 27,41 22,43 18,46 12,48 5,47 0,44 -5,40', 13),
    europeN: GLOBE.route('18,46 23,51 31,53 40,56 50,56', 14),
  };
  // [route, start, end]
  const PLAN = [
    ['south', 11.0, 12.7], ['west', 11.15, 13.0], ['north', 11.4, 13.2],
    ['arabia', 11.8, 13.4], ['india', 13.3, 14.9], ['sunda', 14.7, 15.95], ['sahul', 15.9, 17.15],
    ['sulawesi', 15.55, 16.2], ['guinea', 16.2, 17.0], ['centre', 14.6, 17.0], ['east', 15.7, 17.2],
    ['europe', 15.35, 17.55], ['europeN', 16.6, 17.8],
  ];
  // name, lon, lat, label offset in px
  const LABELS = [['ARABIA', 47, 22, 6, -40], ['ASIA', 90, 36, 0, -40], ['AUSTRALIA', 134, -25, 0, -42], ['EUROPE', 8, 46, -118, 14]];

  const camPath = [
    [10.2, [33, 4, 345, 660]], [11.6, [34, 6, 430, 630]], [13.1, [49, 12, 482, 628]], [14.5, [74, 13, 488, 624]],
    [15.7, [100, 3, 492, 622]], [16.75, [104, 6, 482, 624]], [17.45, [76, 14, 470, 628]], [18.0, [102, 4, 690, 600]],
    [18.5, [120.2, -3.2, 1900, 560]],
  ];

  defineScene('spread', 10.95, { kind: 'pull', dur: 1.2, center: [960, 640] }, (S) => {
    const { t, env, back, glow: g } = S;
    const k = keys(camPath, t);
    const vw = GLOBE.view(k[0], k[1], 960, k[3], k[2], 0);
    env.bg = 'globe';
    env.globe = vw;
    env.sky = { top: '#010208', mid: '#03050f', low: '#050816', horizon: 2000, midAt: 0.5, milky: 0.55 };
    SKY.stars(back, t, { alpha: 0.75, pole: [1760, -380], horizon: 2000, density: 0.8 });
    PLAN.forEach(([name, a, b]) => {
      GLOBE.drawRoute(g, vw, R[name], invLerp(a, b, t), { t, width: 2.7 });
    });
    // the first light: East Africa
    const o = vw.at(37, 6);
    if (o.z > 0) {
      const a = o.z * (1 - 0.55 * ramp(13.0, 14.5, t));
      glow(g, o.x, o.y, 72, '#ff9a34', 0.85 * a * flick(t, 3));
      g.fillStyle = '#fff2d4'; disc(g, o.x, o.y, 4.5);
      env.flames.push({ x: o.x, y: o.y + 4, w: 9, h: 30 * (1 - 0.4 * ramp(12, 13.5, t)), i: 0.95 * a, seed: 3, halo: 0.6 });
    }
    for (const [name, lon, lat, ox, oy] of LABELS) {
      const p = vw.at(lon, lat);
      if (p.z > 0.2) HUD.anchors[name] = { x: p.x + ox, y: Math.max(340, p.y + oy), t };
    }
    env.bloom = 0.62; env.thresh = 0.6; env.vig = 0.22;
  });

  const am = GLOBE.route('128,62 142,66 158,67 170,66 180,66 -170,65.5 -160,64 -150,62 -140,60 -133,55 -126,49 -124,43 -121,36 -112,28 -103,20 -92,15 -84,10 -78,5 -78,-2 -78,-9 -72,-16 -71,-25 -73,-33 -74,-41', 21);
  const inland = GLOBE.route('-126,49 -115,50 -103,46 -92,41 -81,38 -75,41', 22);
  const amazon = GLOBE.route('-78,5 -68,4 -60,-3 -50,-8 -42,-12', 23);
  const sib = GLOBE.route('88,48 100,54 112,60 128,62', 24);

  defineScene('americas', 25.45, { kind: 'pull', dur: 0.9, center: [960, 700] }, (S) => {
    const { t, env, back, glow: g } = S;
    const k = keys([[24.8, [152, 60, 560, 640]], [25.6, [-176, 55, 500, 620]], [26.25, [-122, 33, 470, 610]], [27.1, [-86, 4, 455, 600]]], t > 24 ? t : 24);
    // unwrap the antimeridian so the camera turns the short way
    const lonKeys = [[24.8, 152], [25.6, 184], [26.25, 240], [27.1, 276]];
    const lon = keys(lonKeys, t);
    const vw = GLOBE.view(lon, k[1], 960, k[3], k[2], 0);
    env.bg = 'globe';
    env.globe = vw;
    env.sky = { top: '#010208', mid: '#03050f', low: '#050816', horizon: 2000, midAt: 0.5, milky: 0.55 };
    SKY.stars(back, t, { alpha: 0.75, pole: [200, -380], horizon: 2000, density: 0.8 });
    GLOBE.drawRoute(g, vw, sib, invLerp(24.7, 25.2, t), { t, width: 2.7 });
    GLOBE.drawRoute(g, vw, am, invLerp(25.1, 26.8, t), { t, width: 3.0 });
    GLOBE.drawRoute(g, vw, inland, invLerp(25.85, 26.7, t), { t, width: 2.6 });
    GLOBE.drawRoute(g, vw, amazon, invLerp(26.35, 26.95, t), { t, width: 2.6 });
    env.bloom = 0.62; env.thresh = 0.6; env.vig = 0.22;
  });
})();
