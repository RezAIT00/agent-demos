// ================================================================ interface: title, HUD, inventory screens, menus
const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const UI = {
  screen: null, cursor: null, container: null, craftGrid: [], craftSize: 2, craftOut: null, hotbarKey: '', debug: false, toastT: 0, nameT: 0, lastSel: -1, lastHeld: '', biomeT: 0, lastBiome: -1,
  init() {
    this.root = document.getElementById('ui');
    this.root.innerHTML = '';
    // ---- HUD
    const hud = this.hud = el('div', 'hud hidden', this.root);
    el('div', 'crosshair', hud);
    this.progress = el('div', 'dig-ring', hud);
    this.vignette = el('div', 'hurt', hud);
    const bottom = el('div', 'hud-bottom', hud);
    this.nameTag = el('div', 'item-name', bottom);
    this.airRow = el('div', 'pips air', bottom);
    const vit = el('div', 'vitals', bottom);
    this.healthRow = el('div', 'pips health', vit);
    this.hungerRow = el('div', 'pips hunger', vit);
    this.hotbar = el('div', 'hotbar', bottom);
    this.hotSlots = [];
    for (let i = 0; i < 9; i++) { const s = this._slotEl(this.hotbar); el('em', null, s, String(i + 1)); this.hotSlots.push(s); }
    for (const [row, n] of [[this.healthRow, 10], [this.hungerRow, 10], [this.airRow, 10]]) for (let i = 0; i < n; i++) el('i', null, el('span', null, row));
    this.toastEl = el('div', 'toast', hud);
    this.biomeEl = el('div', 'biome-title', hud);
    this.modeTag = el('div', 'mode-tag', hud);
    this.hint = el('div', 'hint', hud);
    this.debugEl = el('pre', 'debug hidden', this.root);
    this.layer = el('div', 'layer', this.root);
    this.cursorEl = el('div', 'cursor-stack hidden', this.root);
    this.tip = el('div', 'tooltip hidden', this.root);
    addEventListener('mousemove', (e) => {
      this.cursorEl.style.transform = `translate(${e.clientX - 24}px, ${e.clientY - 24}px)`;
      this.tip.style.transform = `translate(${Math.min(innerWidth - 220, e.clientX + 16)}px, ${e.clientY + 18}px)`;
    });
  },
  _slotEl(parent) { const s = el('div', 'slot', parent); el('img', null, s).draggable = false; el('b', null, s); el('u', null, el('s', null, s)); s.querySelector('img').style.visibility = 'hidden'; return s; },
  _paint(node, stack) {
    const key = stack ? stack.k + '|' + stack.n + '|' + (stack.d === undefined ? '' : Math.ceil(stack.d)) : '';
    if (node._key === key) return;
    node._key = key;
    const img = node.querySelector('img'), b = node.querySelector('b'), s = node.querySelector('s');
    if (!stack) { img.style.visibility = 'hidden'; b.textContent = ''; s.style.display = 'none'; return; }
    img.src = Icons.get(stack.k); img.style.visibility = 'visible';
    b.textContent = stack.n > 1 ? stack.n : '';
    const it = ITEMS[stack.k];
    if (it.durability && stack.d !== undefined && stack.d < it.durability) { s.style.display = 'block'; const f = stack.d / it.durability; s.firstChild.style.width = (f * 100) + '%'; s.firstChild.style.background = `hsl(${f * 110}, 70%, 55%)`; } else s.style.display = 'none';
  },
  toast(text, dur = 2.6) { this.toastEl.textContent = text; this.toastEl.classList.add('show'); this.toastT = dur; },

  updateHUD(dt, game) {
    const p = game.player;
    this.toastT -= dt; if (this.toastT <= 0) this.toastEl.classList.remove('show');
    if (!p) return;
    for (let i = 0; i < 9; i++) { this._paint(this.hotSlots[i], p.inventory.slots[i]); this.hotSlots[i].classList.toggle('sel', i === p.selected); }
    const heldKey = p.held ? p.held.k : '';
    if (p.selected !== this.lastSel || heldKey !== this.lastHeld) { this.lastSel = p.selected; this.lastHeld = heldKey; this.nameTag.textContent = heldKey ? ITEMS[heldKey].name : ''; this.nameT = 2.2; }
    this.nameT -= dt; this.nameTag.style.opacity = this.nameT > 0 ? Math.min(1, this.nameT * 2) : 0;
    const survival = p.mode === 'survival';
    this.healthRow.parentElement.style.visibility = survival ? 'visible' : 'hidden';
    const fill = (row, v) => { for (let i = 0; i < 10; i++) { const f = clamp(v / 2 - i, 0, 1); const n = row.children[i].firstChild; const w = f >= 0.75 ? '100%' : f >= 0.25 ? '50%' : '0%'; if (n._w !== w) { n._w = w; n.style.width = w; } } };
    fill(this.healthRow, p.health); fill(this.hungerRow, p.hunger);
    this.healthRow.classList.toggle('low', p.health <= 6);
    this.airRow.style.visibility = survival && p.air < 9.9 ? 'visible' : 'hidden';
    fill(this.airRow, p.air * 2);
    this.vignette.style.opacity = Math.max(p.hurtT * 1.15, p.health <= 5 && survival ? 0.28 + Math.sin(performance.now() / 260) * 0.08 : 0);
    const m = p.mining ? clamp(p.mining.progress, 0, 1) : 0;
    this.progress.style.opacity = m > 0.02 ? 1 : 0;
    this.progress.style.background = `conic-gradient(rgba(243,223,176,.95) ${m * 360}deg, rgba(255,255,255,.16) 0deg)`;
    this.modeTag.textContent = (p.mode === 'creative' ? (p.flying ? 'Creative · flying' : 'Creative') : 'Survival') + ' · day ' + game.day + ' · ' + String(Math.floor(game.time)).padStart(2, '0') + ':' + String(Math.floor((game.time % 1) * 60)).padStart(2, '0');
    const bio = game.biome;
    if (bio !== this.lastBiome && bio >= 0) { this.biomePending = (this.biomePending || 0) + dt; if (this.biomePending > 2.5) { this.lastBiome = bio; this.biomePending = 0; this.biomeEl.textContent = BIOME_NAMES[bio]; this.biomeT = 3.4; } } else this.biomePending = 0;
    this.biomeT -= dt; this.biomeEl.style.opacity = clamp(Math.min(this.biomeT, 3.4 - this.biomeT) * 1.6, 0, 1);
    if (this.screen === 'furnace') this._refreshFurnace();
    if (this.container) this.refresh();
  },
  updateDebug(game, stats) {
    this.debugEl.classList.toggle('hidden', !this.debug);
    if (!this.debug || !game.player) return;
    const p = game.player.pos, w = game.world, l = w.getLight(Math.floor(p.x), p.y + 1.5, Math.floor(p.z));
    const t = game.player.target;
    this.debugEl.textContent = [
      `ASHLAR debug  ·  preset ${Q.name}  ·  ${Pipeline.W}×${Pipeline.H}`,
      `fps ${stats.fps.toFixed(0)}   frame ${stats.ft.toFixed(1)} ms   cpu ${stats.cpu.toFixed(1)} ms`,
      `draw calls ${stats.calls}   triangles ${(stats.tris / 1e6).toFixed(2)} M`,
      `xyz ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}   chunk ${Math.floor(p.x) >> 4}, ${Math.floor(p.z) >> 4}`,
      `facing ${((((-game.player.yaw * 180) / Math.PI) % 360 + 360) % 360).toFixed(0)}°   seed ${w.seed}`,
      `biome ${BIOME_NAMES[Math.max(0, game.biome)]}   weather ${game.weather.kind}`,
      `light block ${(Math.max(l[0], l[1], l[2]) * 15).toFixed(0)}  sky ${(l[3] * 15).toFixed(0)}`,
      `chunks ${w.chunks.size}  gen ${w.genInflight}  mesh ${w.meshInflight}  lod ${w.lodInflight}`,
      `creatures ${Creatures.list.length}  drops ${Entities.drops.length}  debris ${Entities.debris.length}  lights ${Pipeline.shared.uPointCount.value}`,
      t ? `target ${BLOCKS[t.id].name} @ ${t.x}, ${t.y}, ${t.z}` : 'target —',
    ].join('\n');
  },
  setHUD(v) { this.hud.classList.toggle('hidden', !v); },

  // ---------------------------------------------------------------- menus
  clearLayer() { this.layer.innerHTML = ''; this.layer.className = 'layer'; this.tip.classList.add('hidden'); },
  button(parent, label, fn, cls = '') { const b = el('button', 'btn ' + cls, parent, label); b.addEventListener('click', () => { Audio.play('click', 0.5); fn(); }); return b; },
  showTitle(game) {
    this.screen = 'title'; this.clearLayer(); this.setHUD(false);
    this.layer.classList.add('title');
    const panel = el('div', 'title-panel', this.layer);
    el('div', 'wordmark', panel, 'ASHLAR');
    el('div', 'tagline', panel, 'a world cut from stone and light');
    const menu = el('div', 'menu', panel);
    const save = game.peekSave();
    if (save) this.button(menu, `Continue  —  ${save.mode}, day ${save.day}`, () => game.continueGame(), 'primary');
    const seedRow = el('label', 'seed-row', menu);
    el('span', null, seedRow, 'World seed');
    const seed = el('input', null, seedRow); seed.type = 'text'; seed.placeholder = 'random'; seed.maxLength = 24;
    seed.addEventListener('keydown', (e) => e.stopPropagation());
    this.button(menu, 'New world  ·  Survival', () => game.startNew(seed.value, 'survival'), save ? '' : 'primary');
    this.button(menu, 'New world  ·  Creative', () => game.startNew(seed.value, 'creative'));
    this.button(menu, 'Settings', () => this.showSettings(game, () => this.showTitle(game)));
    this.button(menu, 'Controls', () => this.showControls(() => this.showTitle(game)));
    el('div', 'title-foot', panel, `Every texture, model, sound and cloud is generated in your browser. Graphics preset: ${Q.name}.`);
  },
  showBusy(text) { this.screen = 'busy'; this.clearLayer(); this.layer.classList.add('dim'); const p = el('div', 'panel busy', this.layer); el('div', 'spinner', p); this.busyText = el('div', null, p, text); },
  showPause(game) {
    this.screen = 'pause'; this.clearLayer(); this.layer.classList.add('dim');
    const p = el('div', 'panel menu-panel', this.layer);
    el('h2', null, p, 'Paused');
    const m = el('div', 'menu', p);
    this.button(m, 'Resume', () => game.resume(), 'primary');
    this.button(m, 'Settings', () => this.showSettings(game, () => this.showPause(game)));
    this.button(m, 'Controls', () => this.showControls(() => this.showPause(game)));
    this.button(m, 'Save world', () => { game.save(); this.toast('World saved'); game.resume(); });
    this.button(m, 'Save and quit to title', () => { game.save(); game.showTitle(); });
  },
  showControls(back) {
    this.screen = 'controls'; this.clearLayer(); this.layer.classList.add('dim');
    const p = el('div', 'panel wide', this.layer);
    el('h2', null, p, 'Controls');
    const g = el('div', 'keys', p);
    for (const [k, d] of [['W A S D', 'move'], ['Mouse', 'look'], ['Space', 'jump · swim up · climb'], ['Shift / double-tap W', 'sprint'], ['C or left Ctrl', 'crouch (will not walk off ledges) · descend'], ['F or double Space', 'toggle flight (creative)'], ['Left mouse', 'mine · attack'], ['Right mouse', 'place · use · eat'], ['Middle mouse', 'pick block (creative)'], ['1–9 / wheel', 'hotbar'], ['E', 'inventory and crafting'], ['Q', 'drop one item'], ['F3', 'debug overlay'], ['F1', 'hide HUD'], ['J', 'cycle weather'], ['T (hold)', 'fast-forward time (creative)'], ['Esc', 'pause']]) { el('kbd', null, g, k); el('span', null, g, d); }
    this.button(p, 'Back', back, 'primary');
  },
  showSettings(game, back) {
    this.screen = 'settings'; this.clearLayer(); this.layer.classList.add('dim');
    const p = el('div', 'panel wide', this.layer);
    el('h2', null, p, 'Settings');
    const g = el('div', 'form', p);
    const row = (label, control) => { el('label', null, g, label); const c = el('div', 'ctl', g); c.appendChild(control); return c; };
    const select = (opts, value) => { const s = document.createElement('select'); for (const [v, t] of opts) { const o = el('option', null, s, t); o.value = v; } s.value = value; return s; };
    const range = (min, max, step, value, fmt, onInput) => { const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = value; const out = el('output'); out.textContent = fmt(+value); i.addEventListener('input', () => { out.textContent = fmt(+i.value); onInput(+i.value); }); return [i, out]; };
    const addRange = (label, ...a) => { const [i, out] = range(...a); row(label, i).appendChild(out); return i; };
    const preset = select([['low', 'Low'], ['medium', 'Medium'], ['high', 'High  (60 fps at 1080p)'], ['ultra', 'Ultra  (screenshots)']], Settings.preset); row('Graphics preset', preset);
    let rd = Settings.renderDist;
    addRange('Render distance', 0, 22, 1, rd, (v) => (v ? v + ' chunks' : 'preset'), (v) => { rd = v && v < 4 ? 4 : v; });
    const shadows = select([['preset', 'Match preset'], ['off', 'Off'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], Settings.shadows); row('Shadow quality', shadows);
    addRange('Field of view', 55, 100, 1, Settings.fov, (v) => v + '°', (v) => { Settings.fov = v; });
    addRange('Mouse sensitivity', 0.2, 2.5, 0.05, Settings.sensitivity, (v) => v.toFixed(2) + '×', (v) => { Settings.sensitivity = v; });
    addRange('Volume', 0, 1, 0.05, Settings.volume, (v) => Math.round(v * 100) + '%', (v) => { Settings.volume = v; Audio.setVolume(v); });
    addRange('Day length', 5, 60, 1, Settings.dayLength, (v) => v + ' min', (v) => { Settings.dayLength = v; });
    const bob = document.createElement('input'); bob.type = 'checkbox'; bob.checked = Settings.bob; row('Head bob', bob);
    this.button(p, 'Apply and return', async () => {
      const changed = preset.value !== Settings.preset || rd !== Settings.renderDist || shadows.value !== Settings.shadows;
      Settings.preset = preset.value; Settings.renderDist = rd; Settings.shadows = shadows.value; Settings.bob = bob.checked; Settings.save();
      if (changed) await game.applyGraphics();
      back();
    }, 'primary');
  },
  showDeath(game, cause) {
    this.screen = 'death'; this.clearLayer(); this.layer.classList.add('death');
    const p = el('div', 'panel menu-panel', this.layer);
    el('h2', null, p, 'You did not make it');
    el('p', 'sub', p, { fall: 'The ground arrived too quickly.', drown: 'The water kept you.', lava: 'The deep fire took you.', starve: 'Hunger won.', fire: 'You stood in the fire.', cactus: 'Spines, many of them.' }[cause] || 'Something from the dark found you.');
    const m = el('div', 'menu', p);
    this.button(m, 'Return to camp', () => game.respawn(), 'primary');
    this.button(m, 'Quit to title', () => { game.player.respawn(); game.save(); game.showTitle(); });
  },

  // ---------------------------------------------------------------- inventory style screens
  _openScreen(kind) {
    const game = Game;
    game.state = 'screen'; this.screen = kind; this.clearLayer(); this.layer.classList.add('dim');
    game.releaseMouse();
    const p = el('div', 'panel inv', this.layer);
    this.layer.onmousedown = (e) => { if (e.target === this.layer && this.cursor) { this._throwCursor(); } };
    return p;
  },
  closeScreen() {
    if (this.screen === 'chest' && this.chestPos) { Entities.openChests.delete(this.chestPos); Audio.play('chest', 0.5); }
    const p = Game.player;
    for (let i = 0; i < this.craftGrid.length; i++) if (this.craftGrid[i]) { const s = this.craftGrid[i]; const left = p.inventory.add(s.k, s.n, s.d); if (left) Entities.spawnDrop(s.k, left, p.eyePos(), p.lookDir().multiplyScalar(4)); this.craftGrid[i] = null; }
    if (this.cursor) { const left = p.inventory.add(this.cursor.k, this.cursor.n, this.cursor.d); if (left) Entities.spawnDrop(this.cursor.k, left, p.eyePos(), p.lookDir().multiplyScalar(4)); this.cursor = null; }
    this.container = null; this.screen = null; this.chestPos = null; this.furnace = null;
    this._paintCursor(); this.clearLayer(); this.layer.onmousedown = null;
  },
  _throwCursor() { const p = Game.player; Entities.spawnDrop(this.cursor.k, this.cursor.n, p.eyePos(), p.lookDir().multiplyScalar(5), 1.2, this.cursor.d); this.cursor = null; this._paintCursor(); },
  _paintCursor() {
    this.cursorEl.classList.toggle('hidden', !this.cursor);
    if (!this.cursor) return;
    this.cursorEl.innerHTML = `<img src="${Icons.get(this.cursor.k)}"><b>${this.cursor.n > 1 ? this.cursor.n : ''}</b>`;
  },
  _tooltip(node, get) {
    node.addEventListener('mouseenter', () => { const s = get(); if (!s || this.cursor) return; const it = ITEMS[s.k]; this.tip.innerHTML = `<strong>${esc(it.name)}</strong>` + (it.type === 'tool' ? `<span>damage ${it.damage} · uses ${Math.ceil(s.d === undefined ? it.durability : s.d)}</span>` : it.food ? `<span>restores ${it.food} hunger</span>` : it.fuel ? `<span>fuel · smelts ${it.fuel}</span>` : ''); this.tip.classList.remove('hidden'); });
    node.addEventListener('mouseleave', () => this.tip.classList.add('hidden'));
  },
  // bind a grid of slots to an array of stacks
  _grid(parent, arr, from, count, cols, opts = {}) {
    const g = el('div', 'grid', parent); g.style.gridTemplateColumns = `repeat(${cols}, var(--slot))`;
    for (let i = from; i < from + count; i++) {
      const node = this._slotEl(g);
      const ref = { node, arr, i, opts };
      this.container.push(ref);
      node.addEventListener('contextmenu', (e) => e.preventDefault());
      node.addEventListener('mousedown', (e) => { e.preventDefault(); this._click(ref, e.button, e.shiftKey); });
      this._tooltip(node, () => arr[i]);
    }
    return g;
  },
  _click(ref, button, shift) {
    const { arr, i, opts } = ref;
    const s = arr[i];
    if (opts.output) {
      if (opts.output === 'craft') { this._takeCraft(shift); return; }
      if (!s) return;
      if (shift) { const left = Game.player.inventory.add(s.k, s.n); arr[i] = left ? { k: s.k, n: left } : null; }
      else if (!this.cursor) { this.cursor = s; arr[i] = null; }
      else if (this.cursor.k === s.k && this.cursor.n + s.n <= ITEMS[s.k].stack) { this.cursor.n += s.n; arr[i] = null; }
      Audio.play('pickup', 0.25);
    } else if (shift && s) {
      const inv = Game.player.inventory;
      const targets = opts.shiftTo ? opts.shiftTo(s, i) : null;
      if (targets) { this._moveInto(arr, i, targets.arr, targets.from, targets.to); }
      else if (arr === inv.slots) { if (i < 9) this._moveInto(arr, i, inv.slots, 9, 36); else this._moveInto(arr, i, inv.slots, 0, 9); }
      else this._moveInto(arr, i, inv.slots, 0, 36);
    } else if (button === 2) {
      if (!this.cursor && s) { const half = Math.ceil(s.n / 2); this.cursor = { k: s.k, n: half, d: s.d }; s.n -= half; if (!s.n) arr[i] = null; }
      else if (this.cursor) {
        if (!s) { arr[i] = { k: this.cursor.k, n: 1, d: this.cursor.d }; this.cursor.n--; }
        else if (s.k === this.cursor.k && s.n < ITEMS[s.k].stack) { s.n++; this.cursor.n--; }
        if (this.cursor.n <= 0) this.cursor = null;
      }
    } else {
      if (this.cursor && s && s.k === this.cursor.k && ITEMS[s.k].stack > 1) { const t = Math.min(this.cursor.n, ITEMS[s.k].stack - s.n); s.n += t; this.cursor.n -= t; if (!this.cursor.n) this.cursor = null; }
      else { arr[i] = this.cursor; this.cursor = s; }
    }
    Game.player.inventory.version++;
    this._paintCursor(); this.tip.classList.add('hidden'); this.refresh();
  },
  _moveInto(src, i, dst, from, to) {
    const s = src[i]; if (!s) return;
    const max = ITEMS[s.k].stack;
    for (let j = from; j < to && s.n > 0; j++) if (dst[j] && dst[j].k === s.k && dst[j].n < max) { const t = Math.min(s.n, max - dst[j].n); dst[j].n += t; s.n -= t; }
    for (let j = from; j < to && s.n > 0; j++) if (!dst[j]) { dst[j] = { k: s.k, n: s.n, d: s.d }; s.n = 0; }
    if (!s.n) src[i] = null;
  },
  refresh() {
    if (!this.container) return;
    if (this.craftOut) { const r = matchRecipe(this.craftGrid, this.craftSize); this.craftRecipe = r; this.craftOut[0] = r ? { k: r.out, n: r.n } : null; }
    for (const ref of this.container) this._paint(ref.node, ref.arr[ref.i]);
    if (this.bookList && this._bookVersion !== this._bookKey()) this._buildBook();
  },
  _takeCraft(all) {
    const inv = Game.player.inventory;
    for (let k = 0; k < 64; k++) {
      const r = matchRecipe(this.craftGrid, this.craftSize);
      if (!r) break;
      const out = { k: r.out, n: r.n }; if (ITEMS[r.out].durability) out.d = ITEMS[r.out].durability;
      if (all) { const left = inv.add(out.k, out.n); if (left) { Entities.spawnDrop(out.k, left, Game.player.eyePos()); } }
      else if (!this.cursor) this.cursor = out;
      else if (this.cursor.k === out.k && this.cursor.n + out.n <= ITEMS[out.k].stack) this.cursor.n += out.n;
      else break;
      for (let i = 0; i < this.craftGrid.length; i++) if (this.craftGrid[i]) { this.craftGrid[i].n--; if (this.craftGrid[i].n <= 0) this.craftGrid[i] = null; }
      Game.stats.crafted++;
      Audio.play('craft', 0.6);
      if (!all) break;
    }
    this._paintCursor(); this.refresh();
  },
  _need(r) {
    const need = {};
    if (r.ins) for (const i of r.ins) need[i] = (need[i] || 0) + 1;
    else for (const row of r.pattern) for (const ch of row) if (ch !== ' ') need[r.keys[ch]] = (need[r.keys[ch]] || 0) + 1;
    return need;
  },
  _craftable(r) {
    const have = {};
    for (const s of [...Game.player.inventory.slots, ...this.craftGrid]) if (s) have[s.k] = (have[s.k] || 0) + s.n;
    return Object.entries(this._need(r)).every(([k, n]) => { if (ANY[k]) return ANY[k].reduce((a, q) => a + (have[q] || 0), 0) >= n; return (have[k] || 0) >= n; });
  },
  _fits(r) { return r.ins ? r.ins.length <= this.craftSize * this.craftSize : r.pattern.length <= this.craftSize && r.pattern[0].length <= this.craftSize; },
  // lay a recipe out in the grid from whatever the player carries
  fillRecipe(r, batch) {
    const inv = Game.player.inventory;
    for (let i = 0; i < this.craftGrid.length; i++) if (this.craftGrid[i]) { inv.add(this.craftGrid[i].k, this.craftGrid[i].n, this.craftGrid[i].d); this.craftGrid[i] = null; }
    if (!this._fits(r) || !this._craftable(r)) { this.refresh(); return false; }
    const pull = (want) => { const idx = inv.slots.findIndex((s) => s && ingredientMatches(want, s.k)); if (idx < 0) return null; const k = inv.slots[idx].k; inv.take(idx, 1); return { k, n: 1 }; };
    const cells = [];
    if (r.ins) r.ins.forEach((want, n) => cells.push([n, want]));
    else r.pattern.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ' ') cells.push([y * this.craftSize + x, r.keys[ch]]); }));
    for (const [at, want] of cells) this.craftGrid[at] = pull(want);
    for (let n = 1; batch && n < 64 && this._craftableFromPack(cells); n++) for (const [at, want] of cells) {
      const idx = inv.slots.findIndex((s) => s && s.k === this.craftGrid[at].k);
      if (idx >= 0) { inv.take(idx, 1); this.craftGrid[at].n++; }
    }
    this.refresh();
    return true;
  },
  _craftableFromPack(cells) {
    const need = {};
    for (const [at] of cells) need[this.craftGrid[at].k] = (need[this.craftGrid[at].k] || 0) + 1;
    return Object.entries(need).every(([k, n]) => Game.player.inventory.count(k) >= n);
  },
  _bookKey() { return Game.player.inventory.version + ':' + this.craftSize + ':' + this.craftGrid.map((s) => (s ? s.k + s.n : '')).join(); },
  _buildBook() {
    this._bookVersion = this._bookKey();
    const scroll = this.bookList.scrollTop;
    this.bookList.innerHTML = '';
    const list = RECIPES.filter((r) => this._fits(r)).map((r) => [r, this._craftable(r)]).sort((a, b) => b[1] - a[1]);
    for (const [r, ok] of list) {
      const row = el('button', 'recipe' + (ok ? '' : ' locked'), this.bookList);
      const img = el('img', null, row); img.src = Icons.get(r.out);
      const txt = el('div', null, row);
      el('strong', null, txt, ITEMS[r.out].name + (r.n > 1 ? ' ×' + r.n : ''));
      el('span', null, txt, Object.entries(this._need(r)).map(([k, n]) => n + ' ' + (k === 'planks' ? 'planks' : k === 'logs' ? 'logs' : ITEMS[k].name.toLowerCase())).join(', '));
      row.addEventListener('mousedown', (e) => { e.preventDefault(); if (ok) { Audio.play('click', 0.4); this.fillRecipe(r, e.shiftKey); } });
    }
    this.bookList.scrollTop = scroll;
  },
  _playerGrid(parent, shiftTo) {
    const inv = Game.player.inventory;
    el('h3', null, parent, 'Pack');
    this._grid(parent, inv.slots, 9, 27, 9, { shiftTo });
    this._grid(parent, inv.slots, 0, 9, 9, { shiftTo }).classList.add('hot');
  },
  openCrafting(size) {
    const p = this._openScreen('craft');
    this.container = []; this.craftSize = size; this.craftGrid = new Array(size * size).fill(null); this.craftOut = [null];
    const left = el('div', 'col', p), right = el('div', 'col book', p);
    el('h2', null, left, size === 3 ? 'Joiner’s Bench' : 'Inventory');
    const row = el('div', 'craft-row', left);
    this._grid(row, this.craftGrid, 0, size * size, size);
    el('div', 'arrow', row, '→');
    this._grid(row, this.craftOut, 0, 1, 1, { output: 'craft' }).classList.add('out');
    el('p', 'sub', row, size === 3 ? 'Shift-click the result to craft a full batch.' : 'Craft a Joiner’s Bench for the 3 × 3 grid.');
    this._playerGrid(left);
    el('h3', null, right, 'Recipes  ·  shift-click for a full batch');
    this.bookList = el('div', 'book-list', right);
    this._buildBook(); this.refresh();
  },
  openInventory() { if (Game.player.mode === 'creative') this.openCreative(); else this.openCrafting(2); },
  openChest(pos) {
    const p = this._openScreen('chest');
    this.container = []; this.craftOut = null; this.craftGrid = []; this.bookList = null; this.chestPos = pos;
    const chest = Game.getChest(pos);
    const col = el('div', 'col', p);
    el('h2', null, col, 'Storage Chest');
    this._grid(col, chest.slots, 0, 27, 9);
    this._playerGrid(col, (s, i) => ({ arr: chest.slots, from: 0, to: 27 }));
    this.refresh();
  },
  openFurnace(pos) {
    const p = this._openScreen('furnace');
    this.container = []; this.craftOut = null; this.craftGrid = []; this.bookList = null;
    const f = this.furnace = Game.getFurnace(pos);
    const col = el('div', 'col', p);
    el('h2', null, col, 'Kiln Furnace');
    const row = el('div', 'furnace-row', col);
    const a = el('div', 'fcol', row);
    this._grid(a, f.slots, 0, 1, 1);
    this.flameEl = el('div', 'flame-meter', a); el('i', null, this.flameEl);
    this._grid(a, f.slots, 1, 1, 1);
    this.progEl = el('div', 'smelt-bar', row); el('i', null, this.progEl);
    this._grid(row, f.slots, 2, 1, 1, { output: 'furnace' }).classList.add('out');
    el('p', 'sub', row, 'Ore, sand, stone, clay, meat and logs go on top; fuel below.');
    this._playerGrid(col, (s) => ({ arr: f.slots, from: SMELT[s.k] ? 0 : 1, to: SMELT[s.k] ? 1 : 2 }));
    this.refresh();
  },
  _refreshFurnace() {
    const f = this.furnace; if (!f) return;
    this.flameEl.firstChild.style.height = (f.burnMax ? clamp(f.burn / f.burnMax, 0, 1) * 100 : 0) + '%';
    this.flameEl.classList.toggle('lit', f.burn > 0);
    this.progEl.firstChild.style.width = clamp(f.progress / SMELT_TIME, 0, 1) * 100 + '%';
  },
  openCreative() {
    const p = this._openScreen('creative');
    this.container = []; this.craftOut = null; this.craftGrid = []; this.bookList = null;
    const col = el('div', 'col', p);
    const head = el('div', 'creative-head', col);
    el('h2', null, head, 'Block palette');
    const search = el('input', 'search', head); search.placeholder = 'search…'; search.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') Game.closeScreen(); });
    this.button(head, 'Crafting', () => { this.closeScreen(); this.openCrafting(3); });
    const pal = el('div', 'palette', col);
    const build = () => {
      pal.innerHTML = '';
      const q = search.value.trim().toLowerCase();
      for (const it of Object.values(ITEMS)) {
        if (q && !it.name.toLowerCase().includes(q) && !it.key.includes(q)) continue;
        const node = this._slotEl(pal);
        this._paint(node, { k: it.key, n: 1 });
        this._tooltip(node, () => ({ k: it.key, n: 1 }));
        node.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const stack = { k: it.key, n: e.button === 2 ? 1 : it.stack }; if (it.durability) stack.d = it.durability;
          if (e.shiftKey) Game.player.inventory.add(stack.k, stack.n);
          else if (this.cursor) this.cursor = null;
          else { this.cursor = stack; }
          Audio.play('pickup', 0.3); this._paintCursor(); this.refresh();
        });
      }
    };
    search.addEventListener('input', build); build();
    el('p', 'sub', col, 'Click to pick up a stack, then click a hotbar slot. Shift-click sends it straight to your pack.');
    this._playerGrid(col);
    this.refresh();
  },
};
