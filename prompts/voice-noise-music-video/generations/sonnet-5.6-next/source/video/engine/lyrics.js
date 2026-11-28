// The sung line, told in the six noises: a caption plate that spells each sung
// syllable as the noise that sings it, mouth shapes that follow the vowel, and
// the kana pop-ups used by the verse shots. No words are stored anywhere.
'use strict';
const VOCAL = D.events.filter(e => (e.r === 'vocal' || (e.r === 'finalchord' && e.i === 'ahh')) && e.m != null).sort((a, b) => a.t - b.t);
const SYLL = VOCAL.filter(e => e.n === 1);

function vocalAt(t) {
  let hit = null;
  for (const e of VOCAL) { if (e.t > t) break; if (t < e.t + e.d) hit = e; }
  return hit;
}
// Mouth for the noise being sung right now.
function lip(t) {
  const n = vocalAt(t);
  if (!n) return { mouth: 'smile', open: 0 };
  const a = clamp((t - n.t) / 0.05), r = clamp((n.t + n.d - t) / 0.08), k = a * r * (0.86 + 0.14 * Math.sin(t * 34));
  switch (n.i) {
    case 'ooo': return { mouth: 'o', open: 0.25 + 0.55 * k };
    case 'eee': return k > 0.15 ? { mouth: 'grin', open: k } : { mouth: 'smile', open: 0 };
    case 'mmm': return { mouth: 'flat', open: 0 };
    case 'nyaa': return t - n.t < 0.09 ? { mouth: 'cat', open: 0.3 } : { mouth: 'open', open: 0.8 * k };
    case 'dum': return { mouth: 'open', open: 0.55 * k };
    default: return { mouth: 'open', open: k };
  }
}

const LYRIC_LINES = (() => {
  const by = new Map();
  for (const e of VOCAL) if (e.ln !== undefined) { if (!by.has(e.ln)) by.set(e.ln, []); by.get(e.ln).push(e); }
  return [...by.values()].map(ev => ({ ev, syl: ev.filter(e => e.n === 1), start: ev[0].t, end: Math.max(...ev.map(e => e.t + e.d)) }))
    .sort((a, b) => a.start - b.start);
})();
const niceName = id => SPIRITS[id].name[0] + SPIRITS[id].name.slice(1).toLowerCase();

function drawLyrics(g, t) {
  let L = null;
  for (const l of LYRIC_LINES) if (l.start - 0.45 <= t) L = l;
  if (!L || t > L.end + 0.7) return;
  const a = easeOut(prog(t, L.start - 0.45, L.start - 0.2)) * (1 - prog(t, L.end + 0.3, L.end + 0.7));
  if (a <= 0.01) return;
  const size = 54, gap = 30, cy = 975;
  g.save();
  g.font = `800 ${size}px ${FONT_EN}`; g.letterSpacing = '2px';
  const words = L.syl.map(e => niceName(e.i)), widths = words.map(w => g.measureText(w).width);
  const total = widths.reduce((s, w) => s + w, 0) + gap * (words.length - 1);
  const px = 44, left = 960 - total / 2 - px, plateW = total + px * 2;
  g.globalAlpha = a * 0.72; g.fillStyle = '#12052a';
  g.beginPath(); g.roundRect(left, cy - 52, plateW, 104, 26); g.fill();
  g.globalAlpha = a * 0.9; g.strokeStyle = '#ffffff'; g.lineWidth = 3;
  g.beginPath(); g.roundRect(left, cy - 52, plateW, 104, 26); g.stroke();
  let cur = -1;
  L.syl.forEach((e, i) => { if (e.t <= t) cur = i; });
  g.textBaseline = 'middle'; g.textAlign = 'left';
  let x = 960 - total / 2;
  L.syl.forEach((e, i) => {
    const c = SPIRITS[e.i], live = i === cur && t < e.t + Math.max(e.d, 0.3), past = i < cur || (i === cur && !live);
    const pop = live ? 1 + 0.2 * Math.exp(-(t - e.t) * 14) : 1;
    g.save(); g.translate(x + widths[i] / 2, cy + (live ? -4 : 0)); g.scale(pop, pop);
    g.globalAlpha = a * (live ? 1 : past ? 0.92 : 0.38);
    g.font = `800 ${size}px ${FONT_EN}`; g.letterSpacing = '2px'; g.textAlign = 'center';
    if (live) { g.strokeStyle = '#12052a'; g.lineWidth = 11; g.lineJoin = 'round'; g.strokeText(words[i], 0, 0); }
    g.fillStyle = live ? c.color : '#ffffff'; g.fillText(words[i], 0, 0);
    if (live) { g.globalAlpha = a * 0.9; g.fillStyle = c.light; g.fillRect(-widths[i] / 2, size * 0.58, widths[i] * clamp((t - e.t) / Math.max(e.d, 0.2)), 6); }
    g.restore();
    x += widths[i] + gap;
  });
  g.globalAlpha = a * 0.95; g.font = `800 23px ${FONT_EN}`; g.letterSpacing = '9px'; g.textAlign = 'center'; g.lineJoin = 'round';
  g.strokeStyle = '#12052a'; g.lineWidth = 7; g.strokeText('THE WORDS, SUNG BY THE NOISES', 960, cy - 74);
  g.fillStyle = '#ffffff'; g.fillText('THE WORDS, SUNG BY THE NOISES', 960, cy - 74);
  g.restore();
}

// kana pop-ups: each sung syllable bursts out of the spirit that sings it
function pops(g, t, where, { size = 120, life = 0.8, rise = 110 } = {}) {
  for (const e of SYLL) {
    const a = t - e.t;
    if (a < 0) break;
    if (a > life) continue;
    const c = SPIRITS[e.i], [x, y] = where(e, a);
    const k = backOut(clamp(a / 0.16), 2.6), fade = 1 - prog(a, life * 0.55, life);
    lettering(g, c.kana, x, y - rise * easeOut(a / life), size * k, { font: FONT_JP, fill: ['#ffffff', c.light, c.color], drop: c.dark, alpha: fade, rot: (((e.m * 7) % 5) - 2) * 0.05 });
  }
}
