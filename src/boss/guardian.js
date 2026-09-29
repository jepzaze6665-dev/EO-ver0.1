import { Poise } from '../combat/poiseSystem.js';
import { POISE } from '../data/poise.js';
import { Entity } from '../core/entity.js';
import { TEAM } from '../core/constants.js';
import { MONSTERS } from '../monsters/monsterTypes.js';
import { BOSSES } from '../data/bosses.js';
import { Monster } from '../monsters/monster.js';
import { flashOf } from '../monsters/monsterSprites.js';
import { frameAt } from '../monsters/sheetSprites.js';
import { angleTo, dist, rand, TAU, wrapAngle, clamp, pick, lerp, easeOutCubic } from '../core/math.js';
import { bossScale, shiftBand } from '../progression/levelScaling.js';

// GUARDIAN OF THE FOREST — 3-phase boss = A1's boss (W2; data/bosses.js boss_a1; lifecycle: boss/bossSystem.js).
// V2.2: a Final Attack at 12% HP in phase 3 — "Last Root of the Forest" (the whole arena erupts except near its heart).
// Attacks are generator "moves": they yield seconds to wait, or a per-frame function
// that returns true when finished. Weak Windows open after heavy attacks, charge
// crashes and full stagger — the moment for Shadow Mark 3/3 -> Shadow Break -> Eclipse Sever.
export const STAGGER_MAX = 900; // the Guardian's poise (data/poise.js rules: POISE.boss)

export class Guardian extends Entity {
  constructor(game, x, y) {
    super(x, y);
    this.game = game;
    this.type = 'guardian';
    this.def = MONSTERS.guardian;
    this.team = TEAM.ENEMY;
    // LEVEL SCALING: tuned at MONSTERS.guardian.level, lives at BOSSES.boss_a1.level
    const bd = BOSSES.boss_a1 || {};
    this.level = bd.level || this.def.level;
    this.levelShift = this.level - this.def.level;
    const ls = this.levelScale = bossScale({ level: this.level, nativeLevel: this.def.level });
    this.levelPowerMult = ls.power;
    this.maxHp = this.hp = Math.round(this.def.hp * ls.hp);
    this.defense = Math.round(this.def.def * ls.def);
    this.radius = 44;
    this.height = 140;
    this.drawScale = 1.6;
    this.mass = 8;
    this.superArmor = true;
    this.weakness = this.def.weakness;
    this.home = { x, y };
    this.state = 'dormant';
    this.phase = 1;
    this.facing = Math.PI / 2;
    this.pose = 'sleep';
    this.poseT = 0;
    this.animT = 0;
    this.co = null; this.wait = 0; this.waitFn = null;
    this.cds = {};
    this.poise = new Poise(STAGGER_MAX, POISE.boss);
    this.air = 0; // jump height
    this.lastMoves = [];
    this.summons = [];
    this.isBoss = true;
    this.hurtable = false;
    this.moveCount = 0;
  }

  get arena() { return this.game.world.regions; }
  get center() { return this.game.world.regions.arenaCenter; }
  wind(t) { return t * (this.phase === 3 ? 0.72 : this.phase === 2 ? 0.9 : 1); }

  // ---------------- fight lifecycle
  wake() {
    const g = this.game;
    this.state = 'intro';
    this.hurtable = false;
    this.pose = 'roar'; this.poseT = 0;
    g.camera.lookAt(this.x, this.y - 30, 2.2);
    g.camera.shake(0.6);
    g.audio.sfx('roar');
    g.audio.music('boss');
    g.vfx.ring(this.x, this.y, 20, 200, { life: 0.9, color: '120,240,255', width: 5 });
    g.ui.bossTitle(this.def.name.toUpperCase(), this.def.title);
    this.run(this.introMove());
  }
  *introMove() {
    yield 2.2;
    this.state = 'fight';
    this.hurtable = true;
    this.pose = 'idle';
  }
  reset() {
    this.hp = this.maxHp;
    this.phase = 1;
    this.state = 'dormant';
    this.pose = 'sleep';
    this.co = null; this.wait = 0; this.waitFn = null;
    this.status.clear();
    this.poise.reset();
    this.air = 0;
    this.x = this.home.x; this.y = this.home.y;
    this.hurtable = false;
    this.dead = false;
    this.finalDone = false;
    for (const s of this.summons) if (!s.dead) { s.dead = true; s.deathT = 1; }
    this.summons = [];
    this.game.combat.telegraphs.cancelOwner(this);
  }

  run(gen) {
    this.co = gen;
    this.wait = 0;
    this.waitFn = null;
  }
  interruptMove() {
    this.co = null; this.wait = 0; this.waitFn = null;
    this.game.combat.telegraphs.cancelOwner(this);
    this.air = 0;
  }

  onHurt(amount, src, opts) {
    const g = this.game;
    // damage gates: every phase must be played — HP cannot skip past a threshold before its transition
    // (and in phase 3 not below 11% before the Final Attack has been seen)
    const floor = this.phase === 1 ? 0.69 : this.phase === 2 ? 0.29 : this.finalDone ? 0 : 0.11;
    if (this.hp < this.maxHp * floor) this.hp = Math.ceil(this.maxHp * floor);
    if (this.state !== 'weak') {
      // poise can empty mid-move; the break waits for the next hit while it is in its 'fight' state
      if (this.poise.hit(opts.stagger, { big: opts.big, counter: this.status.has('counter_window'), canBreak: this.state === 'fight' })) {
        this.enterWeak(4, 'STAGGERED');
        this.game.events.emit('poiseBroken', { target: this, source: src });
      }
    }
    this.checkPhase();
  }
  checkPhase() {
    if (this.dead || this.state === 'transition') return;
    const pct = this.hp / this.maxHp;
    const next = this.phase === 1 && pct <= 0.7 ? 2 : this.phase === 2 && pct <= 0.3 ? 3 : 0;
    if (!next) return;
    if (this.state === 'weak') this.pendingPhase = next; // let the player finish their burst first
    else this.beginTransition(next);
  }

  enterWeak(dur, label = 'WEAK WINDOW') {
    const g = this.game;
    this.interruptMove();
    this.state = 'weak';
    this.pose = 'kneel'; this.poseT = 0;
    this.status.add('vulnerable', dur, { refresh: true });
    this.weakT = dur;
    g.ui.callout(label, 'Core exposed — unleash your burst!', '#5af0ff');
    g.vfx.ring(this.x, this.y, 10, 90, { color: '120,240,255', life: 0.5 });
    g.audio.sfx('weak');
    g.events.emit('bossWeak');
  }

  beginTransition(nextPhase) {
    const g = this.game;
    this.interruptMove();
    this.status.remove('vulnerable');
    this.state = 'transition';
    this.hurtable = false;
    this.pose = 'roar'; this.poseT = 0;
    this.phase = nextPhase;
    this.run(this.transitionMove(nextPhase));
  }
  *transitionMove(ph) {
    const g = this.game;
    // walk back to the centre
    yield (dt) => this.stepToward(this.center.x, this.center.y - 10, 260, dt) < 8;
    this.pose = 'roar'; this.poseT = 0;
    g.audio.sfx('roar');
    g.camera.shake(0.8);
    g.vfx.flash(ph === 3 ? '120,20,160' : '60,200,255', 0.4, 1.5);
    g.ui.callout(ph === 2 ? 'PHASE 2' : 'PHASE 3 — ENRAGED', ph === 2 ? 'The forest answers its call' : 'Corruption consumes the Guardian', ph === 2 ? '#7af0c0' : '#d070ff');
    g.world.setArenaPhase(ph);
    const t = this.tele({ shape: 'ring', x: this.x, y: this.y, r0: 20, r: 190, total: 1.3, color: ph === 3 ? '200,80,255' : '255,80,80' });
    yield 1.3;
    this.strike(t, 22, 420);
    g.vfx.ring(this.x, this.y, 20, 200, { life: 0.6, color: ph === 3 ? '200,90,255' : '120,240,255', width: 8, fill: true });
    this.fx('phase', this.x, this.y - 50, 0, { scale: 1.3, life: 0.9, alpha: 0.55 }); // small + see-through: the Guardian stays visible
    yield 0.9;
    this.hurtable = true;
    this.state = 'fight';
    this.pose = 'idle';
    this.cds = {};
  }

  onDeath() {
    const g = this.game;
    this.dead = true;
    this.deathT = 0;
    this.interruptMove();
    this.pose = 'kneel';
    for (const s of this.summons) if (!s.dead) { s.hp = 0; s.onDeath(null); }
    g.onBossDefeated(this);
  }

  // Heartwood Ward: every living Thornling tethers the Guardian (-50% damage taken) — the adds must be dealt with
  // (AoE, taunt + guard, control), the fight can't be won by pure single-target damage
  livingSummons() { return this.summons.filter((s) => !s.dead); }
  updateWard() {
    const g = this.game, n = this.livingSummons().length, warded = this.status.has('heartwood_ward');
    if (n && !this.dead) {
      this.status.add('heartwood_ward', 1, { refresh: true });
      if (!warded) { g.ui.callout('HEARTWOOD WARD', 'The Thornlings shield the Guardian — cut them down!', '#7af0a0'); g.events.emit('bossWarded', { boss: this, adds: n }); }
    } else if (warded) {
      this.status.remove('heartwood_ward');
      g.vfx.ring(this.x, this.y, 10, 120, { color: '140,255,160', life: 0.5 });
      g.events.emit('bossWardBroken', { boss: this });
    }
  }

  // Boss UI snapshot — the HUD draws this and never reads boss internals (logic / presentation split)
  // boss VFX from the data (boss_a1 look.vfx: the owner's A1 sheet); false when not set
  fx(key, x, y, ang = 0, o = {}) {
    const d = BOSSES.boss_a1, n = d && d.look && d.look.vfx && d.look.vfx[key];
    if (!n) return false;
    this.game.vfx.sprite(n, x, y, ang, { life: 0.5, glow: 0.5, ...o });
    return true;
  }
  hudState() {
    const weak = this.status.has('vulnerable'), P3 = this.phase === 3;
    return {
      name: this.def.name.toUpperCase(), hp: this.hp, maxHp: this.maxHp,
      phase: this.phase, phaseLabel: ['', 'PHASE I', 'PHASE II', 'PHASE III — ENRAGED'][this.phase], phaseMarks: [0.7, 0.3],
      color: P3 ? ['#c050ff', '#50106a'] : ['#50e0b0', '#106a50'], titleColor: P3 ? '#e8a0ff' : '#dffcff',
      meter: weak ? { pct: (this.weakT || 0) / 4, color: ['#9af8ff', '#3ab0d0'] } : { pct: 1 - this.poise.ratio(), color: ['#ffd070', '#a07020'] },
      tags: [this.status.has('heartwood_ward') && { label: `WARDED ×${this.livingSummons().length}`, color: '#7af0a0' }, weak && { label: 'CORE EXPOSED', color: '#9af8ff' }].filter(Boolean),
    };
  }

  // ---------------- helpers
  tele(def) { return this.game.combat.telegraphs.add({ owner: this, color: this.phase === 3 ? '220,70,255' : '255,60,60', ...def }); }
  strike(shape, power, knock = 180, extra = {}) { return this.game.combat.enemyStrike(this, shape, power * (this.phase === 3 ? 1.1 : 1), { knock, ...extra }); }
  facePlayer() { this.facing = angleTo(this.x, this.y, this.game.player.x, this.game.player.y); }
  stepToward(x, y, speed, dt) {
    const d = dist(this.x, this.y, x, y);
    if (d > 2) {
      const a = angleTo(this.x, this.y, x, y);
      this.x += Math.cos(a) * Math.min(d, speed * dt);
      this.y += Math.sin(a) * Math.min(d, speed * dt);
      this.facing = a;
      this.walking = true;
    }
    return d;
  }
  inArena(x, y, pad = 0) { return dist(x, y, this.center.x, this.center.y) < this.game.world.regions.arenaRadius - pad; }

  // ---------------- update
  update(dt) {
    const g = this.game;
    this.animT += dt;
    if (this.state === 'fight') this.poise.update(dt);
    this.poseT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.walking = false;
    if (this.dead) { this.deathT += dt; if (Math.random() < 0.5) g.vfx.particle(this.x + rand(-40, 40), this.y - rand(0, 80), { color: pick(['#5af0ff', '#7af0a0', '#ffffff']), vy: -rand(20, 60), life: 1, size: 2, add: true }); return; }
    this.status.update(dt);
    this.updateWard();
    if (this.state === 'dormant') {
      if (Math.random() < 0.05) g.vfx.particle(this.x + rand(-30, 30), this.y - 60, { color: '#5af0ff', vy: -10, life: 1.2, size: 2, add: true });
      return;
    }
    for (const k in this.cds) this.cds[k] -= dt;
    // coroutine
    if (this.co) {
      if (this.waitFn) { if (this.waitFn(dt)) this.waitFn = null; }
      else if (this.wait > 0) this.wait -= dt;
      if (!this.waitFn && this.wait <= 0) {
        const r = this.co.next();
        if (r.done) this.co = null;
        else if (typeof r.value === 'number') this.wait = r.value;
        else if (typeof r.value === 'function') this.waitFn = r.value;
      }
    }
    if (this.state === 'weak') {
      this.weakT -= dt;
      if (Math.random() < 0.4) g.vfx.particle(this.x + Math.cos(this.facing) * 22, this.y - 42, { color: '#9af8ff', vy: -40, vx: rand(-20, 20), life: 0.5, size: 2, add: true });
      if (this.weakT <= 0) { this.state = 'fight'; this.pose = 'idle'; this.status.remove('vulnerable'); if (this.pendingPhase) { this.pendingPhase = 0; this.checkPhase(); } }
      return;
    }
    if (this.state === 'fight' && !this.co) this.think();
    // phase 3 ambient corruption
    if (this.phase === 3 && Math.random() < 0.3) g.vfx.particle(this.x + rand(-40, 40), this.y - rand(10, 90), { color: '#b050ff', vy: -40, life: 0.8, size: 2, add: true });
    // keep inside arena
    if (!this.inArena(this.x, this.y, 30)) {
      const a = angleTo(this.center.x, this.center.y, this.x, this.y);
      const r = this.game.world.regions.arenaRadius - 30;
      this.x = this.center.x + Math.cos(a) * r; this.y = this.center.y + Math.sin(a) * r;
    }
  }

  think() {
    const g = this.game, p = g.player;
    if (p.dead) { this.pose = 'idle'; return; }
    const d = dist(this.x, this.y, p.x, p.y);
    // final attack: once, when the enraged Guardian is almost down
    if (this.phase === 3 && !this.finalDone && this.hp / this.maxHp <= 0.12) { this.finalDone = true; this.run(this.mFinal()); return; }
    const pool = [];
    const add = (id, w) => { if ((this.cds[id] || 0) <= 0 && this.lastMoves[0] !== id) pool.push([id, w]); };
    add('claw', d < 110 ? 5 : 0.5);
    add('smash', d < 120 ? 2.5 : 0.3);
    add('charge', d > 140 ? 3 : 1);
    add('jump', d > 120 ? 2.5 : 1);
    if (this.phase >= 2) {
      add('roots', 2.2); add('crystals', d > 120 ? 2.4 : 1.2); add('rain', 1.6);
      if (this.summons.filter((s) => !s.dead).length < 3) add('summon', this.phase === 2 ? 1.4 : 1);
    }
    if (this.phase === 3) { add('combo', d < 140 ? 3.5 : 1); add('nova', 1.8); add('doubleCharge', d > 120 ? 2 : 0.6); }
    if (!pool.length) { this.cds = {}; return; }
    let r = rand(0, pool.reduce((s, [, w]) => s + w, 0));
    let pickId = pool[0][0];
    for (const [id, w] of pool) { r -= w; if (r <= 0) { pickId = id; break; } }
    this.lastMoves.unshift(pickId); this.lastMoves.length = 3;
    const cd = { claw: 1.2, smash: 5, charge: 6, jump: 6, roots: 7, crystals: 6, rain: 9, summon: 16, combo: 6, nova: 9, doubleCharge: 10 };
    this.cds[pickId] = cd[pickId] * (this.phase === 3 ? 0.7 : 1);
    this.moveCount++;
    const moves = {
      claw: this.mClaw, smash: this.mSmash, charge: this.mCharge, jump: this.mJump, roots: this.mRoots, crystals: this.mCrystals,
      rain: this.mRain, summon: this.mSummon, combo: this.mCombo, nova: this.mNova, doubleCharge: this.mDoubleCharge,
    };
    this.run(moves[pickId].call(this));
  }

  // ---------------- moves
  *approach(range, maxT = 1.6) {
    const p = this.game.player;
    let t = 0;
    const sp = this.phase === 3 ? 125 : 95;
    yield (dt) => { t += dt; this.pose = 'walk'; return this.stepToward(p.x, p.y, sp, dt) < range || t > maxT; };
    this.pose = 'idle';
  }

  *mClaw(fast = false) {
    const g = this.game;
    yield* this.approach(115);
    this.facePlayer();
    this.pose = 'clawWind'; this.poseT = 0;
    const tel = this.tele({ shape: 'cone', x: this.x, y: this.y - 6, r: 120, half: 1.05, ang: this.facing, total: this.wind(fast ? 0.48 : 0.62) });
    g.audio.sfx('windup_big');
    yield tel.total;
    this.pose = 'claw'; this.poseT = 0;
    this.x += Math.cos(this.facing) * 12; this.y += Math.sin(this.facing) * 12;
    this.strike(tel, 34, 240);
    if (!this.fx('slash', this.x + Math.cos(this.facing) * 70, this.y - 30 + Math.sin(this.facing) * 50, this.facing, { scale: 1.4, life: 0.32 })) g.vfx.sprite('shards', this.x + Math.cos(this.facing) * 70, this.y - 30 + Math.sin(this.facing) * 50, this.facing, { scale: 1.3, life: 0.28 });
    g.camera.shake(0.25);
    g.audio.sfx('claw');
    yield this.wind(fast ? 0.25 : 0.55);
    this.pose = 'idle';
  }

  *mSmash() {
    const g = this.game;
    yield* this.approach(110, 1.2);
    this.pose = 'rear'; this.poseT = 0;
    const tel = this.tele({ shape: 'circle', x: this.x, y: this.y, r: 140, total: this.wind(1.05) });
    g.audio.sfx('windup_big');
    yield tel.total;
    this.pose = 'slam'; this.poseT = 0;
    this.strike(tel, 46, 360, { guardBreak: true }); // Combat 2.0: smash breaks a normal guard
    g.camera.shake(0.6);
    g.vfx.ring(this.x, this.y, 10, 130, { color: '200,220,160', life: 0.45, width: 7 });
    this.fx('quake', this.x, this.y, 0, { scale: 2, life: 0.6, ground: true, squash: 0.7 });
    g.vfx.shards(this.x, this.y, '#8a7a5a', 26, 200);
    g.audio.sfx('slam_big');
    yield 0.35;
    // heavy recovery = weak window
    this.enterWeak(this.phase === 3 ? 1.8 : 2.4, 'WEAK WINDOW');
  }

  *mCharge(chain = false) {
    const g = this.game, p = g.player;
    this.facePlayer();
    this.pose = 'chargeWind'; this.poseT = 0;
    const ang = this.facing;
    // telegraph line to the arena rim
    let len = 0;
    while (len < 700 && this.inArena(this.x + Math.cos(ang) * (len + 40), this.y + Math.sin(ang) * (len + 40), 10)) len += 16;
    const tel = this.tele({ shape: 'line', x: this.x, y: this.y, ang, len: len + 30, width: 46, total: this.wind(chain ? 0.6 : 0.95) });
    g.audio.sfx('windup_big');
    yield tel.total;
    this.pose = 'charge'; this.poseT = 0;
    let hit = false, travelled = 0;
    const sp = this.phase === 3 ? 640 : 540;
    g.audio.sfx('charge');
    yield (dt) => {
      const step = sp * dt;
      this.x += Math.cos(ang) * step; this.y += Math.sin(ang) * step;
      travelled += step;
      if (!hit && this.strike({ shape: 'circle', x: this.x, y: this.y, r: this.radius + 8 }, 40, 380, { guardBreak: true, knockAng: ang + (Math.random() < 0.5 ? 1.2 : -1.2) })) hit = true;
      if (Math.random() < 0.8) g.vfx.particle(this.x + rand(-20, 20), this.y, { color: 'rgba(120,110,90,0.8)', vy: -20, life: 0.5, size: 4 });
      return !this.inArena(this.x, this.y, 34) || travelled > len + 20;
    };
    // crash into the rim
    g.camera.shake(0.7);
    g.vfx.ring(this.x, this.y, 10, 80, { color: '255,220,160', life: 0.4, width: 6 });
    this.fx('impact', this.x, this.y, 0, { scale: 1.4, life: 0.5, ground: true, squash: 0.7 });
    g.vfx.shards(this.x, this.y - 30, '#5af0ff', 20, 180);
    g.audio.sfx('crash');
    if (!chain) this.enterWeak(this.phase === 3 ? 1.6 : 2.4, 'CRASHED — WEAK WINDOW');
    else { this.pose = 'idle'; yield 0.35; }
  }
  *mDoubleCharge() {
    yield* this.mCharge(true);
    yield* this.mCharge(false);
  }

  *mJump() {
    const g = this.game, p = g.player;
    this.pose = 'crouch'; this.poseT = 0;
    const tel = this.tele({ shape: 'circle', x: p.x, y: p.y, r: 92, total: this.wind(1.15) });
    const trackUntil = tel.total * 0.6;
    tel.follow = (t, dt) => {
      if (t.time < trackUntil) {
        const k = Math.min(1, dt * 4);
        let tx = lerp(t.x, p.x, k), ty = lerp(t.y, p.y, k);
        if (!this.inArena(tx, ty, 40)) { const a = angleTo(this.center.x, this.center.y, tx, ty), r = this.game.world.regions.arenaRadius - 40; tx = this.center.x + Math.cos(a) * r; ty = this.center.y + Math.sin(a) * r; }
        t.x = tx; t.y = ty;
      }
    };
    g.audio.sfx('windup_big');
    yield 0.3;
    const sx = this.x, sy = this.y;
    let t = 0;
    const flight = tel.total - 0.3;
    this.pose = 'air';
    yield (dt) => {
      t += dt;
      const k = Math.min(1, t / flight);
      this.x = lerp(sx, tel.x, easeOutCubic(k)); this.y = lerp(sy, tel.y, easeOutCubic(k));
      this.air = Math.sin(k * Math.PI) * 120;
      this.facing = angleTo(sx, sy, tel.x, tel.y);
      return k >= 1;
    };
    this.air = 0;
    this.pose = 'slam'; this.poseT = 0;
    this.strike(tel, 42, 340, { guardBreak: true });
    g.camera.shake(0.75);
    g.vfx.ring(this.x, this.y, 10, 110, { color: '220,220,180', life: 0.45, width: 7 });
    this.fx('quake', this.x, this.y, 0, { scale: 1.8, life: 0.6, ground: true, squash: 0.7 });
    g.vfx.shards(this.x, this.y, '#8a7a5a', 22, 200);
    g.audio.sfx('slam_big');
    if (this.phase === 1) { this.enterWeak(1.3, 'OPENING'); return; }
    yield this.wind(0.8);
    this.pose = 'idle';
  }

  *mRoots() {
    const g = this.game, p = g.player;
    this.facePlayer();
    this.pose = 'roar'; this.poseT = 0;
    const lines = this.phase === 3 ? [-0.5, 0, 0.5] : [0];
    const base = this.facing;
    g.audio.sfx('roots');
    for (let i = 0; i < 8; i++) {
      for (const off of lines) {
        const a = base + off;
        const x = this.x + Math.cos(a) * (50 + i * 42), y = this.y + Math.sin(a) * (50 + i * 42);
        if (!this.inArena(x, y, 10)) continue;
        const tel = this.tele({ shape: 'circle', x, y, r: 30, total: this.wind(0.75), color: '120,255,120' });
        tel.onResolve = () => {
          this.strike(tel, 28, 200);
          this.fx('roots', x, y, 0, { scale: 1.1, life: 0.6 });
          g.vfx.burst(x, y - 6, '#6adf6a', 10, 100);
          g.vfx.shards(x, y, '#3a5a2a', 8, 120);
          g.world.rootSpike(x, y);
        };
      }
      yield 0.11;
    }
    yield this.wind(0.9);
    this.pose = 'idle';
  }

  *mCrystals() {
    const g = this.game, p = g.player;
    const volleys = this.phase === 3 ? 4 : 3;
    for (let v = 0; v < volleys; v++) {
      this.facePlayer();
      this.pose = 'roar'; this.poseT = 0;
      const n = this.phase === 3 ? 7 : 5, spread = 0.9;
      const tels = [];
      for (let i = 0; i < n; i++) {
        const a = this.facing + (i / (n - 1) - 0.5) * spread;
        tels.push(this.tele({ shape: 'line', x: this.x, y: this.y - 10, ang: a, len: 260, width: 6, total: this.wind(v === 0 ? 0.7 : 0.45), color: '90,240,255' }));
      }
      g.audio.sfx('cast');
      yield tels[0].total;
      for (const t of tels) {
        g.combat.projectiles.fire({ x: this.x + Math.cos(t.ang) * 30, y: this.y - 40 + Math.sin(t.ang) * 30, vx: Math.cos(t.ang) * 300, vy: Math.sin(t.ang) * 300, r: 6, life: 2, owner: this, power: 22, kind: 'shard', color: this.phase === 3 ? '#c080ff' : '#5af0ff', wallStop: true });
      }
      g.audio.sfx('shoot');
      yield 0.35;
    }
    this.pose = 'idle';
    yield this.wind(0.6);
  }

  *mRain() {
    const g = this.game, p = g.player;
    this.pose = 'roar'; this.poseT = 0;
    g.audio.sfx('roar_small');
    const n = this.phase === 3 ? 10 : 7;
    const spots = [{ x: p.x, y: p.y }];
    for (let i = 1; i < n; i++) {
      const a = rand(0, TAU), r = rand(40, this.game.world.regions.arenaRadius - 50);
      spots.push({ x: this.center.x + Math.cos(a) * r, y: this.center.y + Math.sin(a) * r });
    }
    spots.forEach((s, i) => {
      const tel = this.tele({ shape: 'circle', x: s.x, y: s.y, r: 48, total: this.wind(1.1) + i * 0.08, color: '90,240,255' });
      tel.onResolve = () => {
        this.strike(tel, 30, 200);
        this.fx('crystal', s.x, s.y - 10, 0, { scale: 0.8, life: 0.4 });
        g.vfx.shards(s.x, s.y, this.phase === 3 ? '#c080ff' : '#5af0ff', 14, 170);
        g.vfx.ring(s.x, s.y, 4, 50, { color: '150,240,255', life: 0.3 });
        g.camera.shake(0.12);
        g.audio.sfx('shatter');
      };
    });
    yield this.wind(1.1) + n * 0.08 + 0.4;
    this.pose = 'idle';
  }

  *mSummon() {
    const g = this.game;
    this.pose = 'roar'; this.poseT = 0;
    g.audio.sfx('roar_small');
    const count = this.phase === 3 ? 3 : 2;
    const spots = [];
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), r = rand(80, 170);
      const x = this.center.x + Math.cos(a) * r, y = this.center.y + Math.sin(a) * r;
      spots.push({ x, y });
      this.tele({ shape: 'circle', x, y, r: 20, total: 0.9, color: '120,255,120' });
    }
    yield 0.9;
    for (const s of spots) {
      const m = new Monster(g, 'thornling', s.x, s.y, { summoned: true, levelBand: shiftBand(this.levelShift) });
      m.aggro = true; m.setState('chase');
      g.world.monsters.push(m);
      this.summons.push(m);
      this.fx('summon', s.x, s.y, 0, { scale: 1, life: 0.6 });
      g.vfx.burst(s.x, s.y, '#6adf6a', 16, 120);
    }
    yield 0.6;
    this.pose = 'idle';
  }

  *mCombo() {
    yield* this.mClaw(true);
    yield* this.mClaw(true);
    yield* this.mSmash();
  }

  *mNova() {
    // expanding corruption waves — dodge through each ring
    const g = this.game;
    yield (dt) => this.stepToward(this.center.x, this.center.y - 10, 200, dt) < 10;
    this.pose = 'roar'; this.poseT = 0;
    g.audio.sfx('roar_small');
    for (let i = 0; i < 3; i++) {
      const tel = this.tele({ shape: 'ring', x: this.x, y: this.y, r0: 30 + i * 70, r: 100 + i * 70, total: 0.8 + i * 0.35, color: '220,70,255' });
      tel.onResolve = () => {
        this.strike(tel, 30, 220);
        g.vfx.ring(this.x, this.y, tel.r0, tel.r, { color: '200,90,255', life: 0.35, width: 10 });
        this.fx('nova', this.x, this.y, 0, { scale: tel.r / 50, life: 0.45, ground: true, squash: 0.6 });
      };
    }
    yield 1.9;
    this.pose = 'idle';
  }

  // FINAL ATTACK — Last Root of the Forest: a strong, long telegraph over the whole arena with one safe ring:
  // right next to the Guardian's heart. Readable, deadly if ignored, then its heart stays open for the finish.
  *mFinal() {
    const g = this.game;
    let t = 0;
    yield (dt) => { t += dt; this.pose = 'walk'; return this.stepToward(this.center.x, this.center.y - 10, 260, dt) < 10 || t > 2; };
    this.pose = 'roar'; this.poseT = 0;
    g.audio.sfx('roar');
    g.camera.shake(0.9);
    g.vfx.flash('255,60,200', 0.35, 1.2);
    g.ui.callout('LAST ROOT OF THE FOREST', 'The arena erupts — get close to its heart!', '#ff90ff');
    const tel = this.tele({ shape: 'ring', x: this.x, y: this.y, r0: 110, r: this.game.world.regions.arenaRadius, total: 2.4, color: '255,60,200' });
    yield 2.4;
    this.strike(tel, 58, 420, { unblockable: true }); // the Final Attack: no guard, no parry — dodge it
    g.vfx.ring(this.x, this.y, 110, this.game.world.regions.arenaRadius, { color: '255,90,220', life: 0.6, width: 14 });
    g.vfx.shards(this.x, this.y - 40, '#ff80ff', 50, 320);
    g.camera.shake(1);
    g.audio.sfx('slam_big');
    yield 0.6;
    this.enterWeak(4, 'THE HEART IS OPEN');
  }

  // ---------------- render
  draw(ctx) {
    const g = this.game, t = this.animT;
    // ward tethers from each living Thornling
    if (!this.dead) for (const s of this.livingSummons()) {
      ctx.strokeStyle = `rgba(140,255,160,${0.35 + 0.25 * Math.sin(t * 6 + s.x)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x, s.y - 10); ctx.quadraticCurveTo((s.x + this.x) / 2, Math.min(s.y, this.y) - 60, this.x, this.y - 60); ctx.stroke();
      ctx.lineWidth = 1;
    }
    const P3 = this.phase === 3;
    const x = Math.round(this.x), y = Math.round(this.y);
    let alpha = 1;
    if (this.dead) alpha = Math.max(0, 1 - Math.max(0, this.deathT - 1.8) / 1.5);
    // shadow grows when airborne
    const sh = 1 - this.air / 240;
    ctx.fillStyle = `rgba(0,0,0,${0.4 * alpha})`;
    ctx.beginPath(); ctx.ellipse(x, y, 76 * sh, 24 * sh, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y - this.air);
    ctx.scale(this.drawScale, this.drawScale);
    const flip = Math.cos(this.facing) < 0;
    if (flip) ctx.scale(-1, 1);
    const art = g.monsterSprites.forest_guardian;
    if (art && art.sheet) this.drawSheetBody(ctx, art, P3);
    else this.drawCanvasBody(ctx, t, P3);
    ctx.restore();

    // flash overlay (simple white body glow)
    if (this.flash > 0 && !this.dead && !(art && art.sheet)) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 3})`;
      ctx.beginPath(); ctx.ellipse(x, y - 76 - this.air, 80, 48, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.state === 'dormant') {
      ctx.fillStyle = 'rgba(200,255,255,0.8)';
      ctx.font = '8px monospace';
      const zz = Math.floor(t * 1.5) % 3;
      ctx.fillText('z'.repeat(zz + 1), x + 70, y - 140 - zz * 3);
    }
  }

  // the owner's sheet art (data/monsterArt.js forest_guardian): pose -> animation, phase 3 = corrupted form
  drawSheetBody(ctx, art, P3) {
    const map = art.poses || {};
    if (this.pose !== this.lastPose) { this.lastPose = this.pose; this.poseT0 = this.animT; }
    const pt = this.animT - (this.poseT0 || 0);
    let fr;
    if (this.dead) {
      const d = (P3 && art.anims.death_corrupt) || art.death || art.idle;
      fr = frameAt(d, this.deathT, d.length / 1.8, false);
    } else {
      const name = (P3 && map.corrupted && map.corrupted[this.pose]) || map[this.pose] || 'idle';
      const frames = art.anims[name] || art.idle;
      const loop = (map.loop || []).includes(this.pose);
      fr = frameAt(frames, loop ? this.animT : pt, art.fps[name] || 9, loop);
    }
    const s = 1 / this.drawScale * 1.25; // sheet frames are drawn at game size (ctx is scaled by drawScale)
    const w = art.w * s, h = art.h * s, ax = art.ax * s, ay = art.ay * s;
    if (this.state === 'dormant') ctx.filter = 'brightness(0.75)';
    ctx.drawImage(fr, -ax, -ay, w, h);
    ctx.filter = 'none';
    if (this.flash > 0 && !this.dead) { ctx.globalAlpha = Math.min(1, this.flash * 10); ctx.drawImage(flashOf(fr), -ax, -ay, w, h); }
    if (this.status.has('vulnerable') && !this.dead) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(this.game.time * 14);
      ctx.drawImage(flashOf(fr), -ax, -ay, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // canvas-shape placeholder body (used when the sheet art is missing)
  drawCanvasBody(ctx, t, P3) {
    const pose = this.pose;
    let bodyY = -48 + Math.sin(t * 2) * 1.5, headLift = 0, frontLeg = 0, lean = 0, squash = 1;
    if (pose === 'walk') { frontLeg = Math.sin(t * 8) * 6; bodyY += Math.abs(Math.sin(t * 8)) * -2; }
    if (pose === 'sleep') { bodyY = -34; headLift = 14; }
    if (pose === 'kneel') { bodyY = -32; headLift = 18; lean = 0.08; }
    if (pose === 'roar') { headLift = -14; bodyY -= 4; }
    if (pose === 'clawWind') { frontLeg = -22; lean = -0.1; }
    if (pose === 'claw') { frontLeg = 18; lean = 0.12; }
    if (pose === 'chargeWind') { headLift = 10; lean = 0.15; bodyY += 6; }
    if (pose === 'charge') { headLift = 8; lean = 0.2; frontLeg = Math.sin(t * 20) * 10; }
    if (pose === 'rear') { lean = -0.35; frontLeg = -26; headLift = -10; }
    if (pose === 'slam') { lean = 0.18; frontLeg = 20; bodyY += 6; squash = 1.08; }
    if (pose === 'crouch') { bodyY += 10; squash = 1.1; }
    if (pose === 'air') { frontLeg = -12; lean = -0.1; }
    ctx.rotate(lean);
    ctx.scale(squash, 2 - squash);

    const bark = P3 ? '#2e2436' : '#2f4028', barkD = P3 ? '#1a1222' : '#1e2a1a', moss = P3 ? '#4a2a5a' : '#4a6a36', mossL = P3 ? '#7a3a9a' : '#6a8a44';
    const cry = P3 ? '#c070ff' : '#5af0ff', cryL = P3 ? '#f0d0ff' : '#dffcff', cryD = P3 ? '#6a2aa8' : '#2a9ac0';
    // back legs
    const leg = (lx, off, c) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(lx - 7, bodyY + 10); ctx.lineTo(lx + 7, bodyY + 10); ctx.lineTo(lx + 8 + off * 0.3, -2); ctx.lineTo(lx - 9 + off * 0.3, -2); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#07090a'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = barkD; ctx.fillRect(lx - 10 + off * 0.3, -6, 20, 6);
    };
    leg(-26, -frontLeg * 0.5, barkD); leg(18, frontLeg * 0.4, barkD);
    // tail vines
    ctx.strokeStyle = moss; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-44, bodyY); ctx.quadraticCurveTo(-62, bodyY + 6 + Math.sin(t * 2) * 4, -58, bodyY + 30); ctx.stroke();
    ctx.lineWidth = 1;
    // body
    ctx.fillStyle = bark;
    ctx.beginPath(); ctx.ellipse(0, bodyY, 48, 27, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#07090a'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
    // bark grain + moss drips
    ctx.strokeStyle = barkD;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-36 + i * 13, bodyY + 4); ctx.quadraticCurveTo(-32 + i * 13, bodyY + 14, -38 + i * 13, bodyY + 22); ctx.stroke(); }
    ctx.fillStyle = moss;
    for (let i = 0; i < 7; i++) ctx.fillRect(-34 + i * 10, bodyY - 6 + (i % 2) * 3, 3, 6 + (i % 3) * 3);
    ctx.fillStyle = barkD;
    for (let i = -3; i <= 3; i++) ctx.fillRect(i * 12 - 1, bodyY - 8 + (i % 2) * 5, 2, 20);
    ctx.fillStyle = moss;
    ctx.beginPath(); ctx.ellipse(-4, bodyY - 14, 42, 13, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = mossL;
    for (let i = 0; i < 9; i++) ctx.fillRect(-38 + i * 9, bodyY - 24 + (i % 3) * 2, 5, 3);
    // back crystals
    const spikes = this.phase >= 2 ? [[-30, 18], [-18, 26], [-6, 30], [6, 24], [18, 16]] : [[-24, 16], [-8, 22], [8, 18]];
    for (const [sx, h] of spikes) {
      ctx.fillStyle = cryD;
      ctx.beginPath(); ctx.moveTo(sx - 6, bodyY - 20); ctx.lineTo(sx, bodyY - 20 - h); ctx.lineTo(sx + 6, bodyY - 20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = cry;
      ctx.beginPath(); ctx.moveTo(sx - 2, bodyY - 20); ctx.lineTo(sx, bodyY - 20 - h); ctx.lineTo(sx + 4, bodyY - 20); ctx.closePath(); ctx.fill();
    }
    // front legs
    leg(-10, frontLeg * 0.4, bark);
    ctx.save(); ctx.translate(34, 0); ctx.rotate(frontLeg * 0.012); leg(0, frontLeg, bark);
    // claws
    ctx.fillStyle = '#d8d0b8';
    for (let i = 0; i < 3; i++) ctx.fillRect(-8 + i * 6 + frontLeg * 0.3, -3, 3, 5);
    ctx.restore();
    // chest core (weak point) — blazes during the weak window
    const weak = this.status.has('vulnerable');
    const pulse = 0.6 + 0.4 * Math.sin(t * (weak ? 16 : 4));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = weak ? `rgba(160,255,255,${0.5 * pulse})` : `rgba(90,240,255,${0.18 * pulse})`;
    ctx.beginPath(); ctx.arc(30, bodyY + 4, weak ? 18 : 10, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = weak ? '#ffffff' : cry;
    ctx.beginPath(); ctx.moveTo(30, bodyY - 6); ctx.lineTo(36, bodyY + 4); ctx.lineTo(30, bodyY + 14); ctx.lineTo(24, bodyY + 4); ctx.closePath(); ctx.fill();
    // head (bone-masked stag)
    const hx = 50, hy = bodyY - 18 + headLift;
    ctx.fillStyle = bark;
    ctx.beginPath(); ctx.ellipse(hx - 6, hy + 6, 14, 12, 0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#07090a'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = '#cfc6aa';
    ctx.beginPath(); ctx.moveTo(hx - 8, hy - 6); ctx.lineTo(hx + 22, hy + 4); ctx.lineTo(hx + 18, hy + 12); ctx.lineTo(hx - 6, hy + 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a261c'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = '#9a927a'; ctx.fillRect(hx + 4, hy + 8, 14, 2);
    if (pose === 'roar') { ctx.fillStyle = '#1a0a10'; ctx.beginPath(); ctx.moveTo(hx + 4, hy + 10); ctx.lineTo(hx + 20, hy + 12); ctx.lineTo(hx + 8, hy + 20); ctx.closePath(); ctx.fill(); }
    // eyes
    const eye = pose === 'sleep' ? '#1a3a3a' : P3 ? '#ff60ff' : '#7afcff';
    ctx.fillStyle = eye; ctx.fillRect(hx + 4, hy + 1, 5, 3);
    if (pose !== 'sleep') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = P3 ? 'rgba(255,90,255,0.5)' : 'rgba(120,250,255,0.5)'; ctx.fillRect(hx + 2, hy - 1, 9, 7); ctx.globalCompositeOperation = 'source-over'; }
    // crystal antlers
    const antler = (bx, by, dir, s) => {
      ctx.strokeStyle = cryD; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + dir * 8 * s, by - 22 * s); ctx.lineTo(bx + dir * 20 * s, by - 38 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + dir * 8 * s, by - 22 * s); ctx.lineTo(bx - dir * 6 * s, by - 34 * s); ctx.stroke();
      ctx.strokeStyle = cry; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + dir * 8 * s, by - 22 * s); ctx.lineTo(bx + dir * 20 * s, by - 38 * s); ctx.stroke();
      ctx.fillStyle = cryL;
      ctx.fillRect(bx + dir * 20 * s - 2, by - 40 * s, 4, 4); ctx.fillRect(bx - dir * 6 * s - 2, by - 36 * s, 3, 3);
      ctx.lineWidth = 1;
    };
    antler(hx - 4, hy - 4, -1, 1.1); antler(hx + 4, hy - 6, 1, 1);
  }
}
