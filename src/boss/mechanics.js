import { dist, TAU, angleTo, wrapAngle } from '../core/math.js';
import { TILE as TILE_PX } from '../core/constants.js';
import { Breakable } from '../exploration/breakable.js';

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
  constructor(boss, d) { this.b = boss; this.d = { max: 100, weak: 5, blast: { r: 170, power: 44, windup: 1.6 }, name: 'OVERHEATING', hint: 'Get clear of the blast — then strike its exposed core!', label: 'HEAT', weakText: 'OVERHEATED', ...d }; this.reset(); }
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
    g.ui.callout(this.d.name, this.d.hint, '#ff9a50');
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
    b.enterWeak(this.d.weak, this.d.weakText);
    g.events.emit('bossOverheated', { bossId: b.bossId });
  }
  tags() {
    const p = Math.round((this.heat / this.d.max) * 100);
    return [{ label: p >= 80 ? `${this.d.name} ${p}%` : `${this.d.label} ${p}%`, color: p >= 80 ? '#ff6a30' : '#ffb070' }];
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
  constructor(boss, d) { this.b = boss; this.d = { phase: 2, every: 11, count: 4, r: 56, power: 36, gap: 0.55, delay: 1.1, name: 'RUNE SCRIPT', hint: 'Remember the order — they burst the same way', color: '140,190,255', ...d }; this.reset(); }
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
    g.ui.callout(d.name, d.hint, `rgb(${d.color})`);
    const burstAt = d.count * 0.35 + d.delay; // each rune's own timer, set the moment it is written
    for (let i = 0; i < d.count; i++) {
      const a = Math.random() * TAU, r = i === 0 ? 0 : 90 + Math.random() * 90;
      const c = b.clampToArena(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 30);
      b.fx('sigil', c.x, c.y, 0, { ground: true, squash: 0.6, scale: d.r / 40, life: d.delay + d.count * 0.35 + d.gap * d.count + 0.4, frame: 3 });
      g.vfx.text(c.x, c.y - 10, NUM[i], { color: '#dff0ff', size: 16, life: 1.4, vy: 0 });
      const tel = b.tele({ shape: 'circle', x: c.x, y: c.y, r: d.r, total: burstAt - i * 0.35 + i * d.gap + 0.45, color: d.color, owner: this }, { dmg: 'magic' });
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
      if (set) { const fr = set.idle[0], s = this.d.scale || 1.1; ctx.filter = this.d.filter || 'hue-rotate(160deg) brightness(1.4)'; ctx.drawImage(fr, -set.ax * s, -set.ay * s, set.w * s, set.h * s); ctx.filter = 'none'; }
      else { ctx.fillStyle = 'rgba(140,190,255,0.6)'; ctx.beginPath(); ctx.ellipse(0, -20, 12, 20, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
}

// judgement (final attack, once): at `at` of its HP the boss cannot drop lower until it has used this. It returns to
// the centre and brands the whole arena; only the `domes` (blue light) are safe. Then it kneels, exhausted.
class Judgement {
  constructor(boss, d) { this.b = boss; this.d = { at: 0.15, domes: 3, domeR: 46, windup: 3.2, power: 80, weak: 6, name: 'FINAL JUDGEMENT', hint: 'Only the blue domes are safe', color: '120,170,255', domeColor: '150,210,255', flash: '170,210,255', weakText: 'EXHAUSTED', ...d }; this.reset(); }
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
    g.ui.callout(d.name, d.hint, `rgb(${d.domeColor})`);
    g.audio.sfx('roar');
    const domes = [];
    for (let k = 0; k < 40 && domes.length < d.domes; k++) {
      const a = Math.random() * TAU, r = b.arenaR * (0.35 + Math.random() * 0.4), c = { x: b.center.x + Math.cos(a) * r, y: b.center.y + Math.sin(a) * r };
      if (domes.every((o) => Math.hypot(o.x - c.x, o.y - c.y) > d.domeR * 3)) domes.push(c);
    }
    this.domes = domes;
    for (const c of domes) {
      b.fx('dome', c.x, c.y + 6, 0, { scale: d.domeR / 30, life: d.windup + 0.4 });
      g.vfx.ring(c.x, c.y, 4, d.domeR, { color: d.domeColor, life: d.windup, width: 3 });
    }
    b.tele({ shape: 'circle', x: b.center.x, y: b.center.y, r: b.arenaR - 6, total: d.windup, color: d.color }, { dmg: 'magic' });
    yield d.windup;
    for (const p of g.players()) {
      if (p.dead) continue;
      if (domes.some((c) => Math.hypot(p.x - c.x, p.y - c.y) <= d.domeR) || p.invulnerable()) { this.safe++; continue; }
      g.combat.dealDamage(b, p, { power: d.power, type: 'magic', unblockable: true, knock: 260 });
      this.hurt++;
    }
    g.vfx.flash(d.flash, 0.55, 1.8);
    g.camera.shake(1);
    b.fx('nova', b.center.x, b.center.y, 0, { scale: b.arenaR / 40, life: 0.7, ground: true, squash: 0.6 });
    g.audio.sfx('slam_big');
    this.resolved = true;
    g.events.emit('bossJudgement', { bossId: b.bossId, safe: this.safe, hurt: this.hurt });
    yield 0.4;
    b.curMove = null;
    b.enterWeak(d.weak, d.weakText);
  }
}

// frostbite (from phase d.phase): a player who stands still gathers FROSTBITE; at `max` stacks they FREEZE (stun +
// a shatter hit). Moving / dodging melts it. Stops a player from camping one spot against a fast hunter.
class Frostbite {
  constructor(boss, d) { this.b = boss; this.d = { phase: 2, max: 5, rate: 1.1, melt: 2.2, freeze: 1.1, power: 30, ...d }; this.reset(); }
  reset() { this.stacks = 0; this.last = null; this.freezes = 0; }
  update(dt) {
    const b = this.b, g = b.game, p = g.player, d = this.d;
    if (b.dead || b.phase < d.phase || (b.state !== 'fight' && b.state !== 'weak') || !p || p.dead) { this.stacks = Math.max(0, this.stacks - dt * d.melt); return; }
    const moved = this.last ? Math.hypot(p.x - this.last.x, p.y - this.last.y) / Math.max(dt, 1e-4) : 0;
    this.last = { x: p.x, y: p.y };
    if (moved > 30 || p.dash) this.stacks = Math.max(0, this.stacks - dt * d.melt);
    else this.stacks += dt * d.rate;
    if (this.stacks >= 1 && Math.random() < dt * 4) g.vfx.particle(p.x + (Math.random() - 0.5) * 20, p.y - 10 - Math.random() * 30, { color: '#cfe8ff', vy: -20, life: 0.6, size: 2 });
    if (this.stacks >= d.max) {
      this.stacks = 0; this.freezes++;
      p.status.add('stun', d.freeze);
      g.combat.dealDamage(b, p, { power: d.power, type: 'magic', unblockable: true, knock: 0 });
      b.fx('shatter', p.x, p.y - 20, 0, { scale: 0.8, life: 0.5 });
      g.vfx.text(p.x, p.y - 60, 'FROZEN!', { color: '#bfe6ff', size: 12 });
      g.events.emit('playerFrozen', { bossId: b.bossId, player: p });
    }
  }
  tags() { return this.b.phase >= this.d.phase && this.stacks >= 0.5 ? [{ label: `FROSTBITE ${Math.floor(this.stacks)}/${this.d.max}`, color: this.stacks >= this.d.max - 1 ? '#ff8080' : '#bfe6ff' }] : []; }
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
    const pa = Math.atan2(g.player.y - b.y, g.player.x - b.x);
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
    for (const p of g.players()) {
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
    for (const p of g.players()) if (!p.dead && !p.invulnerable()) g.combat.dealDamage(b, p, { power: d.power, type: 'magic', unblockable: true, knock: 260 });
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

export const MECHANICS = { overheat: Overheat, lava_pools: LavaPools, stance: Stance, rune_sequence: RuneSequence, echoes: Echoes, judgement: Judgement, frostbite: Frostbite, glacier: Glacier, crystal_armor: CrystalArmor, pylons: Pylons };
export const MECHANIC_TYPES = Object.keys(MECHANICS);
