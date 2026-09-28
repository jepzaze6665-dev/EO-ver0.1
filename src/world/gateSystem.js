import { TILE, SOLID_TILES } from '../core/constants.js';
import { TAU } from '../core/math.js';

// GATE SYSTEM — Boss Gates that work with collision (data: maps/*.js `gates`).
//   { id, rect: [tx0, ty0, tx1, ty1], requires: [...requirements], color: 'r,g,b', label }
// While a gate's requirements are not met, its walkable tiles are solid (WorldMap.blocker) and it is drawn as a
// barrier; when they are met (e.g. the map ahead was unlocked by its boss) the collision opens with a short effect.
// The rule lives in the data and the World Progression — no map loop ever edits collision for a boss.
export class GateSystem {
  constructor(world, maps) {
    this.world = world;
    this.list = [];
    for (const d of maps) for (const gt of d.gates || []) this.list.push({ ...gt, mapId: d.id, open: null, openT: 0, tiles: null });
    this.checkT = 0;
    this.warnT = 0;
  }
  isOpen(gate) { const wp = this.world.game.worldProgress; return wp ? wp.meets(gate.requires) : true; }
  get(id) { return this.list.find((g) => g.id === id) || null; }
  // walkable terrain tiles inside the rect (computed once — the gate only ever blocks what was open ground)
  tilesOf(gate) {
    if (gate.tiles) return gate.tiles;
    const m = this.world.map, out = [];
    const [x0, y0, x1, y1] = gate.rect;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (m.inBounds(tx, ty) && !SOLID_TILES.has(m.get(tx, ty))) out.push(m.idx(tx, ty));
    return (gate.tiles = out);
  }
  // sync collision with the current requirements (cheap: a handful of gates)
  apply(fx = false) {
    const m = this.world.map, mm = this.world.mapManager;
    for (const gate of this.list) {
      if (mm.gridOf(gate.mapId) !== this.world.gridId) continue; // other grid: synced when that grid loads
      const open = this.isOpen(gate);
      if (open === gate.open) continue;
      const first = gate.open === null;
      // first sync: only a closed gate adds its blockers; later: add on close, remove on open
      if (!(first && open)) for (const i of this.tilesOf(gate)) m.blocker[i] = open ? Math.max(0, m.blocker[i] - 1) : m.blocker[i] + 1;
      gate.open = open;
      if (!first && open) {
        gate.openT = 1.2;
        if (fx) this.openFx(gate);
      }
    }
  }
  openFx(gate) {
    const g = this.world.game, c = this.center(gate);
    g.vfx.ring(c.x, c.y, 10, 120, { color: gate.color || '255,220,160', life: 0.8, width: 6 });
    g.vfx.burst(c.x, c.y - 20, `rgb(${gate.color || '255,220,160'})`, 40, 200);
    g.audio.sfx('shatter');
    if (this.world.mapId === gate.mapId) g.ui.notify('PATH OPENED', gate.label || 'The barrier fades', '#ffe8b0');
  }
  center(gate) { const [x0, y0, x1, y1] = gate.rect; return { x: ((x0 + x1 + 1) / 2) * TILE, y: ((y0 + y1 + 1) / 2) * TILE }; }
  update(dt) {
    this.checkT -= dt;
    if (this.checkT <= 0) { this.checkT = 0.25; this.apply(true); }
    for (const gt of this.list) if (gt.openT > 0) gt.openT -= dt;
    // player feedback: walking into a closed gate says what opens it
    this.warnT -= dt;
    const w = this.world, p = w.game.player;
    if (this.warnT > 0 || p.dead) return;
    for (const gt of this.list) {
      if (gt.open || gt.mapId !== w.mapId) continue;
      const [x0, y0, x1, y1] = gt.rect, pad = 0.9 * TILE;
      if (p.x > x0 * TILE - pad && p.x < (x1 + 1) * TILE + pad && p.y > y0 * TILE - pad && p.y < (y1 + 1) * TILE + pad) {
        this.warnT = 3;
        this.blocked(gt);
        return;
      }
    }
  }
  blocked(gate) {
    const g = this.world.game, miss = (gate.requires || []).find((r) => !g.worldProgress.meets([r]));
    g.ui.notify('THE WAY IS BLOCKED', miss ? miss.label || 'Locked' : gate.label || 'Locked', '#ff9a80');
    g.audio.sfx('deny');
    g.events.emit('gateBlocked', { id: gate.id, gate });
  }
  // barrier visuals (Renderer, ground pass) — closed gates glow, opened ones fade out
  draw(ctx, t) {
    const w = this.world;
    for (const gt of this.list) {
      if (gt.mapId !== w.mapId || (gt.open && gt.openT <= 0)) continue;
      const [x0, y0, x1, y1] = gt.rect, px = x0 * TILE, py = y0 * TILE, pw = (x1 - x0 + 1) * TILE, ph = (y1 - y0 + 1) * TILE;
      const a = gt.open ? gt.openT / 1.2 : 1, col = gt.color || '255,220,160';
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = `rgba(${col},${0.14 + 0.05 * Math.sin(t * 3)})`;
      ctx.fillRect(px, py, pw, ph);
      ctx.globalCompositeOperation = 'lighter';
      // rune bars rising out of the ground
      const vertical = ph >= pw;
      const n = Math.max(2, Math.round((vertical ? ph : pw) / 10));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n, flick = 0.35 + 0.35 * Math.sin(t * 5 + i * 1.7);
        ctx.fillStyle = `rgba(${col},${flick})`;
        if (vertical) ctx.fillRect(px + pw / 2 - 1.5, py + k * ph - 4, 3, 8);
        else ctx.fillRect(px + k * pw - 1.5, py + ph / 2 - 16, 3, 22);
      }
      ctx.strokeStyle = `rgba(${col},${0.55 + 0.25 * Math.sin(t * 4)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
      // floating seal over the middle
      const c = this.center(gt);
      ctx.beginPath(); ctx.arc(c.x, c.y - 22 + Math.sin(t * 2) * 2, 7, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }
}
