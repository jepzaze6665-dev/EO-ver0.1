// ONLINE N2 — other players seen in a shared city. Presentation only: they are not Player objects, have no
// combat, no collision and never touch the local simulation. Each keeps a short buffer of server snapshots and is drawn
// ONLINE.interpDelay seconds in the past, interpolated between the two snapshots around that moment (smooth at 10 Hz);
// a 'snap' snapshot (teleport) is never interpolated across. Entry rows come from server/cityRooms.js.
import { ONLINE } from '../data/online.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class RemotePlayer {
  constructor(row, now) {
    const [id, name, x, y, d, a, k, c, l, h] = row;
    this.id = id; this.name = name;
    this.h = h ?? 1;            // HP share (0 = down / dead)
    this.cls = c || null; this.level = l || 1;
    this.snaps = [{ t: now, x, y, d, a, k: k || 0, snap: true }];
    this.leaving = null;      // { at, why } while fading out
    this.animSince = now; this.lastAnim = a;
    this.x = x; this.y = y; this.d = d; this.a = a; this.k = k || 0;
  }

  push(snap) {
    const s = this.snaps;
    s.push(snap);
    if (s.length > 20) s.splice(0, s.length - 20);
  }

  // position / animation at render time `now` (seconds)
  sample(now) {
    const t = now - ONLINE.interpDelay, s = this.snaps;
    let cur = s[0];
    if (t >= s[s.length - 1].t) cur = s[s.length - 1];
    else {
      for (let i = s.length - 1; i > 0; i--) {
        const a = s[i - 1], b = s[i];
        if (t >= a.t) {
          const f = b.snap ? 0 : Math.min(1, (t - a.t) / Math.max(1e-3, b.t - a.t));
          cur = { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), d: f < 0.5 ? a.d : b.d, a: f < 0.5 ? a.a : b.a, k: f < 0.5 ? a.k : b.k };
          break;
        }
      }
    }
    this.x = cur.x; this.y = cur.y; this.d = cur.d; this.k = cur.k;
    if (cur.a !== this.lastAnim) { this.lastAnim = cur.a; this.animSince = now; }
    this.a = cur.a;
    return this;
  }

  alpha(now) { return this.leaving ? Math.max(0, 1 - (now - this.leaving.at) / ONLINE.leaveFade) : 1; }
}

export class RemotePlayers {
  // room = the server's room key (a city map id, or '<instance>:<map>' in a run); mapId = the map that room is on
  constructor() { this.room = null; this.mapId = null; this.map = new Map(); }

  clear() { this.room = null; this.mapId = null; this.map.clear(); }
  here(mapId) { return !!this.room && this.mapId === mapId; }
  get list() { return [...this.map.values()]; }
  get(id) { return this.map.get(id); }

  setRoom(room, rows, now, mapId = room) {
    this.clear();
    this.room = room; this.mapId = mapId;
    for (const r of rows) this.map.set(r[0], new RemotePlayer(r, now));
  }
  join(row, now) { this.map.set(row[0], new RemotePlayer(row, now)); }
  leave(id, why, now) { const r = this.map.get(id); if (r && !r.leaving) r.leaving = { at: now, why }; }
  look(id, c, l) { const r = this.map.get(id); if (r) { r.cls = c; r.level = l; } }
  moves(rows, now) {
    for (const [id, x, y, d, a, k, snap, h] of rows) {
      const r = this.map.get(id);
      if (r && h !== undefined) r.h = h;
      if (r && !r.leaving) r.push({ t: now, x, y, d, a, k: k || 0, snap: !!snap });
    }
  }

  // drop players whose fade-out finished; returns the ones to draw (sampled at `now`)
  visible(now) {
    const out = [];
    for (const r of this.map.values()) {
      if (r.leaving && r.alpha(now) <= 0) { this.map.delete(r.id); continue; }
      out.push(r.sample(now));
    }
    return out;
  }
}
