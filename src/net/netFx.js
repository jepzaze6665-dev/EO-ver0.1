// ONLINE — effects shown on the other clients of the room (game.online.fx). Two kinds of CHANNEL:
//   'self'      : while OUR character acts (Player.update, the skill events it runs, timers those skills schedule —
//                 Game.after keeps the channel) — friends see our skill effects
//   'b_<boss>'  : while the boss WE HOST acts (its update / hurt / death code, its timers) — the guests see every boss
//                 visual, its callouts ('OVERHEATING', 'RUNE SCRIPT' ...), screen flashes and camera shakes
// Every recorded vfx call (vfx.burst / slash / ring / sprite / beam / bolt / ghost / ...) and every projectile of our
// player is batched (NET_FX.flushEvery) and sent as 'fx' { c, s, b? }; the others REPLAY them. Presentation only:
// replayed projectiles are `visual` (hit nothing), nothing touches the simulation, a lost batch only loses some sparkle.
//   - our own screen-wide effects (flash, eclipse darkening) are never sent; a boss's flash / callout / shake is
//   - a sprite that follows our player / our boss follows that player / the puppet boss on the other screens
//   - afterimages (ghost) carry a sprite-sheet frame: sent as preset / sheet / variant / frame box and rebuilt there
//   - effects made inside another effect (burst -> particle) are recorded once; particles are capped per batch
//   - boss batches are only accepted from the room host (MobSync.hostId)
import { CLASSES, DEFAULT_CLASS } from '../skills/classes.js';
import { FX_METHODS, BOSS_FX_EXTRA } from './protocol.js';

export const NET_FX = {
  methods: FX_METHODS,
  flushEvery: 0.05,     // s between batches (only when something was recorded)
  maxCalls: 60,         // per batch
  maxParticles: 12,     // per batch and channel (step dust / aura motes are many and tiny)
  maxShots: 16,         // projectiles per batch
};

const now = () => performance.now() / 1000;
const r1 = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);

export class NetFx {
  constructor(session) {
    this.session = session;
    this.stack = [];       // channels being recorded (innermost last)
    this.depth = 0;        // > 0 inside a vfx call (nested calls are not recorded)
    this.bufs = new Map(); // channel -> { c: [], particles }
    this.shots = [];
    this.lastFlush = 0;
    this.installed = false;
    session.net.on('fx', (m) => this.replay(m));
  }
  get game() { return this.session.game; }
  channel() { return this.stack[this.stack.length - 1] || null; }

  // wrap the vfx / projectile / callout / camera systems once (they live for the whole page)
  install() {
    const g = this.game;
    if (this.installed || !g.vfx || !g.combat) return;
    this.installed = true;
    const vfx = g.vfx;
    for (const name of NET_FX.methods) {
      const orig = vfx[name].bind(vfx);
      vfx[name] = (...args) => {
        if (this.stack.length && this.depth === 0) this.record(name, args);
        this.depth++;
        try { return orig(...args); } finally { this.depth--; }
      };
      vfx[name].orig = orig;
    }
    // boss-only extras: screen flash, callout banner, camera shake
    const wrapExtra = (obj, method, name) => {
      if (!obj || !obj[method]) return;
      const orig = obj[method].bind(obj);
      obj[method] = (...args) => { const ch = this.channel(); if (ch && ch !== 'self' && this.depth === 0) this.record(name, args); return orig(...args); };
      obj[method].orig = orig;
    };
    wrapExtra(vfx, 'flash', 'flash');
    wrapExtra(g.ui, 'callout', 'callout');
    wrapExtra(g.camera, 'shake', 'shake');
    const pj = g.combat.projectiles, fire = pj.fire.bind(pj);
    pj.fire = (def) => {
      const p = fire(def);
      if (!def.visual && def.owner === g.player && this.active()) this.recordShot(p);
      return p;
    };
  }

  active() { const s = this.session; return s.online && s.remotes.room && s.remotes.list.some((r) => !r.leaving); }

  // run fn recording into a channel ('self' = our player, 'b_<id>' = the boss we host)
  run(fn, ch = 'self') {
    if (!this.active()) return fn();
    this.stack.push(ch);
    try { return fn(); } finally { this.stack.pop(); }
  }
  isRecording() { return this.stack.length > 0; }

  record(name, args) {
    const ch = this.channel();
    let b = this.bufs.get(ch);
    if (!b) this.bufs.set(ch, (b = { c: [], particles: 0 }));
    if (b.c.length >= NET_FX.maxCalls) return;
    if (name === 'particle' && ++b.particles > NET_FX.maxParticles) return;
    const out = [name];
    if (name === 'ghost') {
      const f = this.encodeFrame(args[0]);
      if (!f) return;
      out.push(f, r1(args[1]), r1(args[2]), this.opts(args[3], ch));
    } else for (const a of args) out.push(typeof a === 'object' && a !== null ? this.opts(a, ch) : typeof a === 'string' ? a.slice(0, 120) : r1(a));
    b.c.push(out);
  }

  // option objects: plain values only; `follow` = our player -> 'self', the boss -> 'boss'
  opts(o, ch) {
    if (!o || typeof o !== 'object') return o ?? null;
    const c = {};
    let n = 0;
    for (const [k, v] of Object.entries(o)) {
      if (++n > 16) break;
      if (k === 'follow') { if (v === this.game.player) c.follow = 'self'; else if (v && ch !== 'self') c.follow = 'boss'; continue; }
      if (typeof v === 'number') c[k] = r1(v);
      else if (typeof v === 'string' && v.length <= 32) c[k] = v;
      else if (typeof v === 'boolean') c[k] = v;
    }
    return c;
  }

  // a sprite-sheet frame of our player -> { s: sheet, v: variant, sx, sy, sw, sh, ax, ay, f }
  encodeFrame(fr) {
    const sp = this.game.player && this.game.player.sprites;
    if (!fr || !sp) return null;
    for (const [sheet, s] of Object.entries(sp.sheets)) {
      for (const v of ['img', 'flash', 'ghost']) if (s[v] === fr.img) return { s: sheet, v, sx: fr.sx, sy: fr.sy, sw: fr.sw, sh: fr.sh, ax: fr.ax, ay: fr.ay, f: fr.flip ? 1 : 0 };
    }
    return null;
  }

  recordShot(p) {
    if (this.shots.length >= NET_FX.maxShots) return;
    this.shots.push({ x: r1(p.x), y: r1(p.y), vx: r1(p.vx), vy: r1(p.vy), r: r1(p.r), life: r1(p.life), kind: String(p.kind).slice(0, 24), color: typeof p.color === 'string' ? p.color.slice(0, 24) : '#fff', delay: r1(p.delay || 0), wallStop: !!p.wallStop, accel: r1(p.accel || 0) });
  }

  // after the frame: send what was recorded (one message per channel)
  flush() {
    const t = now();
    if ((!this.bufs.size && !this.shots.length) || t - this.lastFlush < NET_FX.flushEvery) return;
    this.lastFlush = t;
    if (this.active()) {
      const self = this.bufs.get('self');
      if ((self && self.c.length) || this.shots.length) this.session.net.send('fx', { c: self ? self.c : [], s: this.shots });
      for (const [ch, b] of this.bufs) if (ch !== 'self' && b.c.length) this.session.net.send('fx', { c: b.c, s: [], b: ch.slice(2) });
    }
    this.bufs.clear(); this.shots = [];
  }

  // ---------------- replay (another player's / the host boss's effects)
  replay({ from, c, s, b }) {
    const g = this.game, ses = this.session, vfx = g.vfx;
    if (!g.world || !ses.remotes.here(g.world.mapId)) return;
    let who = null, boss = null;
    if (b) {
      if (from !== ses.mobs.hostId) return; // only the room host speaks for a boss
      const enc = g.bosses && g.bosses.get(b);
      boss = enc && enc.entity;
      if (!boss) return;
    } else {
      who = ses.remotes.get(from);
      if (!who || who.leaving) return;
    }
    for (const call of Array.isArray(c) ? c.slice(0, NET_FX.maxCalls) : []) {
      const [name, ...args] = call;
      try {
        if (BOSS_FX_EXTRA.includes(name)) {
          if (!boss) continue;
          if (name === 'flash') vfx.flash.orig(...args);
          else if (name === 'callout' && typeof args[0] === 'string') g.ui.callout.orig(args[0], typeof args[1] === 'string' ? args[1] : '', typeof args[2] === 'string' ? args[2] : '#ffe0a0');
          else if (name === 'shake') g.camera.shake.orig(Math.min(1.2, Number(args[0]) || 0));
          continue;
        }
        if (!NET_FX.methods.includes(name) || !vfx[name] || !vfx[name].orig) continue;
        if (name === 'ghost') {
          if (!who) continue;
          const fr = this.decodeFrame(args[0], who);
          if (fr) vfx[name].orig(fr, args[1], args[2], args[3] || {});
          continue;
        }
        const fixed = args.map((a) => (a && typeof a === 'object' && a.follow ? { ...a, follow: a.follow === 'self' ? who : a.follow === 'boss' ? boss : null } : a));
        if (name === 'text' && typeof fixed[2] !== 'string') continue;
        vfx[name].orig(...fixed);
      } catch { /* a bad call never breaks the frame */ }
    }
    for (const p of Array.isArray(s) ? s.slice(0, NET_FX.maxShots) : []) {
      g.combat.projectiles.fire({ ...p, owner: null, visual: true, power: 0, team: 1 });
    }
  }

  decodeFrame(f, who) {
    if (!f || typeof f !== 'object') return null;
    const cls = CLASSES[who.cls] || CLASSES[DEFAULT_CLASS];
    const sheet = this.game.spritesFor(cls).sheets[f.s];
    const img = sheet && sheet[f.v === 'flash' || f.v === 'ghost' ? f.v : 'img'];
    return img ? { img, sx: f.sx, sy: f.sy, sw: f.sw, sh: f.sh, ax: f.ax, ay: f.ay, flip: !!f.f } : null;
  }
}
