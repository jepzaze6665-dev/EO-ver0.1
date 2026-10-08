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
    this.stats = null;      // RUN SUMMARY: { dmg, heal, deaths, kills, bosses: [ids], gold, exp, startLevel, startExp, area, maps, t0 }
    const ev = game.events;
    const mine = (x) => x && x === game.player;
    ev.on('damageDealt', (e) => { const st = this.stats; if (!st || !e.amount) return; const src = e.source && (e.source.owner || e.source); if (mine(src) && e.target && !e.target.isAlly && e.target !== game.player) st.dmg += e.amount; });
    ev.on('healed', (e) => { if (this.stats && e.amount > 0) this.stats.heal += e.amount; });
    ev.on('playerDowned', (e) => { if (this.stats && mine(e.player)) { this.stats.deaths++; this.downedAt = Date.now(); } });
    ev.on('goldChanged', (e) => { if (this.stats && mine(e.entity) && e.amount > 0) this.stats.gold += e.amount; });
    ev.on('expGained', (e) => { if (this.stats && mine(e.entity) && e.amount > 0) this.stats.exp += e.amount; });
    ev.on('bossDefeated', (e) => { const id = e && (e.id || e.bossId || (e.boss && e.boss.id)); if (this.stats && id && !this.stats.bosses.includes(id)) this.stats.bosses.push(id); });
    ev.on('mapEntered', (e) => { if (this.stats && !isSharedMap(e.id) && !this.stats.maps.includes(e.id)) this.stats.maps.push(e.id); });
    ev.on('mapEntered', (e) => { if (isSharedMap(e.id)) this.bank(); else if (!this.active) this.begin(); });
    ev.on('enemyDefeated', (e) => {
      const p = game.player;
      if (this.active && !e.summoned && e.exp > 0 && p && !p.isMaxLevel) this.monsterExp += Math.max(1, Math.round(e.exp * DIFFICULTY.expRate));
      if (this.stats && !e.summoned && !e.boss) this.stats.kills++;
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
  begin() {
    this.active = true; this.start = this.carried(); this.monsterExp = 0;
    const p = this.game.player, w = this.game.world;
    if (!this.stats) this.stats = { dmg: 0, heal: 0, deaths: 0, kills: 0, bosses: [], gold: 0, exp: 0, startLevel: p.level, startExp: p.exp, area: w && w.mapId, maps: w && w.mapId ? [w.mapId] : [], t0: Date.now() };
    this.dirty();
  }
  // RUN SUMMARY data of the run that just ended (what it gained + the stats), 'runSummary' for the UI
  summary() {
    const st = this.stats, p = this.game.player;
    if (!st) return null;
    const gain = this.gained();
    return { ...st, bosses: [...st.bosses], maps: [...st.maps], level: p.level, levelUp: p.level - st.startLevel, items: gain.items, gear: gain.gear.map((x) => x.inst.itemId), secs: Math.round((Date.now() - st.t0) / 1000) };
  }
  bank() {
    if (!this.active && !this.stats) return;
    const sum = this.summary();
    this.active = false; this.start = null; this.monsterExp = 0; this.stats = null; this.dirty();
    if (sum && (sum.kills || sum.dmg || sum.exp || sum.bosses.length || sum.gold)) this.game.events.emit('runSummary', sum);
  }
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
    if (this.stats && !(this.downedAt && Date.now() - this.downedAt < 30000)) this.stats.deaths++; // a bleed-out after DOWNED is one fall
    this.downedAt = 0;
    if (!this.enabled() || !this.active) return null;
    const g = this.game, p = g.player, inv = g.inventory, eq = g.equipment, w = g.world;
    // EXP: half of this run's monster EXP, never below the start of the current level
    const lose = Math.floor(this.monsterExp * RUN_RULES.expLoss), lost = Math.min(lose, p.exp);
    // ONLINE H5c: every loss carries the reason pileDrop:<pile time> so the server keeps the same pile (server/economy.js)
    const E = g.online && g.online.econ, stamp = Date.now(), why = (fn) => (E ? E.why('pileDrop', stamp, fn) : fn());
    const gain = this.gained(), items = {}, gear = [];
    why(() => {
      p.exp -= lost;
      if (E && lost) E.note(['xp-', lost]);
      // items: out of the bag (worn gains are taken off first) into the pile
      for (const [id, n] of Object.entries(gain.items)) if (inv.remove(id, n)) items[id] = n;
      for (const { inst, slot } of gain.gear) {
        if (slot) { eq.slots[slot] = null; delete eq.inst[slot]; eq.changed(); g.events.emit('equipChanged', { slot, id: null, removed: inst.itemId }); gear.push(inst); if (E) E.note(['g-', inst.instanceId]); }
        else if (inv.removeItem(inst.instanceId)) gear.push(inst);
      }
    });
    if (gear.some(Boolean)) p.recomputeStats();
    const count = Object.values(items).reduce((a, b) => a + b, 0) + gear.length;
    const replaced = !!this.pile;
    if (count) {
      const at = w.map.findOpen(p.x, p.y, 4);
      this.pile = { map: w.mapId, x: Math.round(at.x), y: Math.round(at.y), items, gear, at: stamp };
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
    const E = g.online && g.online.econ, take = () => { // ONLINE H5c: the server gives back only what that pile holds
      for (const [id, n] of Object.entries(pile.items)) { const a = inv.add(id, n, true); got += a; if (a < n) pile.items[id] = n - a; else delete pile.items[id]; }
      pile.gear = pile.gear.filter((inst) => { if (inv.addItem(inst, true)) { got++; return false; } return true; });
    };
    if (E) E.why('pile', pile.at, take); else take();
    const left = this.pileCount();
    if (!left) this.pile = null;
    this.dirty();
    g.audio.sfx('quest');
    g.ui.toast(left ? `Recovered ${got} item(s) — the bag is full, ${left} still in the pile` : by ? `${by} brought back your belongings (${got} items)` : `Belongings recovered (${got} items)`, 3);
    g.events.emit('pileRecovered', { got, left, by });
    return got;
  }

  // ---------------- save
  serialize() { return { v: 1, active: this.active, start: this.start, monsterExp: this.monsterExp, pile: this.pile, stats: this.stats }; }
  load(d) {
    if (!d || typeof d !== 'object') return;
    this.active = !!d.active;
    this.start = d.start && typeof d.start === 'object' ? { items: { ...(d.start.items || {}) }, gear: [...(d.start.gear || [])] } : null;
    if (this.active && !this.start) this.start = this.carried();
    this.monsterExp = Math.max(0, d.monsterExp || 0);
    const st = d.stats;
    this.stats = this.active && st && typeof st === 'object' ? { dmg: +st.dmg || 0, heal: +st.heal || 0, deaths: +st.deaths || 0, kills: +st.kills || 0, bosses: Array.isArray(st.bosses) ? st.bosses.filter((x) => typeof x === 'string') : [],
      gold: +st.gold || 0, exp: +st.exp || 0, startLevel: +st.startLevel || 1, startExp: +st.startExp || 0, area: st.area || null, maps: Array.isArray(st.maps) ? st.maps.filter((x) => typeof x === 'string') : [], t0: +st.t0 || Date.now() } : null;
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
