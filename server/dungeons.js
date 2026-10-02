// ONLINE N5 — the Dungeon Gate on the server (rules: ONLINE.dungeon). Everything that decides an entry happens here:
//   solo   'dungeonEnter'   : you stand in a city, the area is unlocked for you -> new instance -> 'dungeonGo'
//   party  'dungeonPropose' : leader only; every member online, in a city and with the area unlocked (else refused with
//                             the names) -> READY CHECK sent to all ('dungeonCheck'); each member answers for themselves
//                             ('dungeonAnswer'); all yes = one instance for everyone; a no / the timer / any party change
//                             cancels it ('dungeonCancel'). Nobody is moved without their own yes.
// UNLOCKS: read from the player's save held by the server (worldProgress.unlockedMaps). That save is still written by the
// browser — N8 replaces this one function with server-owned progression (boss kills decided by the server).
import { ONLINE, dungeonArea } from '../src/data/online.js';
import { NET_ERROR } from '../src/net/protocol.js';
import { InstanceManager } from './instances.js';

export class DungeonService {
  constructor(server) {
    this.server = server;
    this.instances = new InstanceManager();
    this.checks = new Map();   // check id -> { id, area, partyId, leader, members: [ids], yes: Set, ends }
    this.counter = 0;
    this.unlockCache = new Map(); // player id -> { at, maps }
    server.handle('dungeonEnter', (s, m) => this.enterSolo(s, m.area));
    server.handle('dungeonPropose', (s, m) => this.propose(s, m.area));
    server.handle('dungeonAnswer', (s, m) => this.answer(s, m.check, m.yes));
    server.handle('dungeonCancel', (s) => { const c = this.checkOfParty(this.server.parties.partyOf(s.id)); if (c && c.leader === s.id) this.cancel(c, 'the leader cancelled'); });
    server.on('sessionClosed', (s) => { for (const c of this.checks.values()) if (c.members.includes(s.id)) this.cancel(c, `${s.name} disconnected`); });
    this.timer = setInterval(() => this.tick(), 500);
    this.timer.unref?.();
  }

  refuse(s, text) { s.send('error', { code: NET_ERROR.dungeon, text }); return false; }
  name(id) { return this.server.sessions.get(id)?.name || 'a member'; }

  // unlocked maps of a player, from the save the server holds (N8: server-owned progression instead)
  unlocked(playerId) {
    const rec = this.server.saves.store.get(playerId);
    const hit = this.unlockCache.get(playerId);
    if (hit && rec && hit.at === rec.at) return hit.maps;
    let maps = {};
    try { maps = (rec && rec.main && JSON.parse(rec.main).worldProgress?.unlockedMaps) || {}; } catch { maps = {}; }
    this.unlockCache.set(playerId, { at: rec?.at, maps });
    return maps;
  }
  canEnter(playerId, areaId) { const a = dungeonArea(areaId); return !!a && (a.free || !!this.unlocked(playerId)[areaId]); }

  // why this player cannot go right now (null = ok)
  problem(playerId, areaId) {
    const s = this.server.sessions.get(playerId);
    if (!s) return 'is offline';
    if (!s.presence?.room) return 'is not in a city';
    if (!this.canEnter(playerId, areaId)) return 'has not unlocked this area';
    return null;
  }

  enterSolo(s, areaId) {
    if (!dungeonArea(areaId)) return this.refuse(s, 'unknown area');
    const why = this.problem(s.id, areaId);
    if (why) return this.refuse(s, why === 'has not unlocked this area' ? 'This area is locked for you' : why === 'is not in a city' ? 'Use a Dungeon Gate in a city' : why);
    const c = this.checkOfParty(this.server.parties.partyOf(s.id));
    if (c) this.cancel(c, `${s.name} entered alone`);
    this.go([s.id], areaId, 'solo');
    return true;
  }

  propose(s, areaId) {
    const p = this.server.parties.partyOf(s.id);
    if (!dungeonArea(areaId)) return this.refuse(s, 'unknown area');
    if (!p) return this.refuse(s, 'you are not in a party — enter solo');
    if (p.leader !== s.id) return this.refuse(s, 'only the party leader chooses the area');
    if (p.members.size < 2) return this.refuse(s, 'your party is just you — enter solo');
    const ids = [...p.members.keys()];
    const problems = ids.map((id) => [id, this.problem(id, areaId)]).filter(([, w]) => w);
    if (problems.length) return this.refuse(s, problems.map(([id, w]) => `${p.members.get(id).name} ${w}`).join(' · '));
    const old = this.checkOfParty(p);
    if (old) this.cancel(old, 'a new area was chosen', true);
    const c = { id: 'dc' + (++this.counter).toString(36), area: areaId, partyId: p.id, leader: s.id, members: ids, yes: new Set([s.id]), ends: Date.now() + ONLINE.dungeon.readyTimeout * 1000 };
    this.checks.set(c.id, c);
    this.push(c);
    return true;
  }

  answer(s, checkId, yes) {
    const c = this.checks.get(checkId);
    if (!c || !c.members.includes(s.id)) return this.refuse(s, 'that entry is no longer open');
    if (!yes) return this.cancel(c, `${s.name} declined`);
    c.yes.add(s.id);
    if (c.yes.size < c.members.length) return this.push(c);
    // everyone said yes: check again (things change in 30 s), then one instance for all
    const problems = c.members.map((id) => [id, this.problem(id, c.area)]).filter(([, w]) => w);
    if (problems.length) return this.cancel(c, problems.map(([id, w]) => `${this.name(id)} ${w}`).join(' · '));
    this.checks.delete(c.id);
    this.go(c.members, c.area, 'party');
  }

  go(ids, area, mode) {
    const inst = this.instances.create({ area, mode, members: ids });
    const names = ids.map((id) => this.name(id));
    for (const id of ids) this.server.sessions.get(id)?.send('dungeonGo', { instance: inst.id, area, mode, members: names });
    this.server.log.info?.(`[server] instance ${inst.id}: ${area} (${mode}) — ${names.join(', ')}`);
    return inst;
  }

  checkOfParty(p) { if (p) for (const c of this.checks.values()) if (c.partyId === p.id) return c; return null; }

  push(c) {
    const members = c.members.map((id) => ({ id, name: this.name(id), answer: c.yes.has(id) ? 'yes' : 'wait' }));
    for (const id of c.members) this.server.sessions.get(id)?.send('dungeonCheck', { check: c.id, area: c.area, leader: this.name(c.leader), members, ends: c.ends });
  }

  cancel(c, reason, quiet = false) {
    this.checks.delete(c.id);
    if (!quiet) for (const id of c.members) this.server.sessions.get(id)?.send('dungeonCancel', { reason });
  }

  tick() {
    const now = Date.now();
    for (const c of [...this.checks.values()]) {
      const p = this.server.parties.parties.get(c.partyId);
      if (now > c.ends) this.cancel(c, 'not everyone answered in time');
      else if (!p || p.members.size !== c.members.length || c.members.some((id) => !p.members.has(id) || !p.members.get(id).online)) this.cancel(c, 'the party changed');
    }
  }

  close() { clearInterval(this.timer); }
}
