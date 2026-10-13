// DARKNESS (B2 Crystal Caverns) — the deep chambers swallow light. Inside a dark chamber (`zones`: { id, name, at: [tx, ty],
// r: tiles, crystals: [[tx, ty]], chest }) the screen goes black except a small circle round you (and round teammates);
// GLOW CRYSTALS answer [E]: lit, each throws a wide circle of light for `lit` seconds, then fades back to a faint ember.
// Light EVERY crystal of a chamber at the same time and its HOARD wakes: a chest appears in the middle (once per save:
// `saved.solved`; the chest itself is an ordinary chest, opened = world.state.chests). Telegraphs are drawn over the
// darkness by the renderer, so danger stays readable.
// ONLINE: the room host owns the crystal timers + solved chambers (netState); a guest's [E] = send('light').
//   options: { zones, lit (s), dark (0..1 max darkness), see (px light round a player), glow (px round a lit crystal) }
import { registerMapMechanic, MapMechanic } from '../mapMechanics.js';
import { TILE } from '../../core/constants.js';
import { TAU } from '../../core/math.js';
import { makeCanvas } from '../../core/assets.js';

const D = { zones: [], lit: 45, dark: 0.93, see: 95, glow: 210 };

export class Darkness extends MapMechanic {
  enter() {
    this.o = { ...D, ...this.def };
    const w = this.world, m = w.map;
    this.items = [];
    this.chests = [];
    this.zones = this.o.zones.map((z, zi) => ({
      ...z, x: (z.at[0] + 0.5) * TILE, y: (z.at[1] + 0.5) * TILE, rp: z.r * TILE,
      cr: z.crystals.map(([tx, ty], ci) => ({ zi, ci, t: 0, ...m.findOpen((tx + 0.5) * TILE, (ty + 0.5) * TILE, 2) })),
    }));
    for (const z of this.zones) for (const c of z.cr) {
      const it = { id: `glow_crystal_${z.id}_${c.ci}`, kind: 'mech', x: c.x, y: c.y, radius: 42, mapId: this.mapId, prompt: 'Light Glow Crystal',
        available: () => c.t <= 0, use: () => this.send('light', { z: c.zi, c: c.ci }), draw: (ctx, t) => this.drawCrystal(ctx, c, t) };
      this.items.push(it);
      w.interactables.push(it);
    }
    this.solved = { ...(this.saved.solved || {}) };
    for (const z of this.zones) if (this.solved[z.id]) this.placeChest(z);
    this.k = 0;
  }
  exit() {
    const w = this.world, mine = new Set([...this.items, ...this.chests]);
    w.interactables = w.interactables.filter((it) => !mine.has(it));
  }
  reset() { if (this.authority) { for (const z of this.zones) for (const c of z.cr) c.t = 0; this.markNet(); } }

  placeChest(z) {
    if (this.chests.some((c) => c.zone === z.id)) return;
    const pos = this.world.map.findOpen(z.x, z.y, 3);
    const it = { id: `chest_hoard_${z.id}`, kind: 'chest', x: pos.x, y: pos.y, radius: 34, mapId: this.mapId, rare: true, fixed: true, zone: z.id, ...z.chest };
    this.chests.push(it);
    this.world.interactables.push(it);
  }
  solve(z) {
    if (this.solved[z.id]) return;
    this.solved[z.id] = true;
    this.saved.solved = { ...this.solved };
    this.placeChest(z);
    this.game.ui.banner('THE HOARD WAKES', `${z.name}: every crystal burns`, '#c8a0ff');
    this.game.audio.sfx('secret');
    this.game.vfx.burst(z.x, z.y - 10, '#d0b0ff', 40, 220);
  }

  // a chamber not solved yet = one hidden reward (once solved, its chest is an ordinary chest the counter sees itself)
  discoveries() { return this.zones.filter((z) => !this.solved[z.id]).map(() => ({ found: false })); }
  netEvent(kind, d) {
    if (kind !== 'light' || !d) return;
    const z = this.zones[d.z], c = z && z.cr[d.c];
    if (!c || c.t > 0) return;
    c.t = this.o.lit;
    this.game.audio.sfx('shatter', c);
    this.game.vfx.burst(c.x, c.y - 16, '#c8a0ff', 16, 120);
    if (z.cr.every((x) => x.t > 0)) this.solve(z);
    else this.game.ui.toast(`${z.name}: ${z.cr.filter((x) => x.t > 0).length}/${z.cr.length} crystals burn`, 2);
    this.markNet();
  }
  update(dt) {
    for (const z of this.zones) for (const c of z.cr) if (c.t > 0 && (c.t -= dt) <= 0) { c.t = 0; if (this.authority) this.markNet(); }
    // how deep in a dark chamber the player stands (fades in over the last 4 tiles of the edge)
    const p = this.game.player;
    let k = 0;
    for (const z of this.zones) { const d = Math.hypot(p.x - z.x, p.y - z.y); k = Math.max(k, Math.min(1, (z.rp + 4 * TILE - d) / (4 * TILE))); }
    this.k += (k - this.k) * Math.min(1, dt * 3);
  }

  // ---- online
  netState() { return { c: this.zones.map((z) => z.cr.map((c) => Math.round(c.t))), s: this.zones.map((z) => (this.solved[z.id] ? 1 : 0)) }; }
  netApply(st) {
    (st.c || []).forEach((row, zi) => { const z = this.zones[zi]; if (z && Array.isArray(row)) z.cr.forEach((c, ci) => { c.t = +row[ci] || 0; }); });
    (st.s || []).forEach((v, zi) => { const z = this.zones[zi]; if (z && v) this.solve(z); });
  }

  // ---- drawing
  drawCrystal(ctx, c, t) {
    const on = c.t > 0, pulse = 0.5 + 0.5 * Math.sin(t * 3 + c.x), fade = on ? Math.min(1, c.t / 5) : 0;
    ctx.fillStyle = '#2a2236';
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 11, 5, 0, 0, TAU); ctx.fill();
    const col = on ? `rgba(220,190,255,${0.7 + 0.3 * pulse * fade})` : `rgba(120,90,170,${0.55 + 0.15 * pulse})`;
    ctx.fillStyle = col;
    for (const [dx, h, wd] of [[-5, 16, 5], [0, 26, 7], [6, 19, 5]]) {
      ctx.beginPath(); ctx.moveTo(c.x + dx - wd / 2, c.y); ctx.lineTo(c.x + dx, c.y - h); ctx.lineTo(c.x + dx + wd / 2, c.y); ctx.fill();
    }
    if (on) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(190,150,255,${0.22 * fade})`;
      ctx.beginPath(); ctx.ellipse(c.x, c.y - 12, 30, 34, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  drawScreen(ctx, game) {
    const k = this.k * this.o.dark;
    if (k <= 0.01) return;
    const cam = game.camera, z = cam.zoom, W = ctx.canvas.width, H = ctx.canvas.height;
    const c = this.can && this.can.width === W && this.can.height === H ? this.can : (this.can = makeCanvas(W, H));
    const f = c.getContext('2d');
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, W, H);
    f.fillStyle = `rgba(4,2,10,${k})`;
    f.fillRect(0, 0, W, H);
    f.globalCompositeOperation = 'destination-out';
    const hole = (wx, wy, r, a = 1) => {
      const x = (wx - cam.left) * z, y = (wy - cam.top) * z, rr = r * z;
      if (x < -rr || y < -rr || x > W + rr || y > H + rr) return;
      const gr = f.createRadialGradient(x, y, rr * 0.25, x, y, rr);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = gr; f.beginPath(); f.arc(x, y, rr, 0, TAU); f.fill();
    };
    const p = game.player;
    hole(p.x, p.y - 16, this.o.see);
    if (game.online) for (const r of game.online.drawables()) hole(r.x, r.y - 16, this.o.see * 0.8); // teammates carry light too
    for (const zz of this.zones) for (const cr of zz.cr) hole(cr.x, cr.y - 12, cr.t > 0 ? this.o.glow * Math.min(1, cr.t / 5 + 0.3) : 34, cr.t > 0 ? 1 : 0.6);
    ctx.drawImage(c, 0, 0);
  }
  hudTags() {
    const p = this.game.player;
    for (const z of this.zones) {
      if (Math.hypot(p.x - z.x, p.y - z.y) > z.rp + 2 * TILE) continue;
      const n = z.cr.filter((c) => c.t > 0).length;
      return [{ label: this.solved[z.id] ? `✧ ${z.name}: hoard awake` : `✧ ${z.name}: crystals ${n}/${z.cr.length}`, color: '#c8a0ff' }];
    }
    return [];
  }
}
registerMapMechanic('darkness', Darkness);
