// ONLINE N5 — the Dungeon Gate on the server (rules: ONLINE.dungeon). Everything that decides an entry happens here:
//   solo   'dungeonEnter'   : you stand in a city, the area is unlocked for you -> new instance -> 'dungeonGo'
//   party  'dungeonPropose' : leader only; every member online, in a city and with the area unlocked (else refused with
//                             the names) -> READY CHECK sent to all ('dungeonCheck'); each member answers for themselves
//                             ('dungeonAnswer'); all yes = one instance for everyone; a no / the timer / any party change
//                             cancels it ('dungeonCancel'). Nobody is moved without their own yes.
// N6 RUNS: roomFor(session, map) is asked for every position (server/cityRooms.js): a city map = leave the run (if any) and
//   join that city's room; any other map = the run's room `<instance>:<map>` — a player with no run (walked out of the
//   city by road, or came back after the reconnect grace) gets a SOLO run there. The run remembers its city (return
//   point) and every map visited; members of one run on one map see each other, nobody else does. 'dungeonLeave' (the
//   return stone at an area's start) ends your part of the run -> 'dungeonLeft' { city }. A dropped member keeps their
//   place for ONLINE.dungeon.reconnectGrace s; an empty run is deleted.
// UNLOCKS (N8): server-owned progression — server/progress.js unlockedArea (boss kills the server credited).
import { ONLINE, dungeonArea, isSharedMap } from '../src/data/online.js';
import { NET_ERROR } from '../src/net/protocol.js';
import { InstanceManager } from './instances.js';

export class DungeonService {
  constructor(server) {
    this.server = server;
    this.instances = new InstanceManager({ onClose: (inst) => this.server.log.info?.(`[server] instance ${inst.id} closed (empty)`) });
    this.lastCity = new Map(); // player id -> the last city room they stood in (return point of a run started on foot)
    this.checks = new Map();   // check id -> { id, area, partyId, leader, members: [ids], yes: Set, ends }
    this.counter = 0;
    server.handle('dungeonEnter', (s, m) => this.enterSolo(s, m.area));
    server.handle('dungeonPropose', (s, m) => this.propose(s, m.area));
    server.handle('dungeonAnswer', (s, m) => this.answer(s, m.check, m.yes));
    server.handle('dungeonCancel', (s) => { const c = this.checkOfParty(this.server.parties.partyOf(s.id)); if (c && c.leader === s.id) this.cancel(c, 'the leader cancelled'); });
    server.handle('dungeonLeave', (s) => this.leaveToCity(s));
    server.on('sessionClosed', (s) => {
      for (const c of this.checks.values()) if (c.members.includes(s.id)) this.cancel(c, `${s.name} disconnected`);
      const inst = this.instances.of(s.id);
      if (inst) inst.offline.set(s.id, Date.now());
    });
    server.on('sessionOpened', (s) => { const inst = this.instances.of(s.id); s.send('instanceState', { instance: inst ? this.instances.view(inst) : null }); });
    this.timer = setInterval(() => this.tick(), 500);
    this.timer.unref?.();
  }

  refuse(s, text) { s.send('error', { code: NET_ERROR.dungeon, text }); return false; }
  name(id) { return this.server.sessions.get(id)?.name || 'a member'; }

  canEnter(playerId, areaId) { return this.server.progress.unlockedArea(playerId, areaId); }

  // why this player cannot go right now (null = ok)
  problem(playerId, areaId) {
    const s = this.server.sessions.get(playerId);
    if (!s) return 'is offline';
    if (!isSharedMap(s.presence?.room)) return 'is not in a city';
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
    const city = this.server.sessions.get(ids[0])?.presence?.room;
    const inst = this.instances.create({ area, mode, members: ids, city: isSharedMap(city) ? city : 'lumina', names: Object.fromEntries(ids.map((id) => [id, this.name(id)])) });
    const names = ids.map((id) => this.name(id));
    for (const id of ids) this.server.sessions.get(id)?.send('dungeonGo', { instance: inst.id, area, mode, members: names });
    this.pushState(inst);
    this.server.log.info?.(`[server] instance ${inst.id}: ${area} (${mode}) — ${names.join(', ')}`);
    return inst;
  }

  // ---------------- N6 runs
  roomFor(s, m) {
    if (isSharedMap(m)) {
      this.lastCity.set(s.id, m);
      if (this.instances.of(s.id)) this.leaveRun(s.id);
      return m;
    }
    let inst = this.instances.of(s.id);
    if (!inst) inst = this.startOnFoot(s, m);
    const newMap = !inst.maps.has(m);
    inst.maps.add(m);
    if (inst.offline.delete(s.id) || newMap) this.pushState(inst);
    return `${inst.id}:${m}`;
  }

  // walked out of a city by road (or back after the grace ran out): a solo run where they stand
  startOnFoot(s, m) {
    const inst = this.instances.create({ area: m, mode: 'solo', members: [s.id], city: this.lastCity.get(s.id) || 'lumina', names: { [s.id]: s.name } });
    this.server.log.info?.(`[server] instance ${inst.id}: ${m} (solo, on foot) — ${s.name}`);
    this.pushState(inst);
    return inst;
  }

  leaveToCity(s) {
    const inst = this.instances.of(s.id);
    if (!inst) return this.refuse(s, 'you are not in a dungeon run');
    const city = inst.city;
    this.leaveRun(s.id);
    this.server.city.kick(s); // out of the run's room now; the next position puts them in the city room
    s.send('dungeonLeft', { city });
    return true;
  }

  leaveRun(playerId) {
    const inst = this.instances.leave(playerId);
    this.server.sessions.get(playerId)?.send('instanceState', { instance: null });
    if (inst && this.instances.get(inst.id)) this.pushState(inst);
  }

  pushState(inst) {
    const view = this.instances.view(inst);
    for (const id of inst.members) if (!inst.offline.has(id)) this.server.sessions.get(id)?.send('instanceState', { instance: view });
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
    for (const inst of [...this.instances.list.values()]) for (const [id, since] of [...inst.offline]) {
      if (now - since > ONLINE.dungeon.reconnectGrace * 1000) { this.instances.leave(id); if (this.instances.get(inst.id)) this.pushState(inst); }
    }
    for (const c of [...this.checks.values()]) {
      const p = this.server.parties.parties.get(c.partyId);
      if (now > c.ends) this.cancel(c, 'not everyone answered in time');
      else if (!p || p.members.size !== c.members.length || c.members.some((id) => !p.members.has(id) || !p.members.get(id).online)) this.cancel(c, 'the party changed');
    }
  }

  close() { clearInterval(this.timer); }
}
