// ONLINE N2 — shared city rooms (rules: src/data/online.js). A player whose last 'pos' is on a shared map (Lumina,
// City 2) is in that map's room: everyone in it sees everyone else. Movement is batched per room ONLINE.serverTick times
// a second, and only for players who moved. A move faster than ONLINE.maxSpeed is passed on as a SNAP (teleport:
// waystone, map entry) instead of being refused — cities have no combat, positions there are not authoritative (N7
// adds server checks for dungeon movement). Only presence travels: name, class, level, position, facing, animation.
import { ONLINE, isSharedMap } from '../src/data/online.js';
import { NET_ERROR } from '../src/net/protocol.js';

const entry = (s) => { const p = s.presence; return [s.id, s.name, p.x, p.y, p.d, p.a, p.k, p.c, p.l]; };

export class CityRooms {
  constructor(server) {
    this.server = server;
    this.rooms = new Map();   // map id -> Set of sessions
    server.handle('pos', (s, m) => this.onPos(s, m));
    server.handle('look', (s, m) => this.onLook(s, m));
    server.handle('leave', (s) => this.leave(s, 'left'));
    server.on('sessionClosed', (s) => this.leave(s, 'offline'));
    this.timer = setInterval(() => this.tick(), 1000 / ONLINE.serverTick);
    this.timer.unref?.();
  }

  presence(s) {
    if (!s.presence) s.presence = { room: null, m: null, x: 0, y: 0, d: 0, a: 'idle', k: 0, c: null, l: 1, t: 0, dirty: false, snap: false };
    return s.presence;
  }

  onPos(s, msg) {
    const p = this.presence(s), now = Date.now();
    const sameRoom = p.room && p.room === msg.m;
    if (sameRoom) {
      const dt = Math.max(0.05, (now - p.t) / 1000);
      if (Math.hypot(msg.x - p.x, msg.y - p.y) > ONLINE.maxSpeed * dt * 1.5 + 48) p.snap = true;
    }
    p.m = msg.m; p.x = Math.round(msg.x); p.y = Math.round(msg.y); p.d = msg.d; p.a = msg.a; p.k = Math.round((msg.k || 0) * 100) / 100;
    p.t = now;
    if (!sameRoom) {
      if (p.room) this.leave(s, 'left');
      if (isSharedMap(msg.m)) this.join(s, msg.m);
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
    s.send('roomState', { room, players: [...set].map(entry) });
    this.send(room, 'pJoin', { p: entry(s) }, s);
    set.add(s);
  }

  leave(s, why) {
    const p = s.presence;
    if (!p || !p.room) return;
    const set = this.rooms.get(p.room);
    if (set) {
      set.delete(s);
      if (!set.size) this.rooms.delete(p.room);
      else this.send(p.room, 'pLeave', { id: s.id, why });
    }
    p.room = null;
  }

  send(room, t, fields, except) {
    const set = this.rooms.get(room);
    if (set) for (const x of set) if (x !== except) x.send(t, fields);
  }

  tick() {
    for (const set of this.rooms.values()) {
      const moved = [...set].filter((s) => s.presence.dirty);
      if (!moved.length) continue;
      const rows = moved.map((s) => { const p = s.presence, r = [s.id, p.x, p.y, p.d, p.a, p.k, p.snap ? 1 : 0]; p.dirty = false; p.snap = false; return r; });
      for (const x of set) {
        const ps = rows.filter((r) => r[0] !== x.id);
        if (ps.length) x.send('moves', { ps });
      }
    }
  }

  close() { clearInterval(this.timer); }
}
