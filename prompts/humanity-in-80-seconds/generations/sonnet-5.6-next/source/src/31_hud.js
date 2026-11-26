// The two numbers that never leave the screen, plus the captions.
const HUD = (() => {
  const X = 78, YEAR_BASE = 128, YEAR_SIZE = 66, RATE_BASE = 194, RATE_SIZE = 35;

  // last time (<= t) at which the rate changed
  const CHANGES = [0];
  for (let n = 1; n < TL.DURATION; n++) if (TL.RATES[n] !== TL.RATES[n - 1]) CHANGES.push(n);
  const lastChange = (t) => { let c = 0; for (const x of CHANGES) if (x <= t + 1e-9) c = x; return c; };

  // Draw the counter block for the given strings. (The audit calls this with its
  // own independently formatted strings and compares pixels.)
  function counter(ctx, t, yearText, rateText) {
    const proj = t >= TL.NOW_T - 1e-9;
    const tc = lastChange(t);
    const age = t - tc;
    const kick = tc > 0 ? 1 - clamp(age / 0.55) : 0;      // gear-change impulse
    const n = TL.slotAt(t);

    // soft scrim so both numbers hold up on bright skies
    ctx.save();
    ctx.translate(250, 140); ctx.scale(1, 0.40);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 640);
    g.addColorStop(0, 'rgba(2,3,10,0.56)'); g.addColorStop(0.55, 'rgba(2,3,10,0.36)'); g.addColorStop(1, 'rgba(2,3,10,0)');
    ctx.fillStyle = g; ctx.fillRect(-640, -640, 1280, 1280);
    ctx.restore();

    const yearColor = proj ? '#cdeeff' : '#fff6e8';
    FONT.draw(ctx, yearText, X, YEAR_BASE, YEAR_SIZE, { color: yearColor, weight: 8.0, track: 8 });

    // rate line: "1 second =" quiet, the amount bright
    const cut = rateText.indexOf('=') + 1;
    const head = rateText.slice(0, cut) + ' ', tail = rateText.slice(cut + 1);
    const drop = -13 * (1 - easeOut(age / 0.28)) * (tc > 0 ? 1 : 0);
    const hot = M(proj ? '#8fe0ff' : '#ffb454', '#ffffff', Math.pow(kick, 1.5));
    const hw = FONT.draw(ctx, head, X + 2, RATE_BASE + drop, RATE_SIZE, { color: proj ? '#a9c4d8' : '#d9cdbb', weight: 3.9 });
    const sp = FONT.measure(' ', RATE_SIZE) * 0.45;
    FONT.draw(ctx, tail, X + 2 + hw + sp, RATE_BASE + drop, RATE_SIZE * (1 + 0.13 * Math.pow(kick, 2)), { color: hot, weight: 4.3 + 1.4 * kick });

    // gear bar: log scale from 1 to 100,000 years per second
    const NT = 25;
    const lit = 1 + Math.round(Math.log10(TL.RATES[n]) / 5 * (NT - 1));
    const prevLit = tc > 0 ? 1 + Math.round(Math.log10(TL.RATES[tc - 1]) / 5 * (NT - 1)) : lit;
    for (let i = 0; i < NT; i++) {
      const x = X + 3 + i * 17.2;
      const on = i < lit;
      const dropping = !on && i < prevLit;
      ctx.save();
      ctx.globalAlpha = on ? 0.95 : dropping ? 0.22 + 0.75 * kick : 0.22;
      ctx.fillStyle = on ? (proj ? '#8fe0ff' : '#ffb454') : dropping ? '#ffffff' : '#c8cfe0';
      const hh = (on ? 11 : 7) + (i === lit - 1 ? 7 * kick + 3 : 0);
      ctx.beginPath(); ctx.roundRect(x, 219 - hh / 2, 9, hh, 3); ctx.fill();
      ctx.restore();
    }

    if (proj) {
      const a = ramp(TL.NOW_T, TL.NOW_T + 0.5, t) * 0.85 + 0.15;
      const label = 'PROJECTION';
      const size = 27, tx = X + 3, ty = 273;
      const wlab = FONT.measure(label, size, 16);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(4,12,24,0.55)';
      ctx.beginPath(); ctx.roundRect(tx - 4, ty - 40, wlab + 36, 52, 10); ctx.fill();
      ctx.setLineDash([8, 7]); ctx.lineDashOffset = -t * 12;
      ctx.strokeStyle = '#9fe4ff'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.roundRect(tx - 4, ty - 40, wlab + 36, 52, 10); ctx.stroke();
      ctx.restore();
      FONT.draw(ctx, label, tx + 14, ty - 1, size, { color: '#c9f0ff', weight: 3.2, track: 16, alpha: a, halo: 0 });
    }
  }

  // ---- captions ----------------------------------------------------------
  // [t0, t1, options, lines]; each line: [text, size, color?, weight?, track?]
  const WHITE = '#fff4e4', SOFT = '#d8d2c8', WARM = '#ffc47a', COOL = '#c4ecff';
  const CAPS = [
    [1.35, 4.9, { y: 978 }, [['AFRICA', 48, WHITE, 5.2, 30]]],
    [13.0, 14.6, { follow: 'ARABIA' }, [['ARABIA', 40, WHITE, 4.4, 18]]],
    [14.4, 16.3, { follow: 'ASIA' }, [['ASIA', 40, WHITE, 4.4, 18]]],
    [16.5, 18.0, { follow: 'AUSTRALIA' }, [['AUSTRALIA', 40, WHITE, 4.4, 18]]],
    [17.05, 18.0, { follow: 'EUROPE' }, [['EUROPE', 40, WHITE, 4.4, 18]]],
    [24.7, 26.85, { y: 932 }, [['into the Americas', 52, WHITE], ['by c. 13,000 BCE', 42, WARM]]],
    [28.0, 29.85, { y: 350 }, [['farming begins', 50, WHITE]]],
    [30.65, 33.35, { y: 350 }, [['invented again and again, worlds apart', 46, WHITE]]],
    [34.35, 35.55, { x: 470, y: 935 }, [['writing', 60, WHITE], ['c. 3200 BCE', 42, WARM]]],
    [39.3, 41.7, { y: 972 }, [['roads carry goods and ideas', 46, WHITE]]],
    [42.9, 45.08, { y: 926 }, [['Pacific voyagers reach Aotearoa', 48, WHITE], ['by c. 1300 CE', 42, WARM]]],
    [45.25, 46.92, { x: 700, y: 360 }, [['1347–1351', 60, WARM, 6.4], ['plague kills tens of millions', 46, WHITE]]],
    [47.2, 48.98, { y: 300 }, [['1492', 70, WARM, 7.2], ['in the Americas, disease and', 44, WHITE], ['conquest kill millions', 44, WHITE]]],
    [49.15, 51.9, { y: 318 }, [['12.5 million Africans', 66, WHITE, 6.6], ['forced onto slave ships', 48, SOFT], ['1500s – 1860s', 44, WARM]]],
    [55.45, 56.75, { y: 962 }, [['electric light, 1880s', 46, WHITE]]],
    [57.08, 58.12, { y: 944 }, [['1914 – 1945', 56, WARM, 6], ['two world wars', 46, WHITE]]],
    [58.16, 59.68, { y: 912 }, [['six million Jews murdered', 52, WHITE], ['in the Holocaust', 52, WHITE]]],
    [59.74, 60.3, { y: 972 }, [['1945', 64, WHITE, 6.6]]],
    [61.2, 61.88, { x: 1560, y: 985 }, [['1969', 70, WHITE, 7.4]]],
    [62.04, 62.92, { y: 988 }, [['1980: smallpox is gone', 48, WHITE]]],
    [65.0, 66.4, { x: 1250, y: 156, sweep: true }, [['2026 · NOW', 72, '#ffffff', 7.6], ['8.3 billion of us', 42, COOL]]],
    [65.5, 67.86, { x: 1170, y: 352 }, [['A child born this year', 54, WHITE], ['will be 74 in 2100.', 54, WARM]]],
    [67.94, 69.9, { x: 1100, y: 344 }, [['by 2100: about 2.5°C hotter', 52, COOL], ['higher seas, most coral reefs lost', 46, WHITE]]],
    [69.98, 71.5, { x: 1100, y: 322 }, [['AI is everywhere.', 52, COOL], ['Who it serves is our choice.', 46, WHITE]]],
    [71.58, 73.3, { x: 1100, y: 344 }, [['2080s: about 10 billion of us,', 50, COOL], ['perhaps the most ever', 46, WHITE]]],
  ];

  // positions for the labels that ride on the globe are filled in by that scene
  const anchors = {};
  // labels that travel with the picture (farm bands, early cities)
  const riding = [];

  function ridingLabels(ctx) {
    for (const L of riding) {
      let yy = L.y;
      L.lines.forEach(([text, size, color, track], i) => {
        if (i > 0) yy += size * 1.7;
        FONT.draw(ctx, text, L.x, yy, size, { align: 'center', color, weight: size * 0.108, track: track ?? 7, alpha: L.a, halo: 0.72 });
      });
    }
  }

  function captions(ctx, t) {
    for (const [t0, t1, o, lines] of CAPS) {
      if (t < t0 || t >= t1 || !lines.length) continue;
      const a = Math.min(ramp(t0, t0 + 0.16, t), 1 - ramp(t1 - 0.16, t1, t));
      let x = o.x ?? 960, y = o.y ?? 940;
      if (o.follow) {
        const p = anchors[o.follow];
        if (!p || p.t !== t) continue;
        x = p.x; y = p.y;
      }
      const reveal = clamp((t - t0) / 0.34);
      // a soft pool of shade behind the words
      if (!o.follow && !o.sweep) {
        const wmax = Math.max(...lines.map((l) => FONT.measure(l[0], l[1], l[4] ?? 7)));
        const hgt = lines.reduce((s, l) => s + l[1] * 1.62, 0);
        ctx.save();
        ctx.translate(x, y - lines[0][1] * 0.5 + hgt * 0.36);
        const rx = wmax / 2 + 190, ry = hgt / 2 + 74;
        ctx.scale(rx, ry);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, `rgba(2,3,9,${0.62 * a})`); g.addColorStop(0.55, `rgba(2,3,9,${0.40 * a})`); g.addColorStop(1, 'rgba(2,3,9,0)');
        ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      }
      let yy = y;
      lines.forEach(([text, size, color = WHITE, weight, track], i) => {
        if (i > 0) yy += size * 1.62;
        FONT.draw(ctx, text, x, yy, size, {
          align: 'center', color, weight: weight ?? size * 0.103, track: track ?? 7, alpha: a, reveal,
        });
      });
    }
  }

  // title card at the very end
  function title(ctx, t) {
    const a = ramp(78.25, 79.0, t);
    if (a <= 0) return;
    const y = 944;
    ctx.save();
    ctx.translate(960, y - 28); ctx.scale(760, 150);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(2,3,9,${0.55 * a})`); g.addColorStop(1, 'rgba(2,3,9,0)');
    ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    FONT.draw(ctx, 'THE SAME FIRE', 960, y, 62, {
      align: 'center', color: '#fff1da', weight: 5.8, track: 34, alpha: a, reveal: clamp((t - 78.25) / 0.85),
    });
  }

  function draw(t) {
    const ctx = GFX.layers.hud;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ridingLabels(ctx);
    captions(ctx, t);
    title(ctx, t);
    const yearText = TL.formatYear(TL.yearAt(t));
    const rateText = TL.formatRate(TL.rateAt(t));
    counter(ctx, t, yearText, rateText);
    return { year: yearText, rate: rateText };
  }

  return { draw, counter, captions, anchors, riding, CAPS, REGION: { x: 0, y: 0, w: 1100, h: 290 } };
})();
