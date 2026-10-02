import { dist, TAU, angleTo, wrapAngle } from '../core/math.js';
import { TILE as TILE_PX } from '../core/constants.js';
import { Breakable } from '../exploration/breakable.js';

// ONLINE (party runs): the players a mechanic acts on = this client's players + (host of a run map) the guests as ally
// proxies (game.combatants()); damage / statuses on a proxy are forwarded to that player's client (net/bossSync.js).
const PLAYERS = (g) => (g.combatants ? g.combatants() : PLAYERS(g));
// per-player values in net states are keyed by player id (our player = the session's id, a proxy = its netPlayer)
const pid = (g, p) => (p && p.isAlly ? p.netPlayer : (g.online && g.online.playerId) || 'me');
let NET_ID = 0; // ids of mechanic world objects (crystal clusters, pylons) so a guest's hit finds the right one

// BOSS MECHANICS — the signature rule that makes one boss fight different from another (data: data/bosses.js
// `mechanics: [{ type, ... }]`). An AreaBoss owns a list of these and calls their hooks; no boss is named here.
//   hooks (all optional): reset() · update(dt) · onMoveDone(id, move) · onImpact({ x, y, r, move })
//                         wantsTurn() -> generator | null (take over the boss's next action) · tags() -> HUD tags
//   A new mechanic = one class + one line in MECHANICS.
//
// overheat   : every fire move heats the boss (gain: { moveId: heat }). At `max` it OVERHEATS: a big telegraphed
//              blast around it (survive it: dodge out or through), then it collapses — a long weak window
//              (`weak` s) where it takes the burst. Heat resets. Tags: HEAT n% / OVERHEATING.
// lava_pools : impacts of the named moves leave burning pools on the ground for `life` s (phase 2: `life2`);
//              standing in one burns. The arena shrinks while they last — keep moving.
class Overheat {
  constructor(boss, d) { this.b = boss; this.d = { max: 100, weak: 5, blast: { r: 170, power: 44, windup: 1.6 }, ...d }; this.reset(); }
  reset() { this.heat = 0; this.pending = false; }
  onMoveDone(id) {
    const add = (this.d.gain || {})[id] || 0;
    if (!add || this.b.state !== 'fight') return;
    this.heat = Math.min(this.d.max, this.heat + add * (this.b.phase > 1 ? this.d.phase2Mult || 1.25 : 1));
    if (this.heat >= this.d.max) this.pending = true;
  }
  wantsTurn() { return this.pending ? this.overheat() : null; }
  *overheat() {
    const b = this.b, g = b.game, fx = b.look.vfx || {}, bl = this.d.blast;
    this.pending = false;
    b.pose = 'roar';
    g.ui.callout('OVERHEATING', 'Get clear of the blast — then strike its exposed core!', '#ff9a50');
    g.audio.sfx('roar');
    if (fx.charge) g.vfx.sprite(fx.charge, b.x, b.y - b.height * 0.5, 0, { scale: 2.2, life: b.wind(bl.windup), follow: b });
    const tel = b.tele({ shape: 'circle', x: b.x, y: b.y, r: bl.r, total: b.wind(bl.windup), color: '255,110,30' }, { dmg: 'magic' });
    yield tel.total;
    b.hit(tel, { power: bl.power, knock: 320, dmg: 'magic', status: [{ id: 'burn', dur: 3 }] });
    g.camera.shake(0.9);
    g.vfx.flash('255,140,60', 0.45, 2);
    g.vfx.ring(b.x, b.y, 20, bl.r, { color: '255,120,40', life: 0.5, width: 10, fill: true });
    if (fx.nova) g.vfx.sprite(fx.nova, b.x, b.y, 0, { scale: bl.r / 45, life: 0.6, ground: true, squash: 0.6 });
    g.audio.sfx('slam_big');
    this.heat = 0;
    yield 0.3;
    b.enterWeak(this.d.weak, 'OVERHEATED');
    g.events.emit('bossOverheated', { bossId: b.bossId });
  }
  tags() {
    const p = Math.round((this.heat / this.d.max) * 100);
    return [{ label: p >= 80 ? `OVERHEATING ${p}%` : `HEAT ${p}%`, color: p >= 80 ? '#ff6a30' : '#ffb070' }];
  }
}

class LavaPools {
  constructor(boss, d) { this.b = boss; this.d = { life: 7, life2: 9, max: 14, scale: 0.8, tick: 0.5, burn: 2, from: [], ...d }; this.pools = []; }
  reset() { this.pools = []; }
  onImpact({ x, y, r, move }) {
    if (!this.d.from.includes(move.id)) return;
    const b = this.b, g = b.game, life = b.phase > 1 ? this.d.life2 : this.d.life;
    if (this.pools.length >= this.d.max) this.pools.shift();
    this.pools.push({ x, y, r: r * this.d.scale, t: life, tick: 0 });
    const fx = b.look.vfx || {};
    if (fx.pool) g.vfx.sprite(fx.pool, x, y, 0, { scale: (r * this.d.scale) / 40, life, ground: true, squash: 0.7, frame: 4, alpha: 0.85, glow: 0.2 });
  }
  update(dt) {
    const g = this.b.game;
    for (const p of this.pools) {
      p.t -= dt; p.tick -= dt;
      if (p.tick > 0) continue;
      for (const pl of PLAYERS(g)) {
        if (pl.dead || pl.invulnerable() || dist(pl.x, pl.y, p.x, p.y) > p.r) continue;
        pl.status.add('burn', this.d.burn, { source: this.b });
        p.tick = this.d.tick;
      }
      if (Math.random() < 0.3) g.vfx.particle(p.x + (Math.random() - 0.5) * p.r, p.y + (Math.random() - 0.5) * p.r * 0.6, { color: '#ff8a30', vy: -30, life: 0.6, size: 2, add: true });
    }
    this.pools = this.pools.filter((p) => p.t > 0);
  }
  // pools stay on the ground drawn by their VFX sprite; without one, a glowing ellipse
  draw(ctx) {
    if ((this.b.look.vfx || {}).pool) return;
    for (const p of this.pools) {
      ctx.fillStyle = `rgba(255,110,30,${0.25 + 0.1 * Math.sin(p.t * 5)})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.6, 0, 0, TAU); ctx.fill();
    }
  }
}

// stance     : SWORD / SHIELD. Each stance allows its own moves (filterMoves); after `switchEvery[stance]` moves it
//              changes stance. In SHIELD stance hits from the front are mostly blocked (tryBlock) and wear a guard
//              down (heavy hits twice as fast); a broken guard = a weak window. Strike its back, or break the guard.
class Stance {
  constructor(boss, d) { this.b = boss; this.d = d; this.order = Object.keys(d.stances); this.reset(); }
  reset() { this.cur = this.order[0]; this.count = 0; this.pending = false; this.switching = false; this.guard = this.d.stances.shield ? this.d.stances.shield.guardHp : 0; this.blockT = 0; }
  get def() { return this.d.stances[this.cur]; }
  filterMoves(ids) { const ok = ids.filter((id) => this.def.moves.includes(id)); return ok.length ? ok : ids; }
  onMoveDone() { if (++this.count >= (this.d.switchEvery[this.cur] || 3)) this.pending = true; }
  wantsTurn() { return this.pending ? this.change() : null; }
  *change() {
    const b = this.b, g = b.game;
    this.pending = false; this.count = 0; this.switching = true;
    this.cur = this.order[(this.order.indexOf(this.cur) + 1) % this.order.length];
    if (this.def.guardHp) this.guard = this.def.guardHp;
    b.pose = 'roar';
    b.fx('spark', b.x, b.y - b.height * 0.5, 0, { scale: 1.6, life: 0.6 });
    g.ui.callout(this.def.label || this.cur.toUpperCase(), this.def.hint || '', '#9ad8ff');
    g.audio.sfx('cast');
    yield 0.8;
    this.switching = false;
    b.pose = 'idle';
  }
  tryBlock(src) {
    const s = this.def.block, b = this.b;
    if (!s || !src || b.state !== 'fight' || b.status.has('vulnerable')) return null;
    return Math.abs(wrapAngle(angleTo(b.x, b.y, src.x, src.y) - b.facing)) <= s.arc ? { mult: s.mult, perfect: false } : null;
  }
  onBlock(block, src, opts, ang, raw) {
    const b = this.b, g = b.game;
    this.guard -= raw * (opts.big || (opts.stagger || 0) >= 20 ? 2 : 1);
    g.vfx.spark(b.x, b.y - b.height * 0.5, ang + Math.PI, '#9ad8ff', 8);
    if (g.time > this.blockT) { this.blockT = g.time + 1.3; g.vfx.text(b.x, b.y - b.height - 20, 'SHIELD — strike its back', { color: '#9ad8ff', size: 10 }); }
    g.audio.sfx('block');
    if (this.guard > 0) return;
    // guard broken: back to the sword, and a long opening
    this.cur = this.order[0]; this.count = 0;
    b.fx('shatter', b.x, b.y - b.height * 0.5, 0, { scale: 1.8, life: 0.6 });
    g.events.emit('bossGuardBroken', { bossId: b.bossId });
    b.enterWeak(this.d.breakWeak || 4, 'GUARD BROKEN');
  }
  poseAnim(pose) { return this.def.anims ? this.def.anims[pose] : null; }
  tags() {
    if (!this.def.block) return [{ label: this.def.label || this.cur.toUpperCase(), color: '#ffe0a0' }];
    const p = Math.max(0, Math.round((this.guard / this.def.guardHp) * 100));
    return [{ label: `${this.def.label} · GUARD ${p}%`, color: '#9ad8ff' }];
  }
}

// rune_sequence (from phase d.phase): runes are drawn on the floor one by one, numbered — then they detonate in the
// SAME order. Remember the order; stand where the next one has already gone off.
class RuneSequence {
  constructor(boss, d) { this.b = boss; this.d = { phase: 2, every: 11, count: 4, r: 56, power: 36, gap: 0.55, delay: 1.1, ...d }; this.reset(); }
  // the runes belong to this mechanic, not to the boss: staggering the knight mid-cast does not erase them
  reset() { this.t = 5; this.casts = 0; if (this.b.game) this.b.game.combat.telegraphs.cancelOwner(this); }
  update(dt) {
    if (this.b.dead) { this.b.game.combat.telegraphs.cancelOwner(this); return; }
    if (this.b.phase >= this.d.phase && this.b.state === 'fight') this.t -= dt;
  }
  wantsTurn() { return this.b.phase >= this.d.phase && this.t <= 0 ? this.cast() : null; }
  *cast() {
    const b = this.b, g = b.game, p = b.foe, d = this.d, NUM = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    this.t = d.every; this.casts++;
    b.facePlayer();
    b.curMove = { anim: { roar: d.anim || 'roar' } };
    b.pose = 'roar';
    g.ui.callout('RUNE SCRIPT', 'Remember the order — they burst the same way', '#9ad8ff');
    const burstAt = d.count * 0.35 + d.delay; // each rune's own timer, set the moment it is written
    for (let i = 0; i < d.count; i++) {
      const a = Math.random() * TAU, r = i === 0 ? 0 : 90 + Math.random() * 90;
      const c = b.clampToArena(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 30);
      b.fx('sigil', c.x, c.y, 0, { ground: true, squash: 0.6, scale: d.r / 40, life: d.delay + d.count * 0.35 + d.gap * d.count + 0.4, frame: 3 });
      g.vfx.text(c.x, c.y - 10, NUM[i], { color: '#dff0ff', size: 16, life: 1.4, vy: 0 });
      const tel = b.tele({ shape: 'circle', x: c.x, y: c.y, r: d.r, total: burstAt - i * 0.35 + i * d.gap + 0.45, color: '140,190,255', owner: this }, { dmg: 'magic' });
      tel.onResolve = () => { if (b.dead) return; b.hit(tel, { power: d.power, dmg: 'magic', knock: 200 }); b.fx('eruption', c.x, c.y, 0, { scale: d.r / 36, life: 0.5 }); g.events.emit('runeBurst', { bossId: b.bossId }); };
      g.audio.sfx('cast');
      yield 0.35;
    }
    yield d.delay + d.gap * d.count + 0.6;
    b.curMove = null;
  }
}

// echoes (from phase d.phase): two ghostly soldiers of Asteria rise beside the boss and COPY its next attacks from
// where they stand (aimed at the player, a beat later). They fade after `life` s.
class Echoes {
  constructor(boss, d) { this.b = boss; this.d = { phase: 3, count: 2, life: 14, every: 22, delay: 0.3, sprite: null, ...d }; this.reset(); }
  reset() { this.list = []; this.t = 0; this.copies = 0; }
  update(dt) {
    for (const e of this.list) e.life -= dt;
    this.list = this.list.filter((e) => e.life > 0);
    if (this.b.phase >= this.d.phase && this.b.state === 'fight') this.t -= dt;
  }
  wantsTurn() { return this.b.phase >= this.d.phase && this.t <= 0 ? this.summon() : null; }
  *summon() {
    const b = this.b, g = b.game;
    this.t = this.d.every;
    b.pose = 'roar';
    g.ui.callout('ECHOES OF ASTERIA', 'Its soldiers copy its next strikes', '#9ad8ff');
    for (let i = 0; i < this.d.count; i++) {
      const a = b.facing + (i % 2 ? 1 : -1) * 1.6, c = b.clampToArena(b.x + Math.cos(a) * 150, b.y + Math.sin(a) * 150, 40);
      this.list.push({ x: c.x, y: c.y, life: this.d.life });
      b.fx('echo', c.x, c.y - 20, 0, { scale: 1.4, life: 0.7 });
    }
    g.audio.sfx('roar_small');
    yield 1.0;
  }
  onTelegraph(tel, m) {
    if (tel.fromEcho || !this.list.length) return;
    const b = this.b, g = b.game, p = b.foe;
    for (const e of this.list) {
      const ang = angleTo(e.x, e.y, p.x, p.y), total = tel.total + this.d.delay;
      let c;
      if (tel.shape === 'cone') c = { shape: 'cone', x: e.x, y: e.y, r: tel.r, half: tel.half, ang, total };
      else if (tel.shape === 'line') c = { shape: 'line', x: e.x, y: e.y, ang, len: Math.min(tel.len, 220), width: tel.width, total };
      else if (tel.shape === 'ring') c = { shape: 'ring', x: e.x, y: e.y, r0: tel.r0, r: tel.r, total };
      else c = { shape: 'circle', x: e.x + Math.cos(ang) * 40, y: e.y + Math.sin(ang) * 40, r: tel.r, total };
      const ec = b.tele({ ...c, color: '140,190,255' }, m);
      ec.fromEcho = true;
      ec.onResolve = () => { b.hit(ec, m); b.fx(ec.shape === 'cone' ? 'slash' : 'impact', e.x + Math.cos(ang) * 40, e.y - 16 + Math.sin(ang) * 20, ang, { scale: 1, life: 0.3 }); };
      this.copies++;
    }
  }
  // the echoes: the named monster's idle sprite, pale blue and see-through
  draw(ctx) {
    const set = this.d.sprite && this.b.game.monsterSprites[this.d.sprite];
    for (const e of this.list) {
      const a = Math.min(1, e.life) * (0.45 + 0.1 * Math.sin(this.b.animT * 4));
      ctx.save(); ctx.globalAlpha = a; ctx.translate(e.x, e.y);
      if (Math.cos(angleTo(e.x, e.y, this.b.game.player.x, this.b.game.player.y)) < 0) ctx.scale(-1, 1);
      if (set) { const fr = set.idle[0], s = this.d.scale || 1.1; ctx.filter = this.d.filter || 'hue-rotate(160deg) brightness(1.4)'; ctx.drawImage(fr, -set.ax * s, -set.ay * s, set.w * s, set.h * s); ctx.filter = 'none'; }
      else { ctx.fillStyle = 'rgba(140,190,255,0.6)'; ctx.beginPath(); ctx.ellipse(0, -20, 12, 20, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
}

// judgement (final attack, once): at `at` of its HP the boss cannot drop lower until it has used this. It returns to
// the centre and brands the whole arena; only the `domes` (blue light) are safe. Then it kneels, exhausted.
class Judgement {
  constructor(boss, d) { this.b = boss; this.d = { at: 0.15, domes: 3, domeR: 46, windup: 3.2, power: 80, weak: 6, name: 'FINAL JUDGEMENT', ...d }; this.reset(); }
  reset() { this.done = false; this.resolved = false; this.pending = false; this.safe = 0; this.hurt = 0; }
  update() {
    const b = this.b;
    if (b.dead || this.resolved) return;
    // interrupted before the blast (stagger / guard break): it will be cast again
    if (this.done && b.co !== this.gen) { this.done = false; b.game.combat.telegraphs.cancelOwner(this); }
    if (!this.done && b.hp <= Math.ceil(b.maxHp * this.d.at) && b.state === 'fight') this.pending = true;
  }
  // the boss's damage floor (areaBoss.applyFloor): HP stays at `at` until the judgement has been cast
  hpFloor() { return this.resolved ? 0 : this.d.at; } // held through the wind-up: the blast always lands
  wantsTurn() { return this.pending && !this.done ? (this.gen = this.cast()) : null; }
  *cast() {
    const b = this.b, g = b.game, d = this.d;
    this.pending = false; this.done = true;
    let t = 0;
    yield (dt) => { t += dt; b.pose = 'walk'; return b.stepToward(b.center.x, b.center.y, 260, dt) < 14 || t > 1.4; };
    b.curMove = { anim: { roar: d.anim || 'roar' } };
    b.pose = 'roar';
    g.ui.callout(d.name, 'Only the blue domes are safe', '#9ad8ff');
    g.audio.sfx('roar');
    const domes = [];
    for (let k = 0; k < 40 && domes.length < d.domes; k++) {
      const a = Math.random() * TAU, r = b.arenaR * (0.35 + Math.random() * 0.4), c = { x: b.center.x + Math.cos(a) * r, y: b.center.y + Math.sin(a) * r };
      if (domes.every((o) => Math.hypot(o.x - c.x, o.y - c.y) > d.domeR * 3)) domes.push(c);
    }
    this.domes = domes;
    for (const c of domes) {
      b.fx('dome', c.x, c.y + 6, 0, { scale: d.domeR / 30, life: d.windup + 0.4 });
      g.vfx.ring(c.x, c.y, 4, d.domeR, { color: '150,210,255', life: d.windup, width: 3 });
    }
    b.tele({ shape: 'circle', x: b.center.x, y: b.center.y, r: b.arenaR - 6, total: d.windup, color: '120,170,255' }, { dmg: 'magic' });
    yield d.windup;
    for (const p of PLAYERS(g)) {
      if (p.dead) continue;
      if (domes.some((c) => Math.hypot(p.x - c.x, p.y - c.y) <= d.domeR) || p.invulnerable()) { this.safe++; continue; }
      g.combat.dealDamage(b, p, { power: d.power, type: 'magic', unblockable: true, knock: 260 });
      this.hurt++;
    }
    g.vfx.flash('170,210,255', 0.55, 1.8);
    g.camera.shake(1);
    b.fx('nova', b.center.x, b.center.y, 0, { scale: b.arenaR / 40, life: 0.7, ground: true, squash: 0.6 });
    g.audio.sfx('slam_big');
    this.resolved = true;
    g.events.emit('bossJudgement', { bossId: b.bossId, safe: this.safe, hurt: this.hurt });
    yield 0.4;
    b.curMove = null;
    b.enterWeak(d.weak, 'EXHAUSTED');
  }
}

// frostbite (from phase d.phase): a player who stands still gathers FROSTBITE; at `max` stacks they FREEZE (stun +
// a shatter hit). Moving / dodging melts it. Stops a player from camping one spot against a fast hunter.
class Frostbite {
  constructor(boss, d) { this.b = boss; this.d = { phase: 2, max: 5, rate: 1.1, melt: 2.2, freeze: 1.1, power: 30, ...d }; this.reset(); }
  reset() { this.stacks = new Map(); this.last = new Map(); this.freezes = 0; }
  get(p) { return this.stacks.get(p) || 0; }
  // every player of the run gathers its own stacks (a guest's freeze = a forwarded stun + hit, net/bossSync.js)
  update(dt) {
    const b = this.b, g = b.game, d = this.d, active = !(b.dead || b.phase < d.phase || (b.state !== 'fight' && b.state !== 'weak'));
    for (const p of PLAYERS(g)) {
      let st = this.get(p);
      if (!active || p.dead) { this.stacks.set(p, Math.max(0, st - dt * d.melt)); continue; }
      const l = this.last.get(p), moved = l ? Math.hypot(p.x - l.x, p.y - l.y) / Math.max(dt, 1e-4) : 0;
      this.last.set(p, { x: p.x, y: p.y });
      if (moved > 30 || p.dash) st = Math.max(0, st - dt * d.melt);
      else st += dt * d.rate;
      if (st >= 1 && Math.random() < dt * 4) g.vfx.particle(p.x + (Math.random() - 0.5) * 20, p.y - 10 - Math.random() * 30, { color: '#cfe8ff', vy: -20, life: 0.6, size: 2 });
      if (st >= d.max) {
        st = 0; this.freezes++;
        p.status.add('stun', d.freeze);
        g.combat.dealDamage(b, p, { power: d.power, type: 'magic', unblockable: true, knock: 0 });
        b.fx('shatter', p.x, p.y - 20, 0, { scale: 0.8, life: 0.5 });
        g.vfx.text(p.x, p.y - 60, 'FROZEN!', { color: '#bfe6ff', size: 12 });
        g.events.emit('playerFrozen', { bossId: b.bossId, player: p });
      }
      this.stacks.set(p, st);
    }
  }
  tags() { const n = this.get(this.b.game.player); return this.b.phase >= this.d.phase && n >= 0.5 ? [{ label: `FROSTBITE ${Math.floor(n)}/${this.d.max}`, color: n >= this.d.max - 1 ? '#ff8080' : '#bfe6ff' }] : []; }
}

// glacier (from phase d.phase, every `every` s): the boss howls ICE PILLARS out of the floor (solid for `life` s), then
// breathes ABSOLUTE ZERO across the whole arena — only a player hidden behind a pillar (it blocks the line from the
// boss) is safe. Afterwards it is EXHAUSTED for `weak` s.
class Glacier {
  constructor(boss, d) { this.b = boss; this.d = { phase: 2, every: 17, count: 3, dist: 150, life: 9, windup: 3, power: 70, cover: 26, weak: 4, floor: 0.2, name: 'ABSOLUTE ZERO', ...d }; this.reset(); }
  reset() {
    this.t = this.d.first ?? 3; this.safe = 0; this.hurt = 0; this.casts = 0; this.blasts = 0; this.casting = false; // the first cast comes early: the signature is always seen
    if (this.pillars) this.clearPillars();
    this.pillars = [];
  }
  clearPillars() {
    const m = this.b.game.world.map;
    for (const pl of this.pillars) if (m.blocker[pl.i] > 0) m.blocker[pl.i]--;
    this.pillars = [];
  }
  update(dt) {
    const b = this.b;
    const m = b.game.world.map;
    this.pillars = this.pillars.filter((pl) => { pl.t -= dt; if (pl.t > 0 && !b.dead) return true; if (m.blocker[pl.i] > 0) m.blocker[pl.i]--; return false; });
    if (this.casting && b.co !== this.gen) { this.casting = false; this.t = 2; } // interrupted before the blast: again soon
    if (b.phase >= this.d.phase && b.state === 'fight') this.t -= dt;
  }
  wantsTurn() { return this.b.phase >= this.d.phase && this.t <= 0 ? (this.gen = this.cast()) : null; }
  // HP floor (areaBoss.applyFloor) until the first blast has gone off — a fast burst cannot skip the signature
  hpFloor() { return this.blasts ? 0 : this.d.floor; }
  // is the segment boss -> player blocked by a pillar?
  covered(p) {
    const b = this.b, dx = p.x - b.x, dy = p.y - b.y, L2 = dx * dx + dy * dy || 1;
    return this.pillars.some((pl) => {
      const t = Math.max(0, Math.min(1, ((pl.x - b.x) * dx + (pl.y - b.y) * dy) / L2));
      return Math.hypot(b.x + dx * t - pl.x, b.y + dy * t - pl.y) <= this.d.cover && t > 0.05 && t < 0.98;
    });
  }
  *cast() {
    const b = this.b, g = b.game, d = this.d, m = g.world.map;
    this.t = d.every; this.casts++; this.casting = true;
    let t = 0;
    yield (dt) => { t += dt; b.pose = 'walk'; return b.stepToward(b.center.x, b.center.y, 240, dt) < 16 || t > 1.4; };
    b.curMove = { anim: { roar: d.anim || 'roar' } };
    b.pose = 'roar';
    g.audio.sfx('roar');
    g.ui.callout(d.name, 'Hide behind an ice pillar!', '#bfe6ff');
    // pillars around the boss, one on the player's side so a shelter is always reachable
    const foe = b.foe, pa = Math.atan2(foe.y - b.y, foe.x - b.x);
    for (let k = 0; k < d.count; k++) {
      const a = pa + (k - (d.count - 1) / 2) * ((Math.PI * 2) / d.count);
      const c = b.clampToArena(b.x + Math.cos(a) * d.dist, b.y + Math.sin(a) * d.dist, 40);
      const tx = Math.floor(c.x / TILE_PX), ty = Math.floor(c.y / TILE_PX);
      if (!m.inBounds(tx, ty) || m.isSolid(tx, ty)) continue;
      const i = m.idx(tx, ty);
      m.blocker[i]++;
      const pl = { i, x: (tx + 0.5) * TILE_PX, y: (ty + 0.5) * TILE_PX, t: d.life };
      this.pillars.push(pl);
      b.fx('pillar', pl.x, pl.y + 10, 0, { scale: 1.2, life: d.life, frame: 12 });
      g.vfx.shards(pl.x, pl.y, '#9ad8ff', 10, 120);
    }
    b.tele({ shape: 'circle', x: b.center.x, y: b.center.y, r: b.arenaR, total: d.windup, color: '150,210,255' }, { dmg: 'magic' });
    yield d.windup;
    for (const p of PLAYERS(g)) {
      if (p.dead) continue;
      if (this.covered(p) || p.invulnerable()) { this.safe++; continue; }
      g.combat.dealDamage(b, p, { power: d.power, type: 'magic', unblockable: true, knock: 240 });
      p.status.add('slow', 2);
      this.hurt++;
    }
    g.vfx.flash('200,230,255', 0.5, 1.4);
    g.camera.shake(0.9);
    b.fx('nova', b.x, b.y, 0, { scale: b.arenaR / 45, life: 0.7, ground: true, squash: 0.6 });
    this.blasts++; this.casting = false;
    g.events.emit('bossAbsoluteZero', { bossId: b.bossId, safe: this.safe, hurt: this.hurt });
    yield 0.4;
    b.curMove = null;
    b.enterWeak(d.weak, 'EXHAUSTED');
  }
  tags() { return this.pillars.length ? [{ label: `ICE PILLARS ${this.pillars.length} — HIDE BEHIND ONE`, color: '#bfe6ff' }] : []; }
}

// crystal_armor: the boss wears crystal ARMOR (damageSystem armour: most damage absorbed while it holds). Breaking it =
// SHATTERED (a long weak window). Then it grows crystal CLUSTERS around the arena (breakable, `hp` each); after `grow` s
// every cluster still standing is ABSORBED and gives back `per` of the armour. Smash the clusters and it stays bare.
class CrystalArmor {
  constructor(boss, d) { this.b = boss; this.d = { armor: 2400, weak: 5, clusters: 3, clusters2: 4, hp: 260, grow: 8, delay: 5, dist: 150, per: 0.4, prop: 'k_crystal_twin', ...d }; this.reset(); }
  reset() {
    if (this.list) this.clear();
    this.list = []; this.t = -1; this.growT = 0; this.breaks = 0; this.absorbed = 0; this.smashed = 0;
    this.b.armor = this.b.maxArmor = Math.round(this.d.armor * ((this.b.levelScale && this.b.levelScale.hp) || 1));
  }
  clear() {
    const w = this.b.game.world;
    for (const c of this.list) { c.dead = true; if (c.prop) c.prop.visible = false; const i = w.breakables.indexOf(c); if (i >= 0) w.breakables.splice(i, 1); }
    this.list = [];
  }
  onArmorBreak() {
    const b = this.b, g = b.game;
    this.breaks++;
    g.vfx.text(b.x, b.y - b.height - 20, 'ARMOR SHATTERED!', { color: '#d8b8ff', size: 14 });
    b.fx('shatter', b.x, b.y - 30, 0, { scale: 1.3, life: 0.7 });
    g.camera.shake(0.6); g.audio.sfx('shatter');
    g.events.emit('bossArmorBroken', { bossId: b.bossId });
    b.enterWeak(this.d.weak, 'SHATTERED');
    this.t = this.d.delay; // regrowth starts after the weak window
  }
  update(dt) {
    const b = this.b, g = b.game, d = this.d;
    if (b.dead) { this.clear(); return; }
    this.list = this.list.filter((c) => { if (c.dead && !c.counted) { c.counted = true; this.smashed++; g.events.emit('bossClusterSmashed', { bossId: b.bossId }); } return !c.dead; });
    if (this.t > 0 && b.state === 'fight') { this.t -= dt; if (this.t <= 0) this.grow(); }
    if (this.growT > 0) {
      this.growT -= dt;
      for (const c of this.list) if (Math.random() < dt * 6) g.vfx.particle(c.x + (Math.random() - 0.5) * 24, c.y - 20 - Math.random() * 20, { color: '#c89aff', vy: -30, life: 0.6, size: 2, add: true });
      if (this.growT <= 0) this.absorb();
    }
  }
  grow() {
    const b = this.b, g = b.game, d = this.d, w = g.world;
    const n = b.phase >= 2 ? d.clusters2 : d.clusters, a0 = Math.random() * Math.PI * 2;
    g.ui.callout('CRYSTAL GROWTH', 'Smash the clusters before it absorbs them!', '#d8b8ff');
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * Math.PI * 2, c = b.clampToArena(b.center.x + Math.cos(a) * d.dist, b.center.y + Math.sin(a) * d.dist, 40);
      const prop = w.map.addProp({ name: d.prop, x: c.x, y: c.y + 10, scale: 0.9 });
      const br = new Breakable(g, c.x, c.y, { kind: 'crystal', hp: Math.round(d.hp * ((b.levelScale && b.levelScale.hp) || 1)), radius: 16, height: 40, prop, label: 'Crystal Cluster' });
      br.netId = ++NET_ID;
      const onDeath0 = br.onDeath.bind(br); br.onDeath = () => { onDeath0(); prop.visible = false; };
      w.breakables.push(br);
      this.list.push(br);
      b.fx('spikes', c.x, c.y + 6, 0, { scale: 0.9, life: 0.6 });
    }
    this.growT = d.grow;
  }
  absorb() {
    const b = this.b, g = b.game, d = this.d, left = this.list.length;
    for (const c of this.list) g.vfx.beam(c.x, c.y - 20, Math.atan2(b.y - 40 - (c.y - 20), b.x - c.x), Math.hypot(b.x - c.x, b.y - 40 - (c.y - 20)), 6, { color: '200,150,255', life: 0.5 });
    this.clear();
    if (!left) { g.vfx.text(b.x, b.y - b.height - 20, 'NO CRYSTALS LEFT', { color: '#9af8ff', size: 12 }); this.t = d.delay * 2.4; return; } // it tries again later
    this.absorbed += left;
    b.armor = Math.min(b.maxArmor, (b.armor || 0) + b.maxArmor * d.per * left);
    g.vfx.text(b.x, b.y - b.height - 20, `ARMOR +${Math.round(d.per * left * 100)}%`, { color: '#d8b8ff', size: 13 });
    b.fx('burst', b.x, b.y - 30, 0, { scale: 1.4, life: 0.6 });
    g.events.emit('bossArmorRestored', { bossId: b.bossId, clusters: left });
    this.t = -1; // armoured again: the next growth follows the next break
  }
  tags() {
    const b = this.b, out = [];
    if (b.armor > 0) out.push({ label: `ARMOR ${Math.ceil((b.armor / b.maxArmor) * 100)}%`, color: '#d8b8ff' });
    if (this.list.length) out.push({ label: `SMASH ${this.list.length} · ${Math.ceil(this.growT)}s`, color: '#ff9ad8' });
    return out;
  }
}

// pylons (final attack, from phase d.phase once HP reaches `at`): SHATTERED ECLIPSE. The boss rises in the arena centre,
// untouchable, and charges for `channel` s while `count` crystal PYLONS (breakables, `hp`) stand around the arena. All
// broken in time -> the charge collapses: it is EXPOSED for `weak` s. Too slow -> a nova hits everyone (`power`,
// unblockable, an invulnerable dodge still saves you) and it tries again after `retry` s. HP floor `at` until the first
// success, so a fast burst cannot skip it.
class Pylons {
  constructor(boss, d) { this.b = boss; this.d = { phase: 4, at: 0.1, count: 3, hp: 700, channel: 12, dist: 170, power: 80, weak: 7, retry: 16, prop: 'p_crystal_big', name: 'SHATTERED ECLIPSE', ...d }; this.reset(); }
  reset() {
    if (this.list) this.clear();
    this.list = []; this.pending = false; this.done = false; this.casting = false; this.success = 0; this.fails = 0; this.t = 0; this.chargeT = 0;
  }
  clear() {
    const w = this.b.game.world;
    for (const c of this.list) { c.dead = true; if (c.prop) c.prop.visible = false; const i = w.breakables.indexOf(c); if (i >= 0) w.breakables.splice(i, 1); }
    this.list = [];
  }
  hpFloor() { return this.success ? 0 : this.d.at; }
  update(dt) {
    const b = this.b;
    if (b.dead) { this.clear(); return; }
    if (this.casting && b.co !== this.gen) { this.casting = false; this.clear(); b.hurtable = true; this.t = 2; } // interrupted: again soon
    if (this.t > 0) this.t -= dt;
    if (!this.success && !this.casting && this.t <= 0 && b.phase >= this.d.phase && b.hp <= Math.ceil(b.maxHp * this.d.at) + 1 && b.state === 'fight') this.pending = true;
  }
  wantsTurn() { return this.pending && !this.casting ? (this.gen = this.cast()) : null; }
  *cast() {
    const b = this.b, g = b.game, d = this.d, w = g.world;
    this.pending = false; this.casting = true;
    let t = 0;
    yield (dt) => { t += dt; b.pose = 'walk'; return b.stepToward(b.center.x, b.center.y, 260, dt) < 14 || t > 1.4; };
    b.hurtable = false;
    b.curMove = { anim: { roar: d.anim || 'roar' } };
    b.pose = 'roar';
    g.ui.callout(d.name, 'Break the crystal pylons before the eclipse shatters!', '#d8b8ff');
    g.audio.sfx('roar');
    const a0 = Math.random() * Math.PI * 2;
    for (let k = 0; k < d.count; k++) {
      const a = a0 + (k / d.count) * Math.PI * 2, c = b.clampToArena(b.center.x + Math.cos(a) * d.dist, b.center.y + Math.sin(a) * d.dist, 40);
      const prop = w.map.addProp({ name: d.prop, x: c.x, y: c.y + 10, scale: 0.8 });
      const br = new Breakable(g, c.x, c.y, { kind: 'crystal', hp: Math.round(d.hp * ((this.b.levelScale && this.b.levelScale.hp) || 1)), radius: 18, height: 50, prop, label: 'Eclipse Pylon' });
      br.netId = ++NET_ID;
      const onDeath0 = br.onDeath.bind(br); br.onDeath = () => { onDeath0(); prop.visible = false; g.events.emit('bossPylonBroken', { bossId: b.bossId }); };
      w.breakables.push(br);
      this.list.push(br);
      b.fx('pillar', c.x, c.y + 8, 0, { scale: 1, life: 0.8 });
    }
    const tel = b.tele({ shape: 'circle', x: b.center.x, y: b.center.y, r: b.arenaR, total: d.channel, color: '200,140,255' }, { dmg: 'magic' });
    this.chargeT = d.channel;
    yield (dt) => {
      this.chargeT -= dt;
      if (Math.random() < dt * 8) b.fx('spark', b.x + (Math.random() - 0.5) * 60, b.y - 40 - Math.random() * 40, 0, { scale: 0.8, life: 0.4 });
      return this.list.every((c) => c.dead) || this.chargeT <= 0;
    };
    const won = this.list.every((c) => c.dead);
    this.clear();
    b.hurtable = true;
    this.casting = false;
    b.curMove = null;
    if (won) {
      tel.resolved = true; tel.cancelled = true;
      this.success++;
      g.vfx.text(b.x, b.y - b.height - 20, 'ECLIPSE SHATTERED!', { color: '#d8b8ff', size: 14 });
      b.fx('shatter', b.x, b.y - 30, 0, { scale: 1.4, life: 0.8 });
      g.camera.shake(0.8);
      g.events.emit('bossEclipse', { bossId: b.bossId, broken: true });
      b.enterWeak(d.weak, 'EXPOSED');
      return;
    }
    // too slow: the nova
    for (const p of PLAYERS(g)) if (!p.dead && !p.invulnerable()) g.combat.dealDamage(b, p, { power: d.power, type: 'magic', unblockable: true, knock: 260 });
    g.vfx.flash('200,150,255', 0.6, 1.4);
    g.camera.shake(1);
    b.fx('nova', b.center.x, b.center.y, 0, { scale: b.arenaR / 45, life: 0.8, ground: true, squash: 0.6 });
    this.fails++;
    g.events.emit('bossEclipse', { bossId: b.bossId, broken: false });
    this.t = d.retry;
    yield 0.6;
  }
  tags() {
    if (!this.casting) return [];
    const left = this.list.filter((c) => !c.dead).length;
    return [{ label: `PYLONS ${left} · ${Math.max(0, Math.ceil(this.chargeT))}s`, color: '#ff9ad8' }];
  }
}

// ---------------- VARKHARON, the Sealed Cinder King (A2 secret boss): three rules no other fight has
// a mechanic that listens to the event bus subscribes while it lives and unsubscribes on reset / clear
function listen(mech, name, fn) { (mech.subs = mech.subs || []).push(mech.b.game.events.on(name, fn)); }
function unlisten(mech) { for (const off of mech.subs || []) off(); mech.subs = []; }
const isPlayer = (g, e) => e && PLAYERS(g).includes(e);

// ember_debt : every fire (magic) hit from the boss leaves EMBER stacks on that player (max `max`; from phase
//              `heavyPhase` on, `gainHeavy` per hit). Stacks do nothing — until the boss roars IGNITE (every `every` s):
//              each stack explodes (`per` power each, unblockable). Burn them off before it: a PERFECT DODGE of the boss
//              (-1) or hitting it while it is weak (-1, once per `weakCd` s). Run away = keep the debt; fight well = pay it.
class EmberDebt {
  constructor(boss, d) { this.b = boss; this.d = { max: 5, gain: 1, gainHeavy: 2, heavyPhase: 3, every: 18, first: 14, windup: 1.6, per: 10, weakCd: 0.35, ...d }; this.reset(); }
  reset() { unlisten(this); this.stacks = new Map(); this.t = this.d.first; this.burnT = new Map(); this.pending = false; this.ignites = 0; this.burnedOff = 0; }
  clear() { unlisten(this); this.stacks = new Map(); }
  get(p) { return this.stacks.get(p) || 0; }
  add(p, n) {
    const g = this.b.game, before = this.get(p), v = Math.max(0, Math.min(this.d.max, before + n));
    this.stacks.set(p, v);
    if (v !== before) g.vfx.text(p.x, p.y - 46, n > 0 ? `EMBER ${v}/${this.d.max}` : `EMBER BURNED OFF · ${v}`, { color: n > 0 ? '#ff8a40' : '#ffe0a0', size: 9, life: 0.8 });
    if (n < 0 && v < before) this.burnedOff += before - v;
  }
  subscribe() {
    const b = this.b, g = b.game;
    listen(this, 'damageTaken', (e) => { if (e.source === b && isPlayer(g, e.target) && e.amount > 0 && e.type === 'magic') this.add(e.target, b.phase >= this.d.heavyPhase ? this.d.gainHeavy : this.d.gain); });
    listen(this, 'attackDodged', (e) => { if (e.attacker === b && e.perfect && e.player) this.add(e.player, -1); });
    listen(this, 'damageDealt', (e) => {
      if (e.target !== b || b.state !== 'weak' || !isPlayer(g, e.source)) return;
      if ((this.burnT.get(e.source) || 0) > g.time) return;
      this.burnT.set(e.source, g.time + this.d.weakCd);
      this.add(e.source, -1);
    });
  }
  update(dt) {
    const b = this.b;
    if (b.dead) { this.clear(); return; }
    if (!this.subs || !this.subs.length) this.subscribe();
    if (b.state !== 'fight') return;
    this.t -= dt;
    if (this.t <= 0 && !this.pending) {
      if (PLAYERS(b.game).some((p) => this.get(p) > 0)) this.pending = true;
      else this.t = 5; // nobody owes anything yet: ask again soon
    }
  }
  wantsTurn() { return this.pending ? this.ignite() : null; }
  *ignite() {
    const b = this.b, g = b.game, d = this.d;
    this.pending = false; this.t = d.every; this.ignites++;
    b.curMove = { anim: { roar: 'roar' } };
    b.pose = 'roar';
    g.ui.callout('IGNITE', 'Every ember you carry is about to explode — burn them off: perfect dodges, strike it while weak', '#ff7a30');
    g.audio.sfx('roar');
    const owe = PLAYERS(g).filter((p) => !p.dead && this.get(p) > 0);
    for (const p of owe) g.vfx.ring(p.x, p.y, 10, 40 + this.get(p) * 8, { color: '255,120,40', life: b.wind(d.windup), width: 3 });
    yield b.wind(d.windup);
    for (const p of PLAYERS(g)) {
      const n = this.get(p);
      if (!n || p.dead) continue;
      g.combat.dealDamage(b, p, { power: d.per * n, type: 'magic', unblockable: true, knock: 120 });
      b.fx('eruption', p.x, p.y + 4, 0, { scale: 0.5 + n * 0.12, life: 0.6, ground: true, squash: 0.7 });
      this.stacks.set(p, 0);
    }
    g.camera.shake(0.5);
    b.curMove = null;
    g.events.emit('bossIgnite', { bossId: b.bossId });
    yield 0.4;
  }
  draw(ctx) {
    const g = this.b.game;
    for (const p of PLAYERS(g)) {
      const n = this.get(p);
      if (!n || p.dead) continue;
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < n; k++) {
        const a = g.time * 3 + (k / n) * TAU, x = p.x + Math.cos(a) * 16, y = p.y - 30 + Math.sin(a) * 6;
        ctx.fillStyle = `rgba(255,${120 + k * 20},40,${0.65 + 0.3 * Math.sin(g.time * 10 + k)})`;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  tags() { const n = this.get(this.b.game.player); return [{ label: `EMBER ${n}/${this.d.max}${this.t < 4 && n ? ' · IGNITE SOON' : ''}`, color: n >= 3 ? '#ff6a30' : '#ffb070' }]; }
}

// rising_lava : on every phase change (rings: { phase: floor radius in tiles }) the lava moat rises — after a telegraph
//               the outer ring of the floor (tiles in `floor`) really turns into LAVA (solid, glowing) and the boss's
//               arena shrinks with it; anyone still standing there is burned and thrown inward. The original tiles come
//               back when the fight resets or ends.
class RisingLava {
  constructor(boss, d) { this.b = boss; this.d = { rings: {}, warn: 2.2, power: 30, floorTiles: [], lavaTile: 0, ...d }; this.saved = []; this.reset(); }
  reset() { this.restore(); this.ph = 1; this.pending = null; this.rising = null; this.r = this.b.def.arena.radius + 0.5; this.rises = 0; }
  clear() { this.restore(); }
  restore() {
    if (this.saved.length) {
      const m = this.map;
      for (const [i, t] of this.saved) m.tiles[i] = t;
      if (m.chunkCache) m.chunkCache.clear();
    }
    this.saved = [];
    if (this.b.def) this.b.arenaR = this.b.def.arena.radius * TILE_PX;
  }
  update() {
    const b = this.b;
    if (b.dead) return;
    if (b.phase > this.ph) { this.ph = b.phase; if (this.d.rings[b.phase]) this.pending = Math.min(this.pending || 99, this.d.rings[b.phase]); }
    // a stagger / phase change cut the warning short: the lava still rises (to the newest ring if phases went by)
    if (this.rising && b.co !== this.gen) { this.pending = Math.min(this.pending || 99, this.rising); this.rising = null; }
  }
  wantsTurn() { return this.pending && this.b.state === 'fight' ? (this.gen = this.rise()) : null; }
  *rise() {
    const b = this.b, g = b.game, d = this.d, r = this.pending, m = g.world.map, cx = b.center.x, cy = b.center.y;
    this.pending = null; this.rising = r;
    g.ui.callout('THE LAVA RISES', 'The edge of the throne is melting — get to the centre!', '#ff7a30');
    g.audio.sfx('quake');
    const tel = b.tele({ shape: 'ring', x: cx, y: cy, r0: r * TILE_PX, r: this.r * TILE_PX, total: d.warn, color: '255,90,20' }, { dmg: 'magic' });
    yield tel.total;
    this.map = m;
    const ctx = Math.floor(cx / TILE_PX), cty = Math.floor(cy / TILE_PX), R = Math.ceil(this.r) + 1;
    for (let ty = cty - R; ty <= cty + R; ty++) for (let tx = ctx - R; tx <= ctx + R; tx++) {
      if (!m.inBounds(tx, ty)) continue;
      const dd = Math.hypot((tx + 0.5) * TILE_PX - cx, (ty + 0.5) * TILE_PX - cy) / TILE_PX, i = m.idx(tx, ty);
      if (dd <= r || dd > this.r + 0.6 || !d.floorTiles.includes(m.tiles[i])) continue;
      this.saved.push([i, m.tiles[i]]);
      m.tiles[i] = d.lavaTile;
      if (Math.random() < 0.35) g.vfx.particle((tx + 0.5) * TILE_PX, (ty + 0.5) * TILE_PX, { color: '#ff8a30', vy: -40, life: 0.8, size: 3, add: true });
    }
    if (m.chunkCache) m.chunkCache.clear();
    for (const p of PLAYERS(g)) {
      if (p.dead || Math.hypot(p.x - cx, p.y - cy) < (r - 0.6) * TILE_PX) continue;
      const a = angleTo(cx, cy, p.x, p.y);
      p.x = cx + Math.cos(a) * (r - 1.4) * TILE_PX; p.y = cy + Math.sin(a) * (r - 1.4) * TILE_PX; p.kx = p.ky = 0;
      if (!p.invulnerable()) { g.combat.dealDamage(b, p, { power: d.power, type: 'magic', unblockable: true, knock: 0 }); p.status.add('burn', 2, { source: b }); }
    }
    this.r = r; this.rises++; this.rising = null;
    b.arenaR = (r - 0.5) * TILE_PX;
    g.camera.shake(0.7);
    b.fx('eruption', cx, cy + r * TILE_PX * 0.6, 0, { scale: 1.4, life: 0.8, ground: true });
    g.events.emit('bossLavaRose', { bossId: b.bossId, r });
    yield 0.4;
  }
  tags() { return this.rises ? [{ label: `THRONE ${Math.round(this.r * 2)} TILES WIDE`, color: '#ff9a50' }] : []; }
}

// sky_chains : in its flight phases the boss TAKES WING (cannot be hurt, high above the floor): it dives at players and
//              sweeps fire across the arena. Two of the chain posts round the rim light up — a player HOLDS [E] beside a
//              lit post for `hold` s (a hit breaks the hold) to throw its chain; `need` chains = it CRASHES down (damage
//              around it) and lies chained: a long weak window. Too slow (`fly` s) = INFERNO, it lands unhurt. The posts
//              of the last flight stay dark next time (move!). Final (phase `final.phase`, HP floor `final.at`): LAST
//              BREATH — it rises one last time, all posts light, chain it in time or the whole throne burns.
class SkyChains {
  constructor(boss, d) {
    this.b = boss;
    this.d = { phases: [2, 3], every: 24, first: 5, fly: 13, hold: 1.2, need: 2, reach: 46, weak: 7, air: 150, posts: [],
      dive: { r: 74, windup: 1.1, power: 44 }, strafe: { width: 60, windup: 1.2, power: 36 }, gap: 2.4, inferno: { count: 14, r: 40, power: 34 },
      crash: { r: 96, power: 36 }, final: { phase: 4, at: 0.1, fly: 10, power: 80, retry: 12 }, ...d };
    this.reset();
  }
  reset() { unlisten(this); this.t = this.d.first; this.flying = false; this.casting = false; this.lit = []; this.progress = new Map(); this.chained = []; this.last = []; this.flights = 0; this.crashes = 0; this.finalDone = false; this.finalFails = 0; this.finalT = 0; this.b.air = 0; }
  clear() { unlisten(this); this.flying = false; this.lit = []; }
  post(k) { const [tx, ty] = this.d.posts[k]; return { x: (tx + 0.5) * TILE_PX, y: (ty + 0.5) * TILE_PX }; }
  hpFloor() { return this.b.phase >= this.d.final.phase && !this.finalDone ? this.d.final.at : 0; }
  holding(p) { const g = this.b.game; return !!p.chainHold || (p === g.player && g.input && g.input.isDown && g.input.isDown('KeyE')); }
  update(dt) {
    const b = this.b, g = b.game, d = this.d;
    if (b.dead) { this.clear(); b.air = 0; return; }
    if (!this.subs || !this.subs.length) listen(this, 'damageTaken', (e) => { if (this.flying && isPlayer(g, e.target) && e.amount > 0) for (const k of this.lit) if ((this.progress.get(k) || {}).p === e.target) this.progress.delete(k); });
    if (this.casting && b.co !== this.gen) { this.casting = false; this.flying = false; this.lit = []; b.air = 0; b.hurtable = true; this.t = 3; }
    if (b.state === 'fight' && !this.casting) { if (d.phases.includes(b.phase)) this.t -= dt; this.finalT -= dt; }
    if (!this.flying) return;
    // chain posts: a player holding [E] next to a lit, unchained post fills it
    for (const k of this.lit) {
      if (this.chained.includes(k)) continue;
      const s = this.post(k);
      const p = PLAYERS(g).find((pl) => !pl.dead && Math.hypot(pl.x - s.x, pl.y - s.y) <= d.reach && this.holding(pl));
      const cur = this.progress.get(k);
      if (!p) { if (cur) this.progress.delete(k); continue; }
      const v = cur && cur.p === p ? cur.v + dt : dt;
      this.progress.set(k, { p, v });
      if (v >= d.hold) {
        this.chained.push(k); this.progress.delete(k);
        g.audio.sfx('chain'); g.camera.shake(0.3);
        g.vfx.text(s.x, s.y - 50, `CHAINED ${this.chained.length}/${d.need}`, { color: '#ffd08a', size: 12 });
        g.events.emit('bossChained', { bossId: b.bossId, post: k, count: this.chained.length });
      }
    }
  }
  wantsTurn() {
    const b = this.b, d = this.d;
    if (this.casting) return null;
    if (b.phase >= d.final.phase && !this.finalDone && b.hp <= Math.ceil(b.maxHp * d.final.at) + 1 && this.finalT <= 0) return (this.gen = this.fly(true));
    if (d.phases.includes(b.phase) && this.t <= 0) return (this.gen = this.fly(false));
    return null;
  }
  *fly(final) {
    const b = this.b, g = b.game, d = this.d, F = d.final;
    this.casting = true; this.flights++;
    this.t = d.every;
    this.chained = []; this.progress = new Map();
    // posts: the final flight lights all of them; otherwise two that were not used last time
    const all = d.posts.map((_, k) => k), fresh = all.filter((k) => !this.last.includes(k));
    const pool = final ? all : (fresh.length >= d.need ? fresh : all);
    this.lit = final ? all : pool.sort(() => Math.random() - 0.5).slice(0, d.need);
    b.hurtable = false;
    b.curMove = { anim: { walk: 'move' } };
    b.pose = 'walk';
    g.ui.callout(final ? 'LAST BREATH' : 'VARKHARON TAKES WING', final ? 'It will burn the whole throne — chain it down NOW!' : 'Hold [E] at the glowing chain posts to drag it down!', '#ffb050');
    g.audio.sfx('roar');
    let t = 0;
    yield (dt) => { t += dt; b.air = Math.min(d.air, b.air + dt * d.air * 1.4); return b.air >= d.air; };
    this.flying = true;
    const limit = final ? F.fly : d.fly;
    let left = limit, next = 0.8, turn = 0;
    while (left > 0 && this.chained.length < d.need) {
      // hover toward the players while it waits for its next attack
      yield (dt) => {
        left -= dt; next -= dt;
        const p = b.foe, c = b.clampToArena(p.x, p.y, 40);
        b.x += (c.x - b.x) * Math.min(1, dt * 0.8); b.y += (c.y - b.y) * Math.min(1, dt * 0.8);
        b.facing = angleTo(b.x, b.y, p.x, p.y);
        if (final && Math.random() < dt * 10) b.fx('charge', b.x, b.y - b.air - 30, 0, { scale: 1.2, life: 0.4 });
        return left <= 0 || next <= 0 || this.chained.length >= d.need;
      };
      if (left <= 0 || this.chained.length >= d.need || final) { next = 0.5; continue; }
      next = d.gap;
      if (turn++ % 2 === 0) yield* this.dive();
      else yield* this.strafe();
    }
    this.flying = false;
    this.last = this.lit.slice();
    this.lit = [];
    if (this.chained.length >= d.need) {
      // CRASH: dragged out of the sky
      const tel = b.tele({ shape: 'circle', x: b.x, y: b.y, r: d.crash.r, total: 0.45 }, { dmg: 'physical' });
      yield (dt) => { b.air = Math.max(0, b.air - dt * 520); return b.air <= 0; };
      b.air = 0;
      b.hit(tel, { power: d.crash.power, knock: 300 });
      g.camera.shake(1); g.audio.sfx('slam_big');
      b.fx('impact', b.x, b.y, 0, { scale: 2, life: 0.6, ground: true, squash: 0.7 });
      this.crashes++;
      if (final) this.finalDone = true;
      b.hurtable = true; this.casting = false; b.curMove = null;
      g.events.emit('bossCrashed', { bossId: b.bossId, final });
      b.enterWeak(final ? d.weak + 3 : d.weak, final ? 'THE KING FALLS' : 'CHAINED DOWN');
      return;
    }
    if (final) {
      // LAST BREATH: the whole throne burns
      g.ui.callout('LAST BREATH', '', '#ff5a20');
      b.tele({ shape: 'circle', x: b.center.x, y: b.center.y, r: b.arenaR + 20, total: 0.9, color: '255,80,20' }, { dmg: 'magic' });
      yield 0.9;
      for (const p of PLAYERS(g)) if (!p.dead && !p.invulnerable()) { g.combat.dealDamage(b, p, { power: F.power, type: 'magic', unblockable: true, knock: 200 }); p.status.add('burn', 3, { source: b }); }
      g.vfx.flash('255,120,40', 0.6, 1.4); g.camera.shake(1);
      b.fx('nova', b.center.x, b.center.y, 0, { scale: b.arenaR / 45, life: 0.8, ground: true, squash: 0.6 });
      this.finalFails++;
      this.finalT = F.retry;
    } else {
      // INFERNO: it burns the floor and lands unhurt
      g.ui.callout('INFERNO', 'Too slow — fire rains on the throne', '#ff7a30');
      const n = d.inferno.count, tels = [];
      for (let k = 0; k < n; k++) {
        const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * (b.arenaR - 20);
        tels.push(b.tele({ shape: 'circle', x: b.center.x + Math.cos(a) * rr, y: b.center.y + Math.sin(a) * rr, r: d.inferno.r, total: b.wind(1.1) + k * 0.05, color: '255,110,30' }, { dmg: 'magic' }));
      }
      yield b.wind(1.1);
      for (const tel of tels) { b.hit(tel, { power: d.inferno.power, dmg: 'magic', status: [{ id: 'burn', dur: 2 }], knock: 120 }); b.fx('eruption', tel.x, tel.y, 0, { scale: 0.7, life: 0.5, ground: true, squash: 0.7 }); }
      g.camera.shake(0.6);
    }
    yield (dt) => { b.air = Math.max(0, b.air - dt * 260); return b.air <= 0; };
    b.air = 0; b.hurtable = true; this.casting = false; b.curMove = null; b.pose = 'idle';
    yield 0.4;
  }
  // a dive at the player's position (it lands, strikes, lifts off again)
  *dive() {
    const b = this.b, g = b.game, s = this.d.dive, p = b.foe;
    const tel = b.tele({ shape: 'circle', x: p.x, y: p.y, r: s.r, total: b.wind(s.windup) }, { dmg: 'physical' });
    yield (dt) => { b.x += (tel.x - b.x) * Math.min(1, dt * 3); b.y += (tel.y - b.y) * Math.min(1, dt * 3); return tel.resolved || tel.time >= tel.total || this.chained.length >= this.d.need; };
    if (this.chained.length >= this.d.need) { tel.cancelled = true; return; }
    const air0 = b.air;
    yield (dt) => { b.air = Math.max(0, b.air - dt * 900); return b.air <= 0; };
    b.x = tel.x; b.y = tel.y;
    b.hit(tel, { power: s.power, knock: 280, guardBreak: true });
    g.camera.shake(0.5); g.audio.sfx('slam_big');
    b.fx('impact', tel.x, tel.y, 0, { scale: s.r / 45, life: 0.5, ground: true, squash: 0.7 });
    yield 0.25;
    yield (dt) => { b.air = Math.min(air0, b.air + dt * 600); return b.air >= air0; };
  }
  // a line of fire swept across the arena through the player
  *strafe() {
    const b = this.b, g = b.game, s = this.d.strafe, p = b.foe, ang = angleTo(b.center.x, b.center.y, p.x, p.y) + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
    const len = b.arenaR * 2, x0 = p.x - Math.cos(ang) * len / 2, y0 = p.y - Math.sin(ang) * len / 2;
    const tel = b.tele({ shape: 'line', x: x0, y: y0, ang, len, width: s.width, total: b.wind(s.windup), color: '255,110,30' }, { dmg: 'magic' });
    yield b.wind(s.windup);
    if (this.chained.length >= this.d.need) { tel.cancelled = true; return; }
    b.hit(tel, { power: s.power, dmg: 'magic', status: [{ id: 'burn', dur: 2 }], knock: 140 });
    for (let k = 0; k <= 6; k++) b.fx('eruption', x0 + Math.cos(ang) * len * k / 6, y0 + Math.sin(ang) * len * k / 6, 0, { scale: 0.6, life: 0.5, ground: true, squash: 0.7 });
    g.audio.sfx('fire');
  }
  draw(ctx) {
    const b = this.b, g = b.game, d = this.d;
    if (!this.flying && !this.chained.length) return;
    for (const k of this.lit) {
      const s = this.post(k), chained = this.chained.includes(k), pr = this.progress.get(k);
      ctx.strokeStyle = chained ? 'rgba(255,220,140,0.9)' : `rgba(255,150,60,${0.5 + 0.3 * Math.sin(g.time * 8)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(s.x, s.y + 4, d.reach * 0.7, d.reach * 0.3, 0, 0, TAU); ctx.stroke();
      if (pr) { ctx.strokeStyle = '#ffe0a0'; ctx.beginPath(); ctx.arc(s.x, s.y - 54, 10, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, pr.v / d.hold)); ctx.stroke(); }
      if (chained) { // the chain: post -> the dragon in the sky
        ctx.strokeStyle = 'rgba(200,180,150,0.9)'; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(s.x, s.y - 30); ctx.lineTo(b.x, b.y - b.air - 30); ctx.stroke(); ctx.setLineDash([]);
      } else if (!pr) { ctx.fillStyle = '#ffd08a'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText('[Hold E] CHAIN', s.x, s.y - 56); ctx.textAlign = 'left'; }
      ctx.lineWidth = 1;
    }
  }
  tags() {
    if (this.flying) return [{ label: `IN THE SKY · CHAINS ${this.chained.length}/${this.d.need}`, color: '#ffd08a' }];
    if (this.b.phase >= this.d.final.phase && !this.finalDone) return [{ label: 'LAST BREATH AT 10%', color: '#ff6a30' }];
    return [];
  }
}

// ---------------- ONLINE: mechanic state for the guests of a party run (net/bossSync.js)
// netState() (host) -> plain data in the boss snapshot; netApply(state, ctx) (guest, on the puppet boss's copy) makes the
// guest see / feel the same: pools, pillars (real blocked tiles), lava ring (real lava tiles + a push inward), echoes,
// chain posts, stacks (its OWN stacks from the per-player values), clusters / pylons (puppet breakables whose hits go to
// the host). netClear() (guest) undoes what netApply changed in the world (the run ended / we became the host).
// ctx = { me: our player id, map, game, boss, index (this mechanic's index), hitObject(index, netId, dmg) }
const r1 = (v) => Math.round(v * 10) / 10;
const keyed = (g, map) => { const o = {}; for (const [p, v] of map) if (v) o[pid(g, p)] = r1(v); return o; };

Overheat.prototype.netState = function () { return { h: Math.round(this.heat) }; };
Overheat.prototype.netApply = function (st) { this.heat = st.h || 0; };

LavaPools.prototype.netState = function () { return { p: this.pools.slice(-14).map((p) => [r1(p.x), r1(p.y), r1(p.r), r1(p.t)]) }; };
LavaPools.prototype.netApply = function (st) { this.pools = (st.p || []).map(([x, y, r, t]) => ({ x, y, r, t, tick: 0 })); };

Stance.prototype.netState = function () { return { c: this.cur, g: Math.round(this.guard) }; };
Stance.prototype.netApply = function (st) { if (this.d.stances[st.c]) this.cur = st.c; this.guard = st.g || 0; };

Echoes.prototype.netState = function () { return { l: this.list.map((e) => [r1(e.x), r1(e.y), r1(e.life)]) }; };
Echoes.prototype.netApply = function (st) { this.list = (st.l || []).map(([x, y, life]) => ({ x, y, life })); };

Frostbite.prototype.netState = function () { return { s: keyed(this.b.game, this.stacks) }; };
Frostbite.prototype.netApply = function (st, ctx) { this.stacks = new Map([[ctx.game.player, (st.s || {})[ctx.me] || 0]]); };

EmberDebt.prototype.netState = function () { return { s: keyed(this.b.game, this.stacks), t: r1(this.t) }; };
EmberDebt.prototype.netApply = function (st, ctx) { this.stacks = new Map([[ctx.game.player, (st.s || {})[ctx.me] || 0]]); this.t = st.t ?? this.t; };

// pillars: the same tiles block on the guest's map while they stand
Glacier.prototype.netState = function () { return { p: this.pillars.map((pl) => [pl.i, r1(pl.t)]) }; };
Glacier.prototype.netApply = function (st, ctx) {
  const m = ctx.map, want = new Map((st.p || []).filter(([i]) => Number.isInteger(i) && i >= 0 && i < m.blocker.length).map(([i, t]) => [i, t]));
  this.netHeld = this.netHeld || new Set();
  for (const i of [...this.netHeld]) if (!want.has(i)) { if (m.blocker[i] > 0) m.blocker[i]--; this.netHeld.delete(i); }
  for (const i of want.keys()) if (!this.netHeld.has(i)) { m.blocker[i]++; this.netHeld.add(i); }
  this.pillars = [...want].map(([i, t]) => ({ i, t, x: (i % m.w + 0.5) * TILE_PX, y: (Math.floor(i / m.w) + 0.5) * TILE_PX }));
};
Glacier.prototype.netClear = function (ctx) { this.netApply({ p: [] }, ctx); this.pillars = []; };

// the lava ring: the same floor tiles turn to lava on the guest's map; a guest still out there is pushed in
RisingLava.prototype.netState = function () { return { r: this.r, n: this.rises }; };
RisingLava.prototype.netApply = function (st, ctx) {
  const b = this.b, g = ctx.game, m = ctx.map, full = b.def.arena.radius + 0.5, r = typeof st.r === 'number' ? st.r : full;
  this.map = m;
  if (r >= full - 0.01) { if (this.saved.length) this.restore(); this.r = full; this.rises = 0; return; }
  if (r >= this.r - 0.01) return;
  const cx = b.center.x, cy = b.center.y, ctxT = Math.floor(cx / TILE_PX), cty = Math.floor(cy / TILE_PX), R = Math.ceil(this.r) + 1;
  for (let ty = cty - R; ty <= cty + R; ty++) for (let tx = ctxT - R; tx <= ctxT + R; tx++) {
    if (!m.inBounds(tx, ty)) continue;
    const dd = Math.hypot((tx + 0.5) * TILE_PX - cx, (ty + 0.5) * TILE_PX - cy) / TILE_PX, i = m.idx(tx, ty);
    if (dd <= r || dd > this.r + 0.6 || !this.d.floorTiles.includes(m.tiles[i])) continue;
    this.saved.push([i, m.tiles[i]]);
    m.tiles[i] = this.d.lavaTile;
  }
  if (m.chunkCache) m.chunkCache.clear();
  const p = g.player;
  if (p && !p.dead && Math.hypot(p.x - cx, p.y - cy) >= (r - 0.6) * TILE_PX) { const a = angleTo(cx, cy, p.x, p.y); p.x = cx + Math.cos(a) * (r - 1.4) * TILE_PX; p.y = cy + Math.sin(a) * (r - 1.4) * TILE_PX; p.kx = p.ky = 0; }
  this.r = r; this.rises = st.n || this.rises + 1;
  b.arenaR = (r - 0.5) * TILE_PX;
};
RisingLava.prototype.netClear = function () { this.restore(); this.r = this.b.def.arena.radius + 0.5; this.rises = 0; };

// chain posts: lit / chained / progress (a guest holds [E] at a post: net/bossSync.js sends it to the host)
SkyChains.prototype.netState = function () { const pr = {}; for (const [k, v] of this.progress) pr[k] = r1(v.v); return { f: this.flying ? 1 : 0, l: this.lit, c: this.chained, p: pr, x: this.finalDone ? 1 : 0 }; };
SkyChains.prototype.netApply = function (st) {
  this.flying = !!st.f; this.lit = (st.l || []).filter(Number.isInteger); this.chained = (st.c || []).filter(Number.isInteger); this.finalDone = !!st.x;
  this.progress = new Map(Object.entries(st.p || {}).map(([k, v]) => [Number(k), { p: null, v }]));
};

// clusters / pylons: breakables on the host; the guest gets PUPPET breakables (same place, the host's HP) — a hit on one
// goes to the host (ctx.hitObject), only the host breaks it
function objectsState(list) { return list.filter((c) => !c.dead).map((c) => [c.netId || 0, r1(c.x), r1(c.y), Math.max(0, Math.round(c.hp)), c.maxHp]); }
function objectsApply(mech, rows, ctx, prop, label, height) {
  const g = ctx.game, w = g.world;
  mech.netObjs = mech.netObjs || new Map();
  const seen = new Set();
  for (const [id, x, y, hp, max] of rows || []) {
    if (!Number.isInteger(id)) continue;
    seen.add(id);
    let br = mech.netObjs.get(id);
    if (!br) {
      const pr = w.map.addProp({ name: prop, x, y: y + 10, scale: 0.85 });
      br = new Breakable(g, x, y, { kind: 'crystal', hp: max, radius: 17, height, prop: pr, label });
      br.puppet = true; br.netId = id;
      br.netDamage = (amount) => ctx.hitObject(ctx.index, id, Math.max(0, Math.round(amount)));
      mech.netObjs.set(id, br);
      w.breakables.push(br);
    }
    br.maxHp = max; br.hp = Math.max(1, hp);
  }
  for (const [id, br] of [...mech.netObjs]) if (!seen.has(id)) { br.onDeath(); if (br.prop) br.prop.visible = false; const i = w.breakables.indexOf(br); if (i >= 0) w.breakables.splice(i, 1); mech.netObjs.delete(id); }
}
function objectsClear(mech, ctx) { objectsApply(mech, [], ctx); }
CrystalArmor.prototype.netState = function () { return { o: objectsState(this.list), g: r1(this.growT), t: r1(this.t) }; };
CrystalArmor.prototype.netApply = function (st, ctx) { objectsApply(this, st.o, ctx, this.d.prop, 'Crystal Cluster', 40); this.growT = st.g || 0; this.t = st.t ?? this.t; this.list = [...(this.netObjs || new Map()).values()]; };
CrystalArmor.prototype.netClear = function (ctx) { objectsClear(this, ctx); this.list = []; };
Pylons.prototype.netState = function () { return { o: objectsState(this.list), k: this.casting ? 1 : 0, c: r1(this.chargeT) }; };
Pylons.prototype.netApply = function (st, ctx) { objectsApply(this, st.o, ctx, this.d.prop, 'Eclipse Pylon', 50); this.casting = !!st.k; this.chargeT = st.c || 0; this.list = [...(this.netObjs || new Map()).values()]; };
Pylons.prototype.netClear = function (ctx) { objectsClear(this, ctx); this.list = []; };
// host: a guest's hit on one of our clusters / pylons
CrystalArmor.prototype.netHit = Pylons.prototype.netHit = function (id, dmg, src) {
  const c = this.list.find((x) => x.netId === id && !x.dead);
  if (!c) return;
  c.hp -= dmg; c.flash = 0.12;
  if (c.onHurt) c.onHurt(dmg, src);
  if (c.hp <= 0) { c.hp = 0; c.onDeath(src); }
};

export const MECHANICS = { ember_debt: EmberDebt, rising_lava: RisingLava, sky_chains: SkyChains, overheat: Overheat, lava_pools: LavaPools, stance: Stance, rune_sequence: RuneSequence, echoes: Echoes, judgement: Judgement, frostbite: Frostbite, glacier: Glacier, crystal_armor: CrystalArmor, pylons: Pylons };
export const MECHANIC_TYPES = Object.keys(MECHANICS);
