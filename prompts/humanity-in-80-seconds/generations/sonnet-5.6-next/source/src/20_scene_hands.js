// The gesture that opens the film and closes it: an ember tipped from one pair
// of cupped hands into a child's. `o.late` is the 2100 version.
function handoff(S, p) {
  // p: { breath 0..1, rise 0..1, tip 0..1, lift 0..1, push 0..1, late, proj }
  const { t, env } = S;
  const late = !!p.late;
  const tip = p.tip, rise = easeOut(p.rise), lift = smooth(p.lift || 0);
  const tipK = smooth(clamp(tip * 1.55));
  const away = smooth(invLerp(0.72, 1.0, tip));
  // in 2100 the old hands let go completely, and leave the frame
  const gone = late ? easeInOut(clamp(invLerp(0.0, 0.78, p.lift || 0))) : 0;

  const giver = {
    pos: [lerp(-8.6, -6.9, tipK) - away * 4.6 - gone * 25, lerp(0.9, 3.9, tipK) + away * 1.4 + gone * 1.2, -gone * 5],
    yaw: 0, pitch: lerp(0.05, -0.50, tipK) + away * 0.22 + gone * 0.20,
    curl: late ? 0.92 : 0.98, scale: 1.0, age: late ? 1.0 : 0.16, tone: late ? 0.52 : 0.22,
  };
  const recv = {
    pos: [lerp(19, 7.7, rise) - lift * (late ? 7.4 : 5.2), lerp(-19, -4.7, rise) + lift * (late ? 4.4 : 4.6), lift * (late ? 6.0 : 3.0)],
    // the child turns toward us as they raise it
    yaw: PI + (late ? lift * 0.50 : 0), pitch: lerp(0.30, 0.04, rise) - lift * 0.06,
    curl: 1.04, scale: 0.72, child: 0.85, age: 0, tone: late ? 0.58 : 0.36,
  };

  // ember: rests in the old bowl, rolls off the fingertips, settles in the new one
  const a = HANDS.bowlPoint(giver, [7.4, 1.95, 0]);
  const lip = HANDS.bowlPoint(giver, [14.4, 3.4, 0]);
  const catchP = HANDS.bowlPoint(recv, [11.6, 3.9, 0]);
  const rest = HANDS.bowlPoint(recv, [7.2, 2.35, 0]);
  const roll = invLerp(0.20, 0.82, tip);
  const along = [a, lip, catchP, rest];
  let e;
  if (roll <= 0) e = a;
  else if (roll >= 1) e = rest;
  else {
    const k = roll * 3, i = Math.min(2, Math.floor(k)), f = smooth(k - i);
    const P = along[i], Q = along[i + 1];
    e = [lerp(P[0], Q[0], k - i), lerp(P[1], Q[1], f) + (i === 1 ? Math.sin((k - i) * PI) * 0.5 : 0), lerp(P[2], Q[2], f)];
  }
  const emberR = late ? 1.22 : 1.18;
  const I = p.intensity * flick(t, 5);

  const push = p.push || 0;
  const sc = {
    hands: [...HANDS.bowl(giver), ...(p.rise > 0.001 ? HANDS.bowl(recv) : [])],
    ember: [e[0], e[1], e[2], emberR], emberI: I,
    eye: [lerp(-1.2, 0.8, push), lerp(27.5, 25.5, push), lerp(50, 46, push)],
    at: [lerp(-1.6, 0.4, push), lerp(0.9, 0.9, push), 0],
    zoom: lerp(1.94, 2.10, push),
    skyA: late ? '#050a1a' : '#03040b', skyB: late ? '#0b0f1e' : '#0a0709',
    rim: late ? '#7096d8' : '#4a66ac',
    proj: p.proj || 0, solidR: p.solidR || 9,
    amb: late ? 0.02 : 0.008,
  };
  // at the very end the giver's hands may be gone from the frame
  env.bg = 'hands';
  env.hands = sc;
  const [ex, ey] = HANDS.project(sc, e);
  env.bloom = 0.66; env.thresh = 0.70; env.vig = 0.34;
  return { sc, ex, ey, I, e };
}

// 0.0 - 5.6 s : out of the dark
defineScene('ember', 0, null, (S) => {
  const { t, back, glow: g } = S;
  const breath = ramp(0.35, 1.55, t);
  const intensity = 0.27 + 0.07 * ramp(0.02, 0.3, t) * (1 - ramp(0.5, 0.8, t))
    + breath * (0.68 + 0.20 * Math.sin(PI * invLerp(0.45, 2.1, t)));
  SKY.stars(back, t, { alpha: 0.12 + 0.55 * ramp(1.2, 3.8, t), pole: [1560, -300], density: 0.65 });
  const H_ = handoff(S, {
    rise: invLerp(1.45, 3.05, t), tip: invLerp(2.95, 4.65, t), lift: invLerp(4.7, 6.2, t),
    push: ramp(0, 5.6, t), intensity,
  });
  const lit = ramp(0.1, 1.4, t);
  sparks(g, H_.ex, H_.ey - 20, t, { n: 26, spread: 50, height: 330, size: 2.2, alpha: 0.85 * lit, seed: 21 });
  sparks(g, H_.ex, H_.ey, t, { n: 12, spread: 130, height: 560, size: 1.5, alpha: 0.55 * lit, seed: 5, speed: 0.6 });
  // breath: a few motes carried toward the ember
  const b = pulse(0.42, 1.7, t, 0.35);
  if (b > 0) {
    for (let i = 0; i < 26; i++) {
      const f = mod(t * 0.9 + hash(i + 40), 1);
      const sx = H_.ex - 330 + f * 330 + (hash(i + 7) - 0.5) * 90 * (1 - f);
      const sy = H_.ey - 150 + f * 140 + (hash(i + 9) - 0.5) * 110 * (1 - f);
      glow(g, sx, sy, 7, '#ffc27a', b * 0.16 * Math.sin(f * PI));
    }
  }
});
