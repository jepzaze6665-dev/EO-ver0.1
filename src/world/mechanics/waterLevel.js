// WATER LEVEL (A2 Ancient Valley) — "the valley's water obeys the old temple". A LEVER (the temple wheel, far from the water)
// drains a BASIN (every wet tile inside a tile box): the shallows dry first, then the river, then the deep middle, turning
// into mud, riverbed stones and sunken paving (tile types MUD / RIVERBED / SUNKEN, walkable — the owner's riverbed art).
// What the water hid shows up: props lying on the lakebed (`finds`), a drowned chest (once per save) and the drowned stair
// (a lore tablet). The sluice gate prop swaps closed / open. The water comes home when you leave the map (once per visit /
// dungeon run: pull the wheel again next time); nobody can be caught by rising water inside the map.
// ONLINE: the room host owns `drained` (netState); a guest's pull = send('pull'); guests drain their own copy of the tiles.
//   options: { basin: [x0, y0, x1, y1], lever: [tx, ty], sluice: { at, scale }, finds: [{ prop, at, scale }],
//              chest: { id, at, loot, gold }, stair: { at, lore }, drainTime, sign }
import { registerMapMechanic, MapMechanic } from '../mapMechanics.js';
import { TILE, T } from '../../core/constants.js';
import { TAU, rand } from '../../core/math.js';
import { Assets } from '../../core/assets.js';
import { interact } from '../../exploration/interactables.js';

const DRY = { [T.SHALLOW]: [T.MUD, 0], [T.WATER]: [T.RIVERBED, 1], [T.DEEP_WATER]: [T.SUNKEN, 2] }; // tile -> [dry tile, wave]

export class WaterLevel extends MapMechanic {
  enter() {
    const o = this.o = { drainTime: 3, ...this.def }, w = this.world, m = w.map;
    const [x0, y0, x1, y1] = o.basin;
    this.cells = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = m.idx(x, y), d = DRY[m.tiles[i]];
      if (d && w.mapManager.idAt((x + 0.5) * TILE, (y + 0.5) * TILE) === this.mapId) this.cells.push({ i, wet: m.tiles[i], dry: d[0], wave: d[1], done: false });
    }
    this.drained = false; this.t = 0;
    const at = (p) => ({ x: (p[0] + 0.5) * TILE, y: (p[1] + 0.5) * TILE });
    this.lever = { ...at(o.lever) };
    this.items = [];
    const add = (it) => { it.kind = 'mech'; it.mapId = this.mapId; this.items.push(it); w.interactables.push(it); return it; };
    add({ id: 'water_lever', ...this.lever, radius: 44, prompt: 'Turn the Temple Wheel', available: () => !this.drained, use: () => this.send('pull'),
      draw: (ctx) => this.sprite(ctx, this.drained ? 'w_lever_on' : 'w_lever_off', this.lever.x, this.lever.y, 0.55) });
    if (o.sluice) { const s = at(o.sluice.at); add({ id: 'water_sluice', ...s, radius: 0, available: () => false, draw: (ctx) => this.sprite(ctx, this.drained ? 'w_sluice_open' : 'w_sluice_closed', s.x, s.y, o.sluice.scale || 0.6) }); }
    if (o.chest) {
      const c = at(o.chest.at), chest = { id: o.chest.id, kind: 'chest', ...c, radius: 34, rare: true, loot: o.chest.loot, gold: o.chest.gold };
      add({ id: 'water_chest', ...c, radius: 38, prompt: 'Open Drowned Chest', available: () => this.drained && !w.state.chests[chest.id], use: () => interact(w, chest),
        draw: (ctx) => { if (this.drained) this.sprite(ctx, w.state.chests[chest.id] ? 'w_chest_open' : 'w_chest_closed', c.x, c.y + 6, 0.32); } });
    }
    if (o.stair) {
      const s = at(o.stair.at), tab = { kind: 'lore', lore: o.stair.lore };
      add({ id: 'water_stair', ...s, radius: 46, prompt: 'Read the Bronze Plate', available: () => this.drained, use: () => interact(w, tab),
        draw: (ctx) => { if (this.drained) this.sprite(ctx, 'w_temple_stairs', s.x, s.y + 30, 0.42); } });
    }
    this.finds = (o.finds || []).map((f) => ({ ...f, ...at(f.at) }));
    if (!this.saved.told) this.tipT = 3;
  }
  exit() {
    this.refill();
    const mine = new Set(this.items);
    this.world.interactables = this.world.interactables.filter((it) => !mine.has(it));
  }
  // checkpoint: the valley is as it was when you came in (respawn on another map rebuilds us anyway)
  reset() { }

  setTile(c, dry) {
    const m = this.world.map;
    m.tiles[c.i] = dry ? c.dry : c.wet;
    c.done = dry;
  }
  refill() { let any = false; for (const c of this.cells) if (c.done) { this.setTile(c, false); any = true; } if (any) this.world.map.invalidate(); this.drained = false; }

  tourOpen() { this.drained = true; this.t = this.o.drainTime; for (const c of this.cells) this.setTile(c, true); this.world.map.invalidate(); }
  netEvent(kind) {
    if (kind !== 'pull' || this.drained) return;
    this.startDrain();
    this.markNet();
  }
  startDrain() {
    if (this.drained) return;
    this.drained = true; this.t = 0;
    const g = this.game;
    g.ui.banner('THE WHEEL TURNS', 'Far to the south, water roars through an old sluice', '#9ad8ff');
    g.audio.sfx('gate', this.lever);
    g.camera.shake && g.camera.shake(4, 0.6);
  }
  update(dt) {
    if (this.tipT > 0 && (this.tipT -= dt) <= 0) this.saved.told = true;
    if (!this.drained) return;
    this.t += dt;
    const per = this.o.drainTime / 3;
    let changed = false;
    for (const c of this.cells) {
      if (c.done || this.t < c.wave * per + per * 0.5 * ((c.i * 7919) % 97) / 97) continue;
      this.setTile(c, true); changed = true;
      if (Math.random() < 0.08) this.game.vfx.particle((c.i % this.world.map.w + 0.5) * TILE, ((c.i / this.world.map.w | 0) + 0.5) * TILE, { color: '#bfe8ff', vy: -20, life: 0.6, size: 2, add: true });
    }
    if (changed) this.world.map.invalidate();
  }

  // ---- online
  netState() { return { d: this.drained ? 1 : 0 }; }
  netApply(s) { if (s.d && !this.drained) this.startDrain(); }

  // ---- drawing
  sprite(ctx, name, x, y, scale, alpha = 1) {
    const d = Assets.props[name];
    if (!d) { ctx.fillStyle = '#556'; ctx.fillRect(x - 8, y - 16, 16, 16); return; }
    const w = d.w * scale, h = d.h * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(d.img, d.x, d.y, d.w, d.h, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
    ctx.globalAlpha = 1;
  }
  drawGround(ctx, t) {
    if (!this.drained) return;
    const k = Math.min(1, this.t / this.o.drainTime);
    for (const f of this.finds) this.sprite(ctx, f.prop, f.x, f.y, f.scale || 0.35, k);
  }
  hudTags() {
    if (!this.drained) return [];
    return [{ label: this.t < this.o.drainTime ? '≈ The lake is draining…' : '≈ The lake bed lies open', color: '#9ad8ff' }];
  }
}
registerMapMechanic('water_level', WaterLevel);
