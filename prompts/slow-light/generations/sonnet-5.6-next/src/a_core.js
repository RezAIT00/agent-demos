// ───────────────────────────── core: constants, physics timeline, camera ─────────────────────────────
const QS = new URLSearchParams(location.search);
const RENDER_MODE = QS.get('render') === '1';
const C_LIGHT = 5.0;                      // metres per second. The whole film.
const DURATION = 20.0;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const smoother = t => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const RNG = mulberry32(1888);
const rand = (a = 0, b = 1) => a + (b - a) * RNG();
const pick = arr => arr[Math.floor(RNG() * arr.length)];

// Camera path. At t = 2.000 s the camera is exactly 10.000 m from the bulb, so the bulb appears at t = 2 s.
function cameraAt(t) {
  const drift = t < 2 ? (2 - t) : 0;                           // slow dolly in the dark
  const late = Math.max(t - 2, 0);
  const crane = smoother((t - 8.6) / 12.4);
  const pos = V3(0.6 + 0.03 * drift - 0.006 * late,
                 2.3 + 1.75 * crane,
                 0.0 + 0.06 * drift - 0.013 * late + 0.25 * crane);
  const tgt = V3(-0.12 - 0.003 * late + 0.004 * drift, 3.50 + 0.42 * crane, -10.0);
  return { pos, tgt };
}
const FOV = 62;

// ── lamps ──  on/off are EMISSION times (when the source itself changes). What you see is later by path/c.
const LAMPS = [
  { name: 'bulb',    pos: V3(-3.0, 7.1, -8.0),     on: 0.0,  off: 12.05, color: [1.0, 0.495, 0.175], flare: [1.0, 0.87, 0.70], I: 122, radius: 0.05, shadow: 2048 },
  { name: 'lantern', pos: V3(-1.34, 3.60, -14.2),  on: 6.40, off: 12.42, color: [0.60, 0.95, 0.74], flare: [0.80, 1.0, 0.88], I: 17,  radius: 0.09, shadow: 1024 },
  { name: 'neon',    pos: V3(2.19, 3.36, -11.88),  on: 8.50, off: 12.30, color: [1.0, 0.10, 0.34],  flare: [1.0, 0.42, 0.55], I: 13,  radius: 0.20, shadow: 1024 },
];
const MOON_DIR = V3(0.62, 0.70, -0.30).normalize();

// ── actors see light-travel delay too: what the camera shows at time t is the object's state at t - dist/c
const poseTime = (t, p, camPos) => t - p.distanceTo(camPos) / C_LIGHT;
