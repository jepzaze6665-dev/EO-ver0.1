// ONLINE — friends' skill effects (game.online.fx). While OUR character acts (Player.update, the skill events it runs,
// and timers those skills schedule — Game.after keeps the flag), every call it makes to the visual-effects system
// (vfx.burst / slash / ring / sprite / beam / bolt / ghost / ...) and every projectile it fires is RECORDED, batched
// (NET_FX.flushEvery) and sent as 'fx'; the other clients on the same map REPLAY them. Presentation only: replayed
// projectiles are `visual` (hit nothing), nothing touches the simulation, a lost batch only loses some sparkle.
//   - screen-wide effects (flash, eclipse darkening) are never replayed: your skill must not flash my screen
//   - a sprite that follows our player follows that player's picture on the other screens
//   - afterimages (ghost) carry a sprite-sheet frame: sent as preset / sheet / variant / frame box and rebuilt there
//   - effects made inside another effect (burst -> particle) are recorded once; particles are capped per batch
import { CLASSES, DEFAULT_CLASS } from '../skills/classes.js';
import { FX_METHODS } from './protocol.js';

export const NET_FX = {
  methods: FX_METHODS,
  flushEvery: 0.05,     // s between batches (only when something was recorded)
  maxCalls: 60,         // per batch
  maxParticles: 12,     // per batch (step dust / aura motes are many and tiny)
  maxShots: 16,         // projectiles per batch
};

const now = () => performance.now() / 1000;
const r1 = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);

export class NetFx {
  constructor(session) {
    this.session = session;
    this.recording = 0;    // > 0 while our player's code runs
    this.depth = 0;        // > 0 inside a vfx call (nested calls are not recorded)
    this.buf = []; this.shots = []; this.particles = 0;
    this.lastFlush = 0;
    this.installed = false;
    session.net.on('fx', (m) => this.replay(m));
  }
  get game() { return this.session.game; }

  // wrap the vfx / projectile systems once (they live for the whole page)
  install() {
    const g = this.game;
    if (this.installed || !g.vfx || !g.combat) return;
    this.installed = true;
    const vfx = g.vfx;
    for (const name of NET_FX.methods) {
      const orig = vfx[name].bind(vfx);
      vfx[name] = (...args) => {
        if (this.recording > 0 && this.depth === 0) this.record(name, args);
        this.depth++;
        try { return orig(...args); } finally { this.depth--; }
      };
      vfx[name].orig = orig;
    }
    const pj = g.combat.projectiles, fire = pj.fire.bind(pj);
    pj.fire = (def) => {
      const p = fire(def);
      if (!def.visual && def.owner === g.player && this.active()) this.recordShot(p);
      return p;
    };
  }

  active() { const s = this.session; return s.online && s.remotes.room && s.remotes.list.some((r) => !r.leaving); }

  // run fn with recording on (Player.update / timers made while recording)
  run(fn) {
    if (!this.active()) return fn();
    this.recording++;
    try { return fn(); } finally { this.recording--; }
  }
  isRecording() { return this.recording > 0; }

  record(name, args) {
    if (this.buf.length >= NET_FX.maxCalls) return;
    if (name === 'particle' && ++this.particles > NET_FX.maxParticles) return;
    const p = this.game.player;
    const out = [name];
    if (name === 'ghost') {
      const f = this.encodeFrame(args[0]);
      if (!f) return;
      out.push(f, r1(args[1]), r1(args[2]), this.opts(args[3]));
    } else for (const a of args) out.push(typeof a === 'object' && a !== null ? this.opts(a, p) : r1(a));
    this.buf.push(out);
  }

  // option objects: plain values only; `follow: our player` -> 'self'
  opts(o, p = this.game.player) {
    if (!o || typeof o !== 'object') return o ?? null;
    const c = {};
    let n = 0;
    for (const [k, v] of Object.entries(o)) {
      if (++n > 16) break;
      if (k === 'follow') { if (v === p) c.follow = 'self'; continue; }
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

  // after the frame: send what was recorded
  flush() {
    const t = now();
    if ((!this.buf.length && !this.shots.length) || t - this.lastFlush < NET_FX.flushEvery) return;
    this.lastFlush = t;
    if (this.active()) this.session.net.send('fx', { c: this.buf, s: this.shots });
    this.buf = []; this.shots = []; this.particles = 0;
  }

  // ---------------- replay (another player's effects)
  replay({ from, c, s }) {
    const g = this.game, ses = this.session;
    if (!g.world || !ses.remotes.here(g.world.mapId)) return;
    const who = ses.remotes.get(from);
    if (!who || who.leaving) return;
    const vfx = g.vfx;
    for (const call of Array.isArray(c) ? c.slice(0, NET_FX.maxCalls) : []) {
      const [name, ...args] = call;
      if (!NET_FX.methods.includes(name) || !vfx[name] || !vfx[name].orig) continue;
      try {
        if (name === 'ghost') {
          const fr = this.decodeFrame(args[0], who);
          if (fr) vfx[name].orig(fr, args[1], args[2], args[3] || {});
          continue;
        }
        const fixed = args.map((a) => (a && typeof a === 'object' && a.follow === 'self' ? { ...a, follow: who } : a));
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
