// 5.6 - 11 s : Africa. The ember feeds a campfire; then one of them carries it on.
(() => {
  const FIRE = { x: 960, y: 872 };
  const WALK_FROM = 8.75;

  // distance the leader has walked (px), easing into a steady pace
  const walked = (t) => {
    const u = Math.max(0, t - WALK_FROM);
    return u < 0.8 ? 190 * u * u : 190 * 0.64 + (u - 0.8) * 304;
  };
  const camX = (t) => {
    const u = Math.max(0, t - (WALK_FROM + 0.35));
    return u < 1.0 ? 150 * u * u : 150 + (u - 1) * 300;
  };

  const ground = (wx) => 868 + (fbm1(wx * 0.0021, 41, 3) - 0.5) * 46;

  defineScene('camp', 5.55, { kind: 'pull', dur: 1.15, center: [960, 800] }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    const cx = camX(t);
    const zoom = lerp(1.44, 1.19, easeOut(invLerp(5.0, 7.9, t))) + 0.02 * ramp(7.9, 9.0, t);
    const cam = { x: 0, y: 0, z: zoom, ax: 960, ay: 830 };

    env.sky = { top: '#030614', mid: '#0a1230', low: '#33244a', ground: '#140d18', horizon: 735, midAt: 0.56, milky: 1.0 };
    env.haze = { color: '#2a2142', amt: 0.30 };
    env.skyRim = '#7f9ae0'; env.skyRimAmt = 0.20;
    SKY.stars(back, t, { alpha: 0.95, pole: [1530, -250], horizon: 716, dx: -cx * 0.02 });

    // distant hills and trees
    withCam([far], cam, 0.35, () => {
      ridge(far, { y: 712, amp: 52, freq: 0.0021, seed: 3, scroll: cx * 0.12 + 200, color: '#150f24' });
      ridge(far, { y: 760, amp: 30, freq: 0.0034, seed: 9, scroll: cx * 0.22, color: '#0f0a18' });
    });
    withCam([far], cam, 0.6, () => {
      const wrap = (wx, k, span) => mod(wx - cx * k + 500, span) - 500;
      PROPS.acacia(far, wrap(238, 0.42, 3100), 786, 232, '#0b0711', 12);
      PROPS.baobab(far, wrap(1745, 0.42, 3100), 782, 210, '#0b0711', 4);
      PROPS.acacia(far, wrap(2420, 0.42, 3100), 790, 190, '#0b0711', 31);
      PROPS.acacia(far, wrap(1420, 0.3, 2900), 756, 108, '#100b1a', 7);
      PROPS.acacia(far, wrap(2760, 0.3, 2900), 752, 120, '#100b1a', 19);
    });

    const fk = flick(t, 2);
    const fireIn = ramp(5.0, 6.2, t);
    const [fx, fy, fz] = camPoint(cam, 1, FIRE.x - cx, FIRE.y);
    
    withCam([near, g], cam, 1, () => {
      // ground
      near.fillStyle = vgrad(near, 840, H, [[0, '#150b0a'], [1, '#050306']]);
      near.beginPath(); near.moveTo(-200, H + 100);
      for (let x = -200; x <= W + 200; x += 12) near.lineTo(x, ground(x + cx));
      near.lineTo(W + 200, H + 100); near.closePath(); near.fill();
      PROPS.grass(near, t, { y: 872, n: 90, h: 30, color: '#0d0708', seed: 81, scroll: cx, x1: W + 400, ground: (bx) => ground(bx + cx) });

      const lit0 = { x: FIRE.x - cx, y: FIRE.y - 50, r: 470, color: '#8f4318', k: 0.46 };
      const who = (o) => FIG.person(near, { color: '#160b09', far: '#0d0707', lit: lit0, t, ...o });

      // those who sit behind the fire
      const br = (k) => Math.sin(t * 1.7 + k) * 0.006;
      const mother = who({ x: 790 - cx, y: 852, h: 268, p: FIG.seat({ hip: [-0.05, 0.16 + br(1)], lean: 0.16, footA: [0.16, 0.04], footB: [0.1, 0.05], handA: [0.17, 0.34], handB: [0.12, 0.30], tilt: 0.28 }), dress: 'hide', cloth: '#1d0f0a', hair: 'bun' });
      near.save(); FIG.baby(near, mother.handA[0] - 8, mother.handA[1] - 8, 34, '#24120b', '#1a0d08', -0.35); near.restore();
      const grind = Math.sin(t * 5.2) * 0.03;
      who({ x: 1128 - cx, y: 850, h: 262, face: -1, p: FIG.kneel({ lean: 0.38 + grind * 0.5, handA: [0.25 + grind, 0.145], handB: [0.20 + grind * 0.7, 0.16], tilt: 0.2 }), dress: 'wrap', cloth: '#1d0f0a', hair: 'curls' });
      near.fillStyle = '#0e0807'; oval(near, 1062 - cx, 848, 30, 9);
      near.fillStyle = '#7a2512'; oval(near, 1062 - cx, 842, 14, 5);      // red ochre

      // the fire
      PROPS.logs(near, FIRE.x - cx, FIRE.y, 76);
      PROPS.coals(g, FIRE.x - cx, FIRE.y, 76, t, fireIn);
      glow(g, FIRE.x - cx, FIRE.y + 18, 380, '#8a360c', 0.17 * fk * fireIn);

      // front of the circle
      const gesture = Math.sin(t * 1.35);
      who({ x: 668 - cx, y: 905, h: 322, p: FIG.sit({ handA: [0.24 + 0.04 * gesture, 0.33 + 0.07 * gesture], handB: [0.13, 0.21], tilt: -0.06 + 0.05 * gesture, lean: 0.10 + br(2) }), dress: 'hide', cloth: '#1f100a', hair: 'curls' });
      const strike = Math.pow(Math.max(0, Math.sin(t * 5.6)), 6);
      const knap = who({ x: 1262 - cx, y: 906, h: 318, face: -1, p: FIG.crouch({ hip: [-0.1, 0.19], lean: 0.42, footA: [0.10, 0.035], footB: [-0.03, 0.035], handA: [0.24, 0.30 - strike * 0.07], handB: [0.22, 0.20], tilt: 0.25 }), dress: 'wrap', hair: 'short' });
      near.fillStyle = '#0c0707'; disc(near, knap.handB[0] - 4, knap.handB[1] + 3, 10);
      if (strike > 0.7) sparks(g, knap.handB[0] - 6, knap.handB[1], t, { n: 10, spread: 8, height: 50, size: 1.6, alpha: strike, seed: 71, speed: 3 });
      who({ x: 1418 - cx, y: 918, h: 212, face: -1, child: 0.8, p: FIG.sit({ lean: 0.30 + br(3), handA: [0.24, 0.20 + 0.02 * Math.sin(t * 2.2)], handB: [0.18, 0.18], tilt: -0.1 }), dress: 'wrap', hair: 'curls' });

      // the one who will carry it: sits, rises, lifts a branch, walks
      const rise = ramp(7.2, 8.0, t);
      const reach = pulse(7.8, 8.62, t, 0.36);
      const lift = ramp(8.3, 8.85, t);
      const walkMix = ramp(WALK_FROM, WALK_FROM + 0.45, t);
      const lx = 742 + walked(t) - cx;
      const phase = walked(t) / (FIG.cycleLength(0.36) * 340);
      const sitting = FIG.sit({ lean: 0.18, handA: [0.17, 0.24] });
      let standing = FIG.stand({
        hip: [0, 0.50 - reach * 0.12], lean: 0.05 + reach * 0.48,
        handA: [lerp(lerp(0.08, 0.40, reach), 0.20, lift), lerp(lerp(0.47, 0.26, reach), 0.72, lift)],
        footA: [0.09, 0.035], footB: [-0.09, 0.035],
      });
      if (walkMix > 0) standing = FIG.mix(standing, FIG.walk(phase, { over: { handA: [0.21, 0.73] }, lean: 0.07 }), walkMix);
      const pose = FIG.mix(sitting, standing, rise);
      const lead = who({ x: lx, y: lerp(912, ground(lx + cx) + 40, walkMix), h: 340, p: pose, dress: 'hide', cloth: '#1f100a', hair: 'curls' });
      let torch = null;
      if (reach > 0.4 || lift > 0) {
        const ang = lerp(0.55, -1.32, lift);
        torch = PROPS.torch(near, lead.handA[0], lead.handA[1], ang, 92);
      }
      // two follow
      const follow = (delay, x0, h, ch, hairK, dressK, babyOn) => {
        const rr = ramp(8.4 + delay, 9.2 + delay, t);
        if (rr <= 0) return;
        const d = walked(t - delay - 0.25);
        const ph = d / (FIG.cycleLength(0.36) * h) + delay;
        const m = ramp(WALK_FROM + delay + 0.25, WALK_FROM + delay + 0.7, t);
        const p = FIG.mix(FIG.sit(), FIG.mix(FIG.stand(), FIG.walk(ph), m), rr);
        const fxw = x0 + d - cx;
        const f = who({ x: fxw, y: lerp(905, ground(fxw + cx) + 46, m), h, child: ch, p, dress: dressK, cloth: '#1d0f0a', hair: hairK });
        if (babyOn) FIG.baby(near, f.shoulder[0] - 34, f.shoulder[1] + 8, 32, '#24120b', '#180c08', -1.0);
      };
      follow(0.30, 470, 300, 0, 'bun', 'hide', true);
      follow(0.55, 330, 214, 0.8, 'curls', 'wrap', false);

      PROPS.grass(near, t, { y: 975, n: 70, h: 58, color: '#060305', seed: 5, scroll: cx * 1.35, x1: W + 500, spreadY: 120 });

      if (torch) {
        const [tx, ty] = camPoint(cam, 1, torch[0], torch[1]);
        const ta = ramp(8.1, 8.5, t);
        env.flames.push({ x: tx, y: ty + 6, w: 30 * fz, h: 100 * fz * ta, i: 0.95, seed: 6, lean: -0.22 * walkMix, halo: 0.8 });
        env.lights.push({ x: tx, y: ty - 36, r: 400, i: 0.85 * ta * flick(t, 8), color: '#ff9a3c' });
        sparks(g, torch[0], torch[1] - 40, t, { n: 24, spread: 20, height: 200, size: 1.9, alpha: ta, wind: -120 * walkMix, seed: 13 });
      }
      sparks(g, FIRE.x - cx, FIRE.y - 90, t, { n: 70, spread: 90, height: 520, size: 2.4, alpha: 0.9 * fireIn, seed: 4 });
      sparks(g, FIRE.x - cx, FIRE.y - 160, t, { n: 22, spread: 220, height: 700, size: 1.5, alpha: 0.6 * fireIn, seed: 44, speed: 0.55 });
    });

    env.flames.unshift({ x: fx, y: fy - 12 * fz, w: 66 * fz, h: 196 * fz * (0.5 + 0.5 * fireIn) * (0.96 + 0.04 * fk), i: 1.0, seed: 1.3 });
    env.lights.unshift({ x: fx, y: fy - 66 * fz, r: 620 * fz, i: 0.95 * fk * fireIn, color: '#ff8a30' });
    env.bloom = 0.55; env.thresh = 0.68;
  });
})();
