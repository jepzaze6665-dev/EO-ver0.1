// ONLINE N2 — shared city rooms (rules: src/data/online.js). A player whose last 'pos' is on a shared map (Lumina,
// City 2) is in that map's room: everyone in it sees everyone else.
// N6: rooms are also INSTANCE MAP rooms — `<instance id>:<map>` (server/dungeons.js roomFor decides the key): members of
// the same run on the same map see each other, nobody else does.
// N7a ROOM HOST: every run-map room has one host (the first in; when the host leaves: the party leader if present, else
// the longest present) — the client that simulates that map's monsters ('roomHost'). The server relays the host's
// 'mobs' snapshots to the others and everyone else's 'mobHit' to the host (from = who hit). Not authoritative yet (N8). Movement is batched per room ONLINE.serverTick times
// a second, and only for players who moved. A move faster than ONLINE.maxSpeed is passed on as a SNAP (teleport:
// waystone, map entry) instead of being refused — cities have no combat, positions there are not authoritative (N7
// adds server checks for dungeon movement). Only presence travels: name, class, level, position, facing, animation.
import { ONLINE, isSharedMap } from '../src/data/online.js';
import { NET_ERROR } from '../src/net/protocol.js';
import { PARTY } from '../src/data/party.js';

const entry = (s) => { const p = s.presence; return [s.id, s.name, p.x, p.y, p.d, p.a, p.k, p.c, p.l, p.h, p.dn ? 1 : 0]; };

export class CityRooms {
  constructor(server) {
    this.server = server;
    this.rooms = new Map();   // room key -> Set of sessions (insertion order = who came first)
    this.hosts = new Map();   // run-map room key -> host player id
    server.handle('pos', (s, m) => this.onPos(s, m));
    server.handle('look', (s, m) => this.onLook(s, m));
    server.handle('leave', (s) => this.leave(s, 'left'));
    // revive across clients: same run map, target really downed, reviver close enough (positions from presence)
    server.handle('revive', (s, m) => {
      const t = this.server.sessions.get(m.to), a = s.presence, b = t && t.presence;
      if (!t || t === s || !a || !b || !a.room || a.room !== b.room || isSharedMap(a.room)) return s.send('error', { code: NET_ERROR.party, text: 'nobody to revive here' });
      if (!b.dn) return s.send('error', { code: NET_ERROR.party, text: `${t.name} is not downed` });
      if (Math.hypot(a.x - b.x, a.y - b.y) > PARTY.downed.reviveRange + 40) return s.send('error', { code: NET_ERROR.party, text: 'too far to revive' });
      b.dn = false;
      t.send('revived', { by: s.name });
    });
    // friends' skill effects: anyone in a room, to the others there (presentation only)
    server.handle('fx', (s, m) => { const r = s.presence?.room; if (r) this.send(r, 'fx', { c: m.c, s: m.s, from: s.id }, s); });
    server.handle('boss', (s, m) => { const r = s.presence?.room; if (r && this.hosts.get(r) === s.id) this.send(r, 'boss', { b: m.b }, s); });
    server.handle('mobAct', (s, m) => { const r = s.presence?.room; if (r && this.hosts.get(r) === s.id) this.send(r, 'mobAct', { id: m.id, k: m.k, d: m.d }, s); });
    server.handle('mobs', (s, m) => { const r = s.presence?.room; if (r && this.hosts.get(r) === s.id) this.send(r, 'mobs', { ps: m.ps, full: m.full }, s); });
    server.handle('mobHit', (s, m) => {
      const r = s.presence?.room, h = r && this.hosts.get(r);
      if (!h || h === s.id) return;
      this.server.sessions.get(h)?.send('mobHit', { ...m, from: s.id });
    });
    server.on('sessionClosed', (s) => this.leave(s, 'offline'));
    this.timer = setInterval(() => this.tick(), 1000 / ONLINE.serverTick);
    this.timer.unref?.();
  }

  presence(s) {
    if (!s.presence) s.presence = { room: null, m: null, x: 0, y: 0, d: 0, a: 'idle', k: 0, c: null, l: 1, h: 1, t: 0, dirty: false, snap: false };
    return s.presence;
  }

  // which room a position belongs to: a city map = its room; otherwise the run's room (dungeons) or none
  roomKey(s, m) { return this.server.dungeons ? this.server.dungeons.roomFor(s, m) : isSharedMap(m) ? m : null; }

  onPos(s, msg) {
    const p = this.presence(s), now = Date.now();
    const key = this.roomKey(s, msg.m);
    const sameRoom = !!p.room && p.room === key;
    if (sameRoom) {
      const dt = Math.max(0.05, (now - p.t) / 1000);
      if (Math.hypot(msg.x - p.x, msg.y - p.y) > ONLINE.maxSpeed * dt * 1.5 + 48) p.snap = true;
    }
    p.m = msg.m; p.x = Math.round(msg.x); p.y = Math.round(msg.y); p.d = msg.d; p.a = msg.a; p.k = Math.round((msg.k || 0) * 100) / 100; p.h = msg.h === undefined ? 1 : Math.round(msg.h * 100) / 100; p.dn = !!msg.dn;
    p.t = now;
    if (!sameRoom) {
      if (p.room) this.leave(s, 'left');
      if (key) this.join(s, key);
      return;
    }
    p.dirty = true;
  }

  onLook(s, msg) {
    const p = this.presence(s);
    p.c = msg.c; p.l = msg.l;
    if (p.room) this.send(p.room, 'pLook', { id: s.id, c: p.c, l: p.l }, s);
  }

  join(s, room) {
    const p = this.presence(s);
    let set = this.rooms.get(room);
    if (!set) this.rooms.set(room, (set = new Set()));
    if (set.size >= ONLINE.maxRoomPlayers) { s.send('error', { code: NET_ERROR.roomFull, text: 'this city is full — you are playing alone here' }); return; }
    p.room = room; p.dirty = false; p.snap = false;
    s.send('roomState', { room, map: p.m, players: [...set].map(entry) });
    this.send(room, 'pJoin', { p: entry(s) }, s);
    set.add(s);
    if (!isSharedMap(room)) {
      if (!this.hosts.has(room)) this.hosts.set(room, s.id);
      s.send('roomHost', { room, host: this.hosts.get(room) });
    }
  }

  // move a player out of their room now (left the run, instance closed): the next 'pos' puts them where they are
  kick(s) { this.leave(s, 'left'); if (s.presence) s.presence.t = 0; }

  leave(s, why) {
    const p = s.presence;
    if (!p || !p.room) return;
    const set = this.rooms.get(p.room);
    if (set) {
      set.delete(s);
      if (!set.size) { this.rooms.delete(p.room); this.hosts.delete(p.room); }
      else {
        this.send(p.room, 'pLeave', { id: s.id, why });
        if (this.hosts.get(p.room) === s.id) this.pickHost(p.room, set);
      }
    }
    p.room = null;
  }

  // the host left: the party leader if present, else whoever came first
  pickHost(room, set) {
    const ids = [...set].map((x) => x.id), lead = this.server.parties?.partyOf(ids[0])?.leader;
    const host = ids.includes(lead) ? lead : ids[0];
    this.hosts.set(room, host);
    this.send(room, 'roomHost', { room, host });
  }
  hostOf(room) { return this.hosts.get(room) || null; }

  send(room, t, fields, except) {
    const set = this.rooms.get(room);
    if (set) for (const x of set) if (x !== except) x.send(t, fields);
  }

  tick() {
    for (const set of this.rooms.values()) {
      const moved = [...set].filter((s) => s.presence.dirty);
      if (!moved.length) continue;
      const rows = moved.map((s) => { const p = s.presence, r = [s.id, p.x, p.y, p.d, p.a, p.k, p.snap ? 1 : 0, p.h, p.dn ? 1 : 0]; p.dirty = false; p.snap = false; return r; });
      for (const x of set) {
        const ps = rows.filter((r) => r[0] !== x.id);
        if (ps.length) x.send('moves', { ps });
      }
    }
  }

  close() { clearInterval(this.timer); }
}
