import { MAPS } from '../maps/mapRegistry.js';
import { BOSSES } from '../data/bosses.js';
import { ROUTES } from '../data/routes.js';
import { allMet, evaluateAll } from '../progression/requirements.js';

// WORLD PROGRESSION — the one place that knows how far the player has pushed through the world:
//   defeatedBosses · unlockedMaps · triggeredEvents · currentRoute   (owned + saved here)
//   completedQuests · discoveredSecrets · visitedMaps                 (read from their own systems — one source of truth)
// Every gate / exit / trigger asks this object through data requirements (progression/requirements.js), e.g.
//   map A2 `requires: [{ type: 'boss_defeated', boss: 'boss_a1' }]`  — nobody writes "if bossA1Dead".
// Unlocks are permanent: once a map's requirements are met it is recorded in unlockedMaps (event 'mapUnlocked').
// serialize() / load() are plain JSON: LocalStorage today, a server tomorrow (save/save.js decides where).
export class WorldProgression {
  constructor(game, { maps = MAPS, bosses = BOSSES, routes = ROUTES } = {}) {
    this.game = game;
    this.maps = maps;
    this.mapById = Object.fromEntries(maps.map((m) => [m.id, m]));
    this.bosses = bosses;
    this.routes = routes;
    this.reset();
    const ev = game.events;
    const refresh = () => this.refreshUnlocks();
    for (const name of ['bossDefeated', 'flag', 'questCompleted', 'levelUp', 'hiddenFound', 'itemCollected']) ev.on(name, refresh);
    // the route you are on = the route of the last field map you entered (cities keep the last one)
    ev.on('mapEntered', (e) => { const d = this.mapById[e.id]; if (d && d.route && d.route !== this.currentRoute) { this.currentRoute = d.route; this.dirty(); } });
  }
  reset() {
    this.defeatedBosses = {};   // bossId -> { time } (play time of the first kill)
    this.unlockedMaps = {};     // mapId -> true
    this.triggeredEvents = {};  // world trigger / event id -> count
    this.currentRoute = null;
  }
  dirty() { if (this.game.save) this.game.save.dirty = true; }

  // ---------------- bosses
  isBossDefeated(id) { return !!this.defeatedBosses[id]; }
  // returns true the first time (rewards are given once per character)
  defeatBoss(id) {
    if (this.defeatedBosses[id]) return false;
    this.defeatedBosses[id] = { time: Math.round(this.game.playTime || 0) };
    this.dirty();
    this.refreshUnlocks();
    return true;
  }

  // ---------------- maps
  isMapUnlocked(id) { return !!this.unlockedMaps[id]; }
  unlockMap(id, reason = 'requirements') {
    if (!this.mapById[id] || this.unlockedMaps[id]) return false;
    this.unlockedMaps[id] = true;
    this.dirty();
    this.game.events.emit('mapUnlocked', { id, map: this.mapById[id], reason });
    return true;
  }
  // record every map whose requirements are met now (repeat: one unlock can satisfy another map's requirement)
  // reason 'start' = new game / load (the UI stays quiet)
  refreshUnlocks(reason = 'requirements') {
    let changed = true;
    while (changed) {
      changed = false;
      const ctx = this.context();
      for (const m of this.maps) if (!this.unlockedMaps[m.id] && allMet(m.requires, ctx)) { this.unlockMap(m.id, reason); changed = true; }
    }
  }
  // why a map is still locked (first unmet requirement), for UI text
  lockReason(id) {
    const m = this.mapById[id];
    if (!m || this.isMapUnlocked(id)) return null;
    const miss = evaluateAll(m.requires, this.context()).find((r) => !r.met);
    return miss ? miss.label : 'Locked';
  }
  isVisited(id) { return !!(this.game.world && this.game.world.state.maps[id]); }

  // ---------------- events (world triggers)
  hasEvent(id) { return !!this.triggeredEvents[id]; }
  markEvent(id) { this.triggeredEvents[id] = (this.triggeredEvents[id] || 0) + 1; this.dirty(); }

  // ---------------- requirement context (progression/requirements.js) — class progression reuses the same fields
  context() {
    const g = this.game, base = g.progression && g.player ? g.progression.baseContext() : { flags: (g.world && g.world.state.flags) || {} };
    return {
      ...base,
      bosses: new Set(Object.keys(this.defeatedBosses)),
      maps: new Set(Object.keys(this.unlockedMaps)),
      visited: new Set(Object.keys((g.world && g.world.state.maps) || {})),
      events: new Set(Object.keys(this.triggeredEvents)),
    };
  }
  meets(reqs) { return allMet(reqs, this.context()); }

  // ---------------- status views for the UI
  // one map: unlocked / visited / its boss / complete (= its boss is down, or it has no boss and was visited)
  mapStatus(id) {
    const m = this.mapById[id];
    if (!m) return null;
    const boss = m.bossId ? this.bosses[m.bossId] : null;
    const bossDefeated = boss ? this.isBossDefeated(boss.id) : false;
    const hidden = (m.hiddenAreas || []).map((h) => !!(this.game.world && this.game.world.state.hidden[h]));
    return {
      id, name: m.name, short: m.short || m.name, type: m.type, route: m.route,
      unlocked: this.isMapUnlocked(id), visited: this.isVisited(id), lockReason: this.lockReason(id),
      boss, bossDefeated, complete: boss ? bossDefeated : this.isVisited(id),
      hiddenFound: hidden.filter(Boolean).length, hiddenTotal: hidden.length,
    };
  }
  routeStatus(routeId) {
    const r = this.routes[routeId];
    if (!r) return null;
    const steps = r.steps.map((s) => {
      const st = this.mapStatus(s.map);
      const boss = this.bosses[s.boss];
      return st ? { ...st, boss, bossDefeated: this.isBossDefeated(s.boss) } : { id: s.map, name: s.name || s.map, short: s.name || s.map, planned: true, boss, unlocked: false, bossDefeated: false, complete: false };
    });
    return { route: r, steps, complete: r.playable && steps.every((s) => s.bossDefeated), city: this.mapStatus(r.to) };
  }

  // ---------------- save / load
  // the full picture in one object (spec shape) — handy for a server, debug tools and tests
  snapshot() {
    const g = this.game, w = g.world;
    return {
      defeatedBosses: Object.keys(this.defeatedBosses),
      completedQuests: Object.keys((g.quests && g.quests.completed) || {}),
      unlockedMaps: Object.keys(this.unlockedMaps),
      triggeredEvents: Object.keys(this.triggeredEvents),
      discoveredSecrets: Object.keys((w && w.state.hidden) || {}),
      visitedMaps: Object.keys((w && w.state.maps) || {}),
      currentRoute: this.currentRoute,
    };
  }
  serialize() {
    return { v: 1, defeatedBosses: { ...this.defeatedBosses }, unlockedMaps: { ...this.unlockedMaps }, triggeredEvents: { ...this.triggeredEvents }, currentRoute: this.currentRoute,
      runKills: this.game.bosses ? [...this.game.bosses.runKills] : [] }; // bosses down in the current dungeon run (boss/bossSystem.js)
  }
  // d: saved data or undefined (saves from before V2.2 -> rebuilt from the old world state so nobody gets locked out)
  load(d, legacyWorld) {
    this.reset();
    if (d) {
      const known = (o, ok) => Object.fromEntries(Object.entries(o || {}).filter(([id]) => ok(id)));
      this.defeatedBosses = known(d.defeatedBosses, (id) => !!this.bosses[id]);
      this.unlockedMaps = known(d.unlockedMaps, (id) => !!this.mapById[id]);
      this.triggeredEvents = { ...(d.triggeredEvents || {}) };
      this.currentRoute = d.currentRoute || null;
    } else if (legacyWorld) this.migrate(legacyWorld);
    this.refreshUnlocks('start');
  }
  // old save: where the player already went proves which bosses they got past (maps with an entry requirement)
  migrate(ws) {
    const flags = ws.flags || {}, visited = ws.maps || {};
    for (const b of Object.values(this.bosses)) {
      if (b.planned) continue;
      const beyond = this.maps.filter((m) => (m.requires || []).some((r) => r.type === 'boss_defeated' && (r.boss || r.requiredBossId) === b.id));
      const killedGuardian = b.monster && ws.killed && ws.killed[b.monster];
      if (killedGuardian || (b.monster === 'guardian' && flags.guardianDefeated) || beyond.some((m) => visited[m.id])) this.defeatedBosses[b.id] = { time: 0, migrated: true };
    }
  }
}
