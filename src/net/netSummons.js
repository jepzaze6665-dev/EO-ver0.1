// ONLINE — friends' summons, clones and threads (game.online.summons). Presentation only, like net/netFx.js:
//   OWNER: 10 times a second, while someone else shares our map, our own summons (Shadow Doppel, Mirage, Rewind Mark,
//          Echo Self, Void Phantoms, ...) and our own threads (Astral / Lightning / Radiant threads) go out as 'sum'
//          { s: [[id, type, x, y, facing, t, duration, anim, animT, animDur]], th: [[id, type, ax, ay, bx, by, bEnt, t, dur]] }.
//          An empty list is sent once when the last one is gone.
//   OTHERS: draw them with the normal drawing code (Renderer.drawSummon / drawThread) — a summon wears the friend's class
//          sprites; positions are smoothed, timers keep running between snapshots. What a summon DOES (its hits) is the
//          owner's: those hits already reach the host through the normal combat path (mobHit).
import { CLASSES, DEFAULT_CLASS } from '../skills/classes.js';

const now = () => performance.now() / 1000;
const r1 = (v) => Math.round((v || 0) * 10) / 10;

export class NetSummons {
  constructor(session) {
    this.session = session;
    this.lastSend = 0; this.sentEmpty = true;
    this.byPlayer = new Map(); // remote player id -> { at, s: [summon views], th: [thread views] }
    session.net.on('sum', (m) => this.onSum(m));
  }
  get game() { return this.session.game; }

  // ---------------- owner
  update() {
    const g = this.game, s = this.session, p = g.player, t = now();
    if (!s.online || !s.sharedPlay() || !p || t - this.lastSend < 0.1) return;
    const mine = g.summons ? g.summons.list.filter((x) => x.owner === p) : [];
    const threads = g.threads ? g.threads.list.filter((x) => x.owner === p) : [];
    if (!mine.length && !threads.length) { if (!this.sentEmpty) { s.net.send('sum', { s: [], th: [] }); this.sentEmpty = true; } return; }
    this.lastSend = t; this.sentEmpty = false;
    s.net.send('sum', {
      s: mine.slice(0, 16).map((x) => [x.id, x.type, r1(x.x), r1(x.y), Math.round((x.facing || 0) * 100) / 100, r1(x.t), r1(x.duration), x.anim || null, Math.round((x.animT || 0) * 100) / 100, Math.round((x.animDur || 0) * 100) / 100]),
      th: threads.slice(0, 16).map((th) => { const [a, b] = g.threads.ends(th); return [th.id, th.type, r1(a.x), r1(a.y), r1(b.x), r1(b.y), b.entity ? 1 : 0, r1(th.t), r1(th.duration)]; }),
    });
  }

  // ---------------- others
  onSum({ from, s, th }) {
    const g = this.game;
    if (!from || !this.session.remotes.get(from)) return;
    const prev = this.byPlayer.get(from), at = now();
    const old = new Map(prev ? prev.s.map((x) => [x.id, x]) : []);
    const sums = (Array.isArray(s) ? s : []).filter((r) => Array.isArray(r) && g.summons && g.summons.defs[r[1]]).map(([id, type, x, y, f, t, dur, anim, animT, animDur]) => {
      const o = old.get(id);
      return { id, type, x: o ? o.x : x, y: o ? o.y : y, tx: x, ty: y, facing: f, t, duration: dur, anim: anim || null, animT, animDur, busy: 1, base: { t, animT }, remote: from };
    });
    const threads = (Array.isArray(th) ? th : []).filter((r) => Array.isArray(r) && g.threads && g.threads.defs[r[1]]).map(([id, type, ax, ay, bx, by, be, t, dur]) => ({ th: { id, type, t, duration: dur }, base: t, a: { x: ax, y: ay }, b: { x: bx, y: by, entity: !!be } }));
    this.byPlayer.set(from, { at, s: sums, th: threads });
  }

  // summon views to draw on our map (renderer y-sort list); each wears its owner's class sprites
  summons() {
    const g = this.game, ses = this.session, out = [], t = now();
    if (!g.world || !ses.remotes.here(g.world.mapId)) return out;
    for (const [pid, d] of this.byPlayer) {
      const r = ses.remotes.get(pid);
      if (!r || r.leaving || t - d.at > 1.5) { if (!r || r.leaving) this.byPlayer.delete(pid); continue; }
      const sprites = g.spritesFor(CLASSES[r.cls] || CLASSES[DEFAULT_CLASS]), dt = t - d.at;
      for (const x of d.s) {
        x.x += (x.tx - x.x) * 0.25; x.y += (x.ty - x.y) * 0.25; // smooth toward the latest snapshot
        x.t = x.base.t + dt; x.animT = x.base.animT + dt;
        if (x.t >= x.duration) continue;
        x.owner = { sprites, vx: 0, vy: 0 };
        out.push(x);
      }
    }
    return out;
  }

  // thread views on our map
  threads() {
    const g = this.game, ses = this.session, out = [], t = now();
    if (!g.world || !ses.remotes.here(g.world.mapId)) return out;
    for (const [pid, d] of this.byPlayer) {
      if (!ses.remotes.get(pid) || t - d.at > 1.5) continue;
      for (const x of d.th) { x.th.t = x.base + (t - d.at); if (x.th.t < x.th.duration) out.push(x); }
    }
    return out;
  }

  clear() { this.byPlayer.clear(); this.sentEmpty = true; }
}
