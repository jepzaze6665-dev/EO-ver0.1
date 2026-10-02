// DUNGEON RUNS (ONLINE N9, rules: data/runRules.js) — game.run, made per game session.
//   begin()  : stepping from a city onto another map: remembers what you carry (bag counts + every gear instance, worn too)
//   bank()   : stepping into a city: the run is over, everything gained is yours for good
//   onDeath(): Game.respawn calls it BEFORE moving you: -expLoss of this run's monster EXP, every item gained this run
//              leaves the bag into a DEATH PILE at the spot you fell (replaces an older pile), then a new run segment
//              starts from what is left (the checkpoint may still be in the dungeon)
//   recover(): opening your pile (E) / a party member carried it to you (online 'pileTaken'): its items back in the bag;
//              while you are in a run they count as gained in this run again (a second death drops them again)
// ON only online (or `game.runRulesOffline = true` for tests / dev): the offline bots and regression suites keep their items.
// The pile is drawn / opened as interactable kind 'deathPile' (exploration/interactables.js); online, its place goes to the
// server (pileSet / pileClear) so party members see it and can carry it (server/piles.js).
import { RUN_RULES } from '../data/runRules.js';
import { DIFFICULTY } from '../data/difficulty.js';
import { ITEMS } from '../items/items.js';
import { isGear } from '../items/itemDefs.js';
import { isSharedMap } from '../data/online.js';

const keepItem = (def) => !def || def.key || RUN_RULES.keepTypes.includes(def.type);

export class RunSystem {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.start = null;      // { items: { id: n }, gear: [instanceIds] }
    this.monsterExp = 0;    // EXP earned from monsters in this run
    this.pile = null;       // { map, x, y, items: { id: n }, gear: [instances], at }
    const ev = game.events;
    ev.on('mapEntered', (e) => { if (isSharedMap(e.id)) this.bank(); else if (!this.active) this.begin(); });
    ev.on('enemyDefeated', (e) => {
      const p = game.player;
      if (this.active && !e.summoned && e.exp > 0 && p && !p.isMaxLevel) this.monsterExp += Math.max(1, Math.round(e.exp * DIFFICULTY.expRate));
    });
  }
  // N10: also while RECONNECTING (pulling the cable before a death must not save the items); off in DEV ?offline
  enabled() { const g = this.game, o = g.online; return !!(g.runRulesOffline || (o && o.playerId && o.state !== 'offline')); }

  // ---------------- run start / end
  carried() {
    const g = this.game, inv = g.inventory, eq = g.equipment;
    const items = {};
    for (const [id, n] of Object.entries(inv.items)) if (!isGear(ITEMS[id])) items[id] = n;
    const gear = inv.gear.map((x) => x.instanceId);
    for (const slot of Object.keys(eq.slots)) { const inst = eq.slots[slot] && eq.instanceFor(slot); if (inst) gear.push(inst.instanceId); }
    return { items, gear };
  }
  begin() { this.active = true; this.start = this.carried(); this.monsterExp = 0; this.dirty(); }
  bank() { if (!this.active) return; this.active = false; this.start = null; this.monsterExp = 0; this.dirty(); }
  dirty() { if (this.game.save) this.game.save.dirty = true; }

  // what this run has gained so far (never key / quest items): { items: { id: n }, gear: [{ inst, slot|null }] }
  gained() {
    const g = this.game, inv = g.inventory, eq = g.equipment, s = this.start || { items: {}, gear: [] };
    const had = new Set(s.gear), items = {}, gear = [];
    for (const [id, n] of Object.entries(inv.items)) {
      const def = ITEMS[id];
      if (isGear(def) || keepItem(def)) continue;
      const extra = n - (s.items[id] || 0);
      if (extra > 0) items[id] = extra;
    }
    for (const inst of inv.gear) if (!had.has(inst.instanceId) && !keepItem(ITEMS[inst.itemId])) gear.push({ inst, slot: null });
    for (const slot of Object.keys(eq.slots)) {
      const inst = eq.slots[slot] && eq.instanceFor(slot);
      if (inst && !had.has(inst.instanceId) && !keepItem(ITEMS[inst.itemId])) gear.push({ inst, slot });
    }
    return { items, gear };
  }

  // ---------------- death
  onDeath() {
    if (!this.enabled() || !this.active) return null;
    const g = this.game, p = g.player, inv = g.inventory, eq = g.equipment, w = g.world;
    // EXP: half of this run's monster EXP, never below the start of the current level
    const lose = Math.floor(this.monsterExp * RUN_RULES.expLoss), lost = Math.min(lose, p.exp);
    p.exp -= lost;
    // items: out of the bag (worn gains are taken off first) into the pile
    const gain = this.gained(), items = {}, gear = [];
    for (const [id, n] of Object.entries(gain.items)) if (inv.remove(id, n)) items[id] = n;
    for (const { inst, slot } of gain.gear) {
      if (slot) { eq.slots[slot] = null; delete eq.inst[slot]; eq.changed(); g.events.emit('equipChanged', { slot, id: null, removed: inst.itemId }); gear.push(inst); }
      else if (inv.removeItem(inst.instanceId)) gear.push(inst);
    }
    if (gear.some(Boolean)) p.recomputeStats();
    const count = Object.values(items).reduce((a, b) => a + b, 0) + gear.length;
    const replaced = !!this.pile;
    if (count) {
      const at = w.map.findOpen(p.x, p.y, 4);
      this.pile = { map: w.mapId, x: Math.round(at.x), y: Math.round(at.y), items, gear, at: Date.now() };
    }
    this.begin(); // a new segment from what is left (the checkpoint may be in the dungeon)
    g.events.emit('runPenalty', { exp: lost, items: count, replaced: replaced && count > 0 });
    return { exp: lost, items: count };
  }
  pileCount(pile = this.pile) { return pile ? Object.values(pile.items).reduce((a, b) => a + b, 0) + pile.gear.length : 0; }

  // ---------------- recovery (your pile, opened or carried to you)
  recover(by = null) {
    const g = this.game, inv = g.inventory, pile = this.pile;
    if (!pile) return 0;
    let got = 0;
    for (const [id, n] of Object.entries(pile.items)) { const a = inv.add(id, n, true); got += a; if (a < n) pile.items[id] = n - a; else delete pile.items[id]; }
    pile.gear = pile.gear.filter((inst) => { if (inv.addItem(inst, true)) { got++; return false; } return true; });
    const left = this.pileCount();
    if (!left) this.pile = null;
    this.dirty();
    g.audio.sfx('quest');
    g.ui.toast(left ? `Recovered ${got} item(s) — the bag is full, ${left} still in the pile` : by ? `${by} brought back your belongings (${got} items)` : `Belongings recovered (${got} items)`, 3);
    g.events.emit('pileRecovered', { got, left, by });
    return got;
  }

  // ---------------- save
  serialize() { return { v: 1, active: this.active, start: this.start, monsterExp: this.monsterExp, pile: this.pile }; }
  load(d) {
    if (!d || typeof d !== 'object') return;
    this.active = !!d.active;
    this.start = d.start && typeof d.start === 'object' ? { items: { ...(d.start.items || {}) }, gear: [...(d.start.gear || [])] } : null;
    if (this.active && !this.start) this.start = this.carried();
    this.monsterExp = Math.max(0, d.monsterExp || 0);
    const pl = d.pile;
    this.pile = pl && typeof pl.map === 'string' && Number.isFinite(pl.x) && Number.isFinite(pl.y)
      ? { map: pl.map, x: pl.x, y: pl.y, at: pl.at || 0, items: Object.fromEntries(Object.entries(pl.items || {}).filter(([id, n]) => ITEMS[id] && n > 0)),
        gear: (pl.gear || []).filter((x) => x && ITEMS[x.itemId] && typeof x.instanceId === 'string') }
      : null;
    if (this.pile && !this.pileCount()) this.pile = null;
  }

  // ---------------- every frame: the pile interactables of the loaded grid (yours + party members' from the server)
  sync() {
    const g = this.game, w = g.world;
    if (!w || !w.interactables) return;
    const want = [];
    if (this.pile) want.push({ id: 'pile_self', owner: null, name: null, map: this.pile.map, x: this.pile.x, y: this.pile.y, n: this.pileCount() });
    const others = g.online && g.online.online ? g.online.piles || [] : [];
    for (const o of others) want.push({ id: 'pile_' + o.owner, owner: o.owner, name: o.name, map: o.m, x: o.x, y: o.y, n: o.n });
    const key = want.map((p) => `${p.id}:${p.map}:${p.x}:${p.y}:${p.n}`).join('|') + '@' + w.gridId;
    if (key === this.syncKey && w.interactables === this.syncList) return;
    this.syncKey = key; this.syncList = w.interactables;
    for (let i = w.interactables.length - 1; i >= 0; i--) if (w.interactables[i].kind === 'deathPile') w.interactables.splice(i, 1);
    for (const p of want) {
      const def = w.mapManager.get(p.map);
      if (!def || def.grid !== w.gridId) continue;
      w.interactables.push({ id: p.id, kind: 'deathPile', x: p.x, y: p.y, radius: RUN_RULES.pileRadius, mapId: p.map, owner: p.owner, ownerName: p.name, count: p.n,
        prompt: p.owner ? `Carry ${p.name}'s belongings (${p.n})` : `Recover your belongings (${p.n})` });
    }
  }
}
