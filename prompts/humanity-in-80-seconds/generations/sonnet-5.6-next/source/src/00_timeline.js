// THE TIME RULE — single source of truth for the rate schedule.
// Used by the film (index.html), the soundtrack synth and (read-only) the audit.
//
// Counter convention: astronomical year numbering, as a continuous number.
//   1 CE = 1, 1 BCE = 0, 2 BCE = -1, N BCE = 1 - N.
// This removes the missing "year 0" from the arithmetic: the counter is linear.
(function (root) {
  'use strict';

  const START_BCE = 300000;                 // t = 0  ->  300,000 BCE
  const START = 1 - START_BCE;              // astronomical: -299999
  const END = 2100;                         // t = 80 ->  2100 CE
  const DURATION = 80;
  const FPS = 24;
  const NOW_YEAR = 2026;
  const NOW_T = 65;                         // counter reaches 2026 exactly here

  // [seconds, years per second] — one entry per run of equal rates.
  const GEARS = [
    [6, 25000], [5, 12000], [7, 7000], [5, 3500], [3, 3000], [1, 2500],
    [4, 1500], [2, 1000], [5, 600], [4, 400], [2, 250], [1, 230], [7, 60],
    [3, 34], [1, 33], [4, 16], [1, 16], [4, 15],
    // ---- 2026: everything after this line is projection ----
    [2, 12], [2, 10], [1, 8], [1, 6], [1, 5], [1, 4], [7, 1],
  ];

  const RATES = [];
  for (const [n, r] of GEARS) for (let i = 0; i < n; i++) RATES.push(r);

  const BOUNDS = [START];                   // counter value at t = 0,1,...,80
  for (let i = 0; i < RATES.length; i++) BOUNDS.push(BOUNDS[i] + RATES[i]);

  if (RATES.length !== DURATION) throw new Error('need 80 slots, got ' + RATES.length);
  if (BOUNDS[DURATION] !== END) throw new Error('rates end at ' + BOUNDS[DURATION]);
  if (BOUNDS[NOW_T] !== NOW_YEAR) throw new Error('2026 is not at t=' + NOW_T);

  const slotAt = (t) => Math.min(DURATION - 1, Math.max(0, Math.floor(t + 1e-9)));

  // Exact counter value at time t (seconds). Linear inside each slot.
  function yearAt(t) {
    const tt = Math.min(DURATION, Math.max(0, t));
    const n = slotAt(tt);
    return BOUNDS[n] + RATES[n] * (tt - n);
  }
  function rateAt(t) { return RATES[slotAt(t)]; }

  // Inverse: the time at which the counter reaches an astronomical year.
  function timeOf(year) {
    if (year <= START) return 0;
    for (let n = 0; n < DURATION; n++) {
      if (year <= BOUNDS[n + 1]) return n + (year - BOUNDS[n]) / RATES[n];
    }
    return DURATION;
  }
  const bce = (n) => 1 - n;                 // N BCE -> astronomical

  const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // DISPLAY ROUNDING (documented in TREATMENT.md):
  //  1. y = floor(counter + 0.5)  (nearest whole year, halves up)
  //  2. y <= 0 is shown as BCE, N = 1 - y, always prefixed "c."
  //  3. N >= 10,000 is further rounded to the nearest 100 and comma-grouped;
  //     four-digit and shorter years are written without a comma
  //  4. y >= 1 is shown as the exact integer + "CE"
  function formatYear(counter) {
    const y = Math.floor(counter + 0.5 + 1e-7);
    if (y >= 1) return y + ' CE';
    let n = 1 - y;
    if (n >= 10000) return 'c. ' + group(Math.floor(n / 100 + 0.5) * 100) + ' BCE';
    return 'c. ' + n + ' BCE';
  }
  function formatRate(r) {
    return '1 second = ' + group(r) + (r === 1 ? ' year' : ' years');
  }

  const TL = {
    START_BCE, START, END, DURATION, FPS, NOW_YEAR, NOW_T,
    GEARS, RATES, BOUNDS, slotAt, yearAt, rateAt, timeOf, bce, formatYear, formatRate, group,
  };
  root.TL = TL;
  if (typeof module !== 'undefined' && module.exports) module.exports = TL;
})(typeof window !== 'undefined' ? window : globalThis);
