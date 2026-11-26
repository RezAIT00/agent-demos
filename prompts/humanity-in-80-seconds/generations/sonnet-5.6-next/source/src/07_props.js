// Landscape props, all procedural.
const PROPS = {};

PROPS.acacia = (c, x, y, h, color, seed = 1) => {
  const r = rng(seed);
  c.fillStyle = color;
  const lean = (r() - 0.5) * h * 0.18;
  const forkY = y - h * (0.36 + r() * 0.1), forkX = x + lean * 0.5;
  chain(c, [[x, y + 6, h * 0.050], [x + lean * 0.12, y - h * 0.18, h * 0.030], [forkX, forkY, h * 0.024]]);
  const crowns = [];
  const n = 4 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    const ex = forkX + lean * 0.5 + u * h * 1.05 + (r() - 0.5) * h * 0.14;
    const ey = y - h * (0.84 + r() * 0.12) + Math.abs(u) * h * 0.10;
    const mx = lerp(forkX, ex, 0.45) + (r() - 0.5) * h * 0.12, my = lerp(forkY, ey, 0.62);
    chain(c, [[forkX, forkY, h * 0.022], [mx, my, h * 0.012], [ex, ey, h * 0.006]]);
    chain(c, [[mx, my, h * 0.008], [mx + (r() - 0.5) * h * 0.3, ey + h * 0.02, h * 0.003]]);
    crowns.push([ex, ey]);
  }
  for (const [ex, ey] of crowns) {
    for (let k = 0; k < 24; k++) {
      const u = r() - 0.5;
      oval(c, ex + u * h * 0.50, ey - h * 0.015 + (r() - 0.72) * h * 0.085 * (1 - u * u * 2), h * (0.045 + r() * 0.055), h * (0.012 + r() * 0.017), (r() - 0.5) * 0.25);
    }
  }
};

PROPS.baobab = (c, x, y, h, color, seed = 4) => {
  const r = rng(seed);
  c.fillStyle = color;
  blob(c, [[x - h * 0.20, y + 6], [x - h * 0.13, y - h * 0.22], [x - h * 0.15, y - h * 0.50], [x - h * 0.07, y - h * 0.66], [x + h * 0.07, y - h * 0.66], [x + h * 0.15, y - h * 0.48], [x + h * 0.12, y - h * 0.2], [x + h * 0.21, y + 6]], 0.8);
  const branch = (bx, by, ang, len, w, depth) => {
    const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
    chain(c, [[bx, by, w], [ex, ey, w * 0.52]]);
    if (depth > 0) {
      branch(ex, ey, ang - 0.35 - r() * 0.5, len * 0.70, w * 0.5, depth - 1);
      branch(ex, ey, ang + 0.30 + r() * 0.5, len * 0.66, w * 0.5, depth - 1);
    } else for (let i = 0; i < 4; i++) oval(c, ex + (r() - 0.5) * h * 0.08, ey + (r() - 0.5) * h * 0.04, h * 0.022, h * 0.012, r());
  };
  for (let i = 0; i < 5; i++) branch(x + (i - 2) * h * 0.055, y - h * 0.62, -PI / 2 + (i - 2) * 0.42, h * (0.17 + r() * 0.06), h * 0.035, 2);
};

// swaying tufts of grass along a baseline
PROPS.grass = (c, t, o) => {
  const { y, n = 120, h = 40, color, seed = 8, x0 = -60, x1 = W + 60, scroll = 0, sway = 1, ground = null, spreadY = 18 } = o;
  c.fillStyle = color;
  const span = x1 - x0;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const bx = x0 + mod(hash2(i, seed) * span - scroll, span);
    const gy = (ground ? ground(bx) : y) + hash2(i, seed + 1) * spreadY;
    const blades = 4 + (hash2(i, seed + 2) * 5 | 0);
    const hh = h * (0.45 + hash2(i, seed + 3) * 0.8);
    for (let k = 0; k < blades; k++) {
      const u = k / (blades - 1) - 0.5;
      const tipX = bx + u * hh * 1.1 + Math.sin(t * 1.7 + bx * 0.013 + k) * hh * 0.09 * sway;
      const tipY = gy - hh * (1 - Math.abs(u) * 0.55) * (0.75 + hash2(i * 7 + k, seed) * 0.4);
      c.moveTo(bx + u * 8 - 2.2, gy + 4);
      c.quadraticCurveTo(bx + u * hh * 0.3, gy - hh * 0.5, tipX, tipY);
      c.quadraticCurveTo(bx + u * hh * 0.3 + 2.5, gy - hh * 0.45, bx + u * 8 + 2.2, gy + 4);
    }
  }
  c.fill();
};

PROPS.logs = (c, x, y, s, color = '#100805') => {
  c.fillStyle = color;
  chain(c, [[x - s * 1.0, y + s * 0.10, s * 0.13], [x + s * 0.42, y - s * 0.20, s * 0.09]]);
  chain(c, [[x + s * 1.02, y + s * 0.12, s * 0.13], [x - s * 0.38, y - s * 0.22, s * 0.09]]);
  chain(c, [[x - s * 0.55, y + s * 0.22, s * 0.11], [x + s * 0.66, y + s * 0.18, s * 0.10]]);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU;
    oval(c, x + Math.cos(a) * s * 1.22, y + s * 0.16 + Math.sin(a) * s * 0.26, s * 0.19, s * 0.12, hash(i) - 0.5);
  }
};
PROPS.coals = (g, x, y, s, t, a = 1) => {
  for (let i = 0; i < 16; i++) {
    const cx = x + (hash(i + 61) - 0.5) * s * 1.2, cy = y + (hash(i + 62) - 0.3) * s * 0.24;
    glow(g, cx, cy, s * (0.10 + hash(i + 63) * 0.09), '#ff6a14', a * (0.45 + 0.4 * noise1(t * 4 + i, i)));
  }
};

// a hand-held burning branch; returns the flame position
PROPS.torch = (c, hx, hy, ang, len, color = '#100805') => {
  const tx = hx + Math.cos(ang) * len, ty = hy + Math.sin(ang) * len;
  c.fillStyle = color;
  chain(c, [[hx - Math.cos(ang) * len * 0.28, hy - Math.sin(ang) * len * 0.28, len * 0.040], [tx, ty, len * 0.062]]);
  return [tx, ty];
};

PROPS.rock = (c, x, y, w, h, color, seed = 1) => {
  const r = rng(seed);
  c.fillStyle = color;
  const pts = [[x - w / 2, y + 4]];
  for (let i = 1; i < 7; i++) {
    const u = i / 7;
    pts.push([x - w / 2 + u * w + (r() - 0.5) * w * 0.12, y - h * Math.sin(u * PI) * (0.65 + r() * 0.5)]);
  }
  pts.push([x + w / 2, y + 4]);
  blob(c, pts, 0.35);
};
