// ONLINE N8 — server-owned progression: which bosses each player has defeated (the first kill of each), kept in the
// player's record next to the save (`progress: { v, bosses: { id: time } }`). The SERVER decides it:
//   - a run-map room's HOST reports 'bossKill' { boss } when that boss dies (the host simulates the fight)
//   - the server checks: a real boss, the reporter hosts the room `<run>:<boss map>`, not already credited in this run
//   - every member of that run standing in that room gets the credit ('bossCredit' { boss, first }); first = this player
//     never had it (the client gives the first-kill rewards; a repeat kill = EXP + loot again, boss/bossSystem.js)
//   - login sends 'progress' { bosses: [ids] }; the client adds kills it is missing (net/netProgress.js)
// The Dungeon Gate asks unlockedArea() (map requirements over the server's boss list) — no longer the browser's save.
// A player record made before N8 is SEEDED once from the save's worldProgress.defeatedBosses (trusted one time); after
// that the save text never changes progress. New Game (saveRemove) clears it (server/saves.js keeps the old one aside).
import { BOSSES } from '../src/data/bosses.js';
import { MAPS } from '../src/maps/mapRegistry.js';
import { allMet } from '../src/progression/requirements.js';
import { dungeonArea } from '../src/data/online.js';
import { NET_ERROR } from '../src/net/protocol.js';

const MAP_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]));

export class ProgressService {
  constructor(server, store) {
    this.server = server;
    this.store = store;
    server.on('sessionOpened', (s) => this.push(s));
    server.handle('bossKill', (s, m) => this.onKill(s, m.boss));
  }

  // this player's progress (seeds a pre-N8 record once from its save)
  get(playerId) {
    const r = this.store.get(playerId) || {};
    if (r.progress && typeof r.progress.bosses === 'object') return r.progress;
    const progress = { v: 1, bosses: {} };
    try {
      const d = r.main && JSON.parse(r.main), had = d && d.worldProgress && d.worldProgress.defeatedBosses;
      if (had && typeof had === 'object') for (const id of Object.keys(had)) if (BOSSES[id]) progress.bosses[id] = Date.now();
    } catch { /* unreadable save: start empty */ }
    this.store.set(playerId, { ...r, progress });
    return progress;
  }
  bosses(playerId) { return Object.keys(this.get(playerId).bosses); }
  push(s) { s.send('progress', { bosses: this.bosses(s.id) }); }

  // New Game: progress starts over (called by SaveService.remove)
  reset(s) {
    const r = this.store.get(s.id) || {};
    this.store.set(s.id, { ...r, progress: { v: 1, bosses: {} } });
    this.push(s);
  }

  // a dungeon area this player may enter from a Dungeon Gate: free, or its map's requirements met by server progress
  unlockedArea(playerId, areaId) {
    const a = dungeonArea(areaId), map = MAP_BY_ID[areaId];
    if (!a || !map) return false;
    if (a.free) return true;
    return allMet(map.requires || [], { bosses: new Set(this.bosses(playerId)) });
  }

  refuse(s, text) { s.send('error', { code: NET_ERROR.bad, text }); return false; }

  onKill(s, bossId) {
    const def = BOSSES[bossId];
    if (!def || def.planned) return this.refuse(s, 'unknown boss');
    const inst = this.server.dungeons.instances.of(s.id);
    if (!inst) return this.refuse(s, 'not in a dungeon run');
    const room = `${inst.id}:${def.map}`;
    if (this.server.city.hostOf(room) !== s.id) return this.refuse(s, 'only the host of that fight reports it');
    inst.kills = inst.kills || new Set();
    if (inst.kills.has(bossId)) return false; // already credited in this run (bosses come back with the next run)
    inst.kills.add(bossId);
    const credited = [];
    for (const x of this.server.city.rooms.get(room) || []) {
      if (this.server.dungeons.instances.of(x.id) !== inst) continue;
      const p = this.get(x.id), first = !p.bosses[bossId];
      if (first) { p.bosses[bossId] = Date.now(); this.store.set(x.id, { ...(this.store.get(x.id) || {}), progress: p }); }
      x.send('bossCredit', { boss: bossId, first });
      credited.push(x.name + (first ? ' (first)' : ''));
    }
    this.server.log.info?.(`[server] ${def.name} defeated in ${inst.id} — ${credited.join(', ')}`);
    return true;
  }
}
