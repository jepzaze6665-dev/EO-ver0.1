import { dist, TAU, angleTo, wrapAngle } from '../core/math.js';

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
      for (const pl of g.players()) {
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
    const b = this.b, g = b.game, p = g.player, d = this.d, NUM = ['I', 'II', 'III', 'IV', 'V', 'VI'];
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
    const b = this.b, g = b.game, p = g.player;
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
      if (set) { const fr = set.idle[0], s = 1.1; ctx.filter = 'hue-rotate(160deg) brightness(1.4)'; ctx.drawImage(fr, -set.ax * s, -set.ay * s, set.w * s, set.h * s); ctx.filter = 'none'; }
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
    for (const p of g.players()) {
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

export const MECHANICS = { overheat: Overheat, lava_pools: LavaPools, stance: Stance, rune_sequence: RuneSequence, echoes: Echoes, judgement: Judgement };
export const MECHANIC_TYPES = Object.keys(MECHANICS);
