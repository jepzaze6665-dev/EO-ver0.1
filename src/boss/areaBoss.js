import { ENEMY_COMBAT } from '../data/enemyCombat.js';
import { Poise } from '../combat/poiseSystem.js';
import { POISE } from '../data/poise.js';
import { Entity } from '../core/entity.js';
import { TEAM, TILE } from '../core/constants.js';
import { Monster } from '../monsters/monster.js';
import { flashOf } from '../monsters/monsterSprites.js';
import { frameAt } from '../monsters/sheetSprites.js';
import { MECHANICS } from './mechanics.js';
import { angleTo, dist, rand, TAU, lerp, easeOutCubic } from '../core/math.js';
import { Assets } from '../core/assets.js';
import { bossScale, shiftBand } from '../progression/levelScaling.js';

// AREA BOSS — one generic, data-driven boss entity (data: data/bosses.js). It never names a boss: stats, look,
// phases and attack patterns ("moves") all come from its data entry. The fight lifecycle (engage, arena lock,
// rewards, reset) belongs to boss/bossSystem.js; this file only fights.
//
// Entity states: dormant (idle in its arena, not hurtable) -> intro -> fight <-> weak (vulnerable window)
//                fight -> transition (phase change, not hurtable) -> fight ... -> dead
// Moves are generators (same idiom as boss/guardian.js): `yield seconds` waits, `yield fn` runs fn(dt) each frame
// until it returns true. Any class can fight it: it takes damage / statuses / marks through the normal combat
// pipeline, respects stun / root (with a short control immunity afterwards so it cannot be locked forever),
// hits through combat.enemyStrike (guard, perfect dodge, shields all work) and can deal physical or magic damage.
const CONTROL_IMMUNITY = 3; // seconds after a stun / root wears off

export class AreaBoss extends Entity {
  constructor(game, def) {
    const a = def.arena;
    super(a.bossSpawn[0] * TILE, a.bossSpawn[1] * TILE);
    const st = def.stats;
    this.game = game;
    this.def = def;
    this.bossId = def.id;
    this.type = def.id;
    this.isBoss = true;
    this.bossType = def.type;
    this.team = TEAM.ENEMY;
    // LEVEL SCALING: stats were tuned at def.nativeLevel; the boss now lives at def.level
    const ls = this.levelScale = bossScale(def);
    this.levelPowerMult = ls.power;
    this.maxHp = this.hp = Math.round(st.hp * ls.hp);
    this.defense = Math.round((st.def || 0) * ls.def);
    this.radius = st.radius || 18;
    this.height = st.height || 44;
    this.mass = st.mass || 5;
    this.weakness = st.weakness || [];
    this.superArmor = st.superArmor !== false;
    this.poise = new Poise(st.poise ?? st.staggerMax ?? 300, POISE.boss); // full break = STAGGERED weak window
    this.level = def.level;
    this.home = { x: this.x, y: this.y };
    this.center = { x: a.center[0] * TILE, y: a.center[1] * TILE };
    this.arenaR = a.radius * TILE;
    this.look = def.look || {};
    this.scale = this.look.scale || 2;
    this.sprites = (this.look.sprite && game.monsterSprites[this.look.sprite]) || null; // no sprite -> placeholder shape
    this.summons = [];
    this.animT = rand(0, 2);
    for (const [id, m] of Object.entries(def.moves || {})) if (!m.id) m.id = id;
    // signature mechanics (boss/mechanics.js): heat, lava pools, ... — what makes this fight its own
    this.mech = (def.mechanics || []).filter((m) => MECHANICS[m.type]).map((m) => new MECHANICS[m.type](this, m));
    this.reset();
  }
  get name() { return this.def.name; }
  get phaseDef() { return this.def.phases[this.phase - 1]; }
  get phaseCount() { return this.def.phases.length; }

  // ---------------- lifecycle (called by the BossSystem)
  reset() {
    this.hp = this.maxHp;
    this.phase = 1;
    this.state = 'dormant';
    this.pose = 'idle';
    this.co = null; this.wait = 0; this.waitFn = null;
    this.cds = {};
    this.lastMove = null;
    this.poise.reset();
    this.pendingPhase = false;
    this.weakT = 0; this.ccImmuneT = 0; this.air = 0;
    this.status.clear();
    this.x = this.home.x; this.y = this.home.y; this.kx = this.ky = 0;
    this.facing = Math.PI / 2;
    this.hurtable = false;
    this.dead = false; this.deathT = 0;
    this.clearSummons();
    for (const x of this.mech || []) if (x.reset) x.reset();
    this.game.combat.telegraphs.cancelOwner(this);
  }
  // the boss's own effect (data look.vfx[key]: a VFX strip, e.g. the owner's boss sheets). false = none set
  fx(key, x, y, ang = 0, o = {}) {
    const n = this.look.vfx && this.look.vfx[key];
    if (!n) return false;
    this.game.vfx.sprite(n, x, y, ang, { life: 0.5, glow: 0.5, ...o });
    return true;
  }
  // HUD tags (boss bar): the mechanics' state (e.g. HEAT 64%)
  hudState() { return { tags: (this.mech || []).flatMap((x) => (x.tags ? x.tags() : [])) }; }
  mechHook(name, a, b) { for (const x of this.mech) if (x[name]) x[name](a, b); }
  // combat asks tryBlock like a guarding player: a mechanic (stance) may raise a shield
  tryBlock(src, opts) { for (const x of this.mech) { const r = x.tryBlock && x.tryBlock(src, opts); if (r) { this.blockedBy = x; return r; } } return null; }
  onBlock(block, src, opts, ang, raw) { if (this.blockedBy && this.blockedBy.onBlock) this.blockedBy.onBlock(block, src, opts, ang, raw); }
  wake() {
    const g = this.game;
    this.state = 'intro';
    this.hurtable = false;
    this.pose = 'roar';
    this.facePlayer();
    g.camera.shake(0.5);
    g.audio.sfx('roar');
    g.audio.music('boss');
    g.vfx.ring(this.x, this.y, 16, 150, { life: 0.8, color: this.look.aura || '255,120,120', width: 5 });
    g.ui.bossTitle(this.def.name, this.def.title || '');
    this.run(this.introMove());
  }
  *introMove() {
    yield 1.6;
    this.state = 'fight';
    this.hurtable = true;
    this.pose = 'idle';
  }
  clearSummons() {
    for (const s of this.summons) if (!s.dead) { s.dead = true; s.deathT = 1; s.removed = true; }
    this.summons = [];
  }

  // ---------------- coroutine helpers
  run(gen) { this.co = gen; this.wait = 0; this.waitFn = null; }
  interruptMove() {
    this.co = null; this.wait = 0; this.waitFn = null; this.air = 0; this.curMove = null;
    this.game.combat.telegraphs.cancelOwner(this);
  }
  wind(t) { return t * ((this.phaseDef && this.phaseDef.windup) || 1); }
  speed() { return this.def.stats.speed * ((this.phaseDef && this.phaseDef.speed) || 1) * this.status.moveMult(); }
  facePlayer() { const p = this.game.player; this.facing = angleTo(this.x, this.y, p.x, p.y); }
  inArena(x, y, pad = 0) { return dist(x, y, this.center.x, this.center.y) < this.arenaR - pad; }
  clampToArena(x, y, pad) {
    if (this.inArena(x, y, pad)) return { x, y };
    const a = angleTo(this.center.x, this.center.y, x, y), r = this.arenaR - pad;
    return { x: this.center.x + Math.cos(a) * r, y: this.center.y + Math.sin(a) * r };
  }
  stepToward(x, y, speed, dt) {
    const d = dist(this.x, this.y, x, y);
    if (d > 2) {
      const a = angleTo(this.x, this.y, x, y), s = Math.min(d, speed * dt);
      this.game.world.map.moveCircle(this, Math.cos(a) * s, Math.sin(a) * s);
      this.facing = a;
      this.moving = true;
    }
    return d;
  }
  tele(def, m) {
    const magic = m && m.dmg && m.dmg !== 'physical';
    return this.game.combat.telegraphs.add({ owner: this, color: (m && m.color && !m.color.startsWith('#') && m.color) || (magic ? '176,96,255' : '255,60,60'), ...def });
  }
  // after a move: did it land? a miss = 'attackMissed' (Counter Window) + longer recovery (data/enemyCombat.js)
  missed(landed, m) {
    if (landed) return 1;
    const g = this.game;
    g.vfx.text(this.x, this.y - this.height - 12, 'MISS', { color: '#c8c8d8', size: 11, life: 0.7 });
    g.events.emit('attackMissed', { attacker: this, player: g.player, attack: m.id || m.kind });
    return m.missRecover ?? ENEMY_COMBAT.bossMissRecoverMult;
  }
  hit(shape, m, extra = {}) {
    return this.game.combat.enemyStrike(this, shape, m.power, { knock: m.knock ?? 180, type: m.dmg || 'physical', status: m.status, guardBreak: m.guardBreak, unblockable: m.unblockable, ...extra });
  }

  // ---------------- combat reactions
  onHurt(amount, src, opts) {
    if (this.state === 'dormant') return;
    this.applyFloor();
    if (this.state === 'fight') {
      if (this.poise.hit(opts.stagger, { big: opts.big, counter: this.status.has('counter_window') })) { this.enterWeak(3, 'STAGGERED'); this.game.events.emit('poiseBroken', { target: this, source: src }); }
    }
    this.checkPhase();
  }
  onDot() { this.applyFloor(); this.checkPhase(); }
  // armour (a mechanic sets this.armor, e.g. crystal_armor): combat calls this when it breaks
  onArmorBreak() { this.mechHook('onArmorBreak'); }
  onBlockedHit() { this.applyFloor(); this.checkPhase(); } // a shield-stance block still chips HP: same floors
  // every phase must be played: HP cannot drop past the next phase threshold before the transition
  applyFloor() {
    const next = this.def.phases[this.phase];
    let floor = next ? next.hpBelow - 0.01 : 0;
    for (const x of this.mech) if (x.hpFloor) floor = Math.max(floor, x.hpFloor()); // e.g. a final attack not seen yet
    if (this.hp < this.maxHp * floor) this.hp = Math.ceil(this.maxHp * floor);
  }
  checkPhase() {
    if (this.dead || this.state === 'transition' || this.state === 'intro') return;
    const next = this.def.phases[this.phase];
    if (!next || this.hp / this.maxHp > next.hpBelow) return;
    if (this.state === 'weak') this.pendingPhase = true; // let the player finish the burst first
    else this.beginTransition();
  }
  enterWeak(dur, label = 'OPENING') {
    const g = this.game;
    this.interruptMove();
    this.state = 'weak';
    this.pose = 'hurt';
    this.status.add('vulnerable', dur, { refresh: true });
    this.weakT = dur;
    g.ui.callout(label, 'Its guard is down — strike now!', '#5af0ff');
    g.audio.sfx('weak');
    g.events.emit('bossWeak', { bossId: this.bossId });
  }
  beginTransition() {
    this.interruptMove();
    this.status.remove('vulnerable');
    this.state = 'transition';
    this.hurtable = false;
    this.phase++;
    this.run(this.transitionMove());
  }
  *transitionMove() {
    const g = this.game, ph = this.phaseDef;
    let t = 0;
    yield (dt) => { t += dt; this.pose = 'walk'; return this.stepToward(this.center.x, this.center.y, 220, dt) < 12 || t > 1.5; };
    this.pose = 'roar';
    g.audio.sfx('roar');
    g.camera.shake(0.7);
    g.vfx.flash(this.look.aura || '255,120,120', 0.35, 1.6);
    // the phase burst stays small and see-through: the boss must stay visible while it changes (a full-size bright burst
    // on top hid it for seconds)
    this.fx('phase', this.x, this.y - this.height * 0.4, 0, { scale: 1.2, life: 0.9, alpha: 0.55 });
    // phase aura sequence (look.phaseAura[phase].transition: effect keys played one after another UNDER the boss —
    // ground layer, so the body is always drawn on top)
    const pa = this.look.phaseAura && this.look.phaseAura[this.phase];
    if (pa && pa.transition) pa.transition.forEach((k, i) => g.after(i * (pa.step || 0.4), () => !this.dead && g.vfx.sprite(k, this.x, this.y + 6, 0, { life: pa.stepLife || 0.7, scale: pa.scale || 1.4, glow: 0.45, ground: true, squash: 0.75, alpha: 0.85 })));
    g.ui.callout(ph.name, ph.sub || '', '#e0b0ff');
    const nPh = this.def.phases.length, ps = (this.look.phaseStyle && this.look.phaseStyle[this.phase]) || {};
    if (nPh > 1) g.vfx.text(this.x, this.y - this.height * this.scale - 30, `PHASE ${this.phase} / ${nPh}`, { color: ps.aura ? `rgb(${ps.aura})` : '#ffe0a0', size: 18, life: 2.2, vy: -12 });
    this.flash = 0.3;
    if (ph.shockwave) {
      const tel = this.tele({ shape: 'ring', x: this.x, y: this.y, r0: 20, r: 170, total: 1.1 });
      yield 1.1;
      this.hit(tel, { power: ph.shockwave, knock: 360 });
      g.vfx.ring(this.x, this.y, 20, 170, { life: 0.5, color: this.look.aura || '255,120,120', width: 8, fill: true });
    } else yield 1.1;
    yield 0.5;
    this.hurtable = true;
    this.state = 'fight';
    this.pose = 'idle';
    this.cds = {};
  }
  onDeath(src) {
    this.dead = true;
    this.deathT = 0;
    this.interruptMove();
    this.pose = 'hurt';
    for (const s of this.summons) if (!s.dead) { s.hp = 0; s.onDeath(null); }
    this.game.bosses.onEntityDeath(this, src);
  }

  // ---------------- update
  update(dt) {
    const g = this.game;
    this.animT += dt;
    if (this.state === 'fight') this.poise.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.moving = false;
    if (this.dead) { this.deathT += dt; return; }
    this.status.update(dt);
    if (this.state === 'dormant') { this.pose = 'idle'; return; }
    this.mechHook('update', dt);
    // phase aura (look.phaseAura[phase].loop): an aura effect kept playing under the boss in that phase
    const pa = this.look.phaseAura && this.look.phaseAura[this.phase];
    if (pa && pa.loop) {
      this.auraT = (this.auraT || 0) - dt;
      if (this.auraT <= 0) { this.auraT = pa.loopLife || 1; g.vfx.sprite(pa.loop, this.x, this.y + 6, 0, { life: this.auraT + 0.05, scale: pa.scale || 1.4, glow: 0.35, ground: true, squash: 0.75, alpha: 0.7 }); } // under the body
    }
    this.applyKnockback(dt, g.world.map);
    for (const k in this.cds) this.cds[k] -= dt;
    // crowd control works on bosses, but never chains: a stun / root is followed by a short immunity
    this.ccImmuneT = Math.max(0, this.ccImmuneT - dt);
    if (this.ccImmuneT > 0 && !this.status.canMove()) {
      this.status.cleanse('control');
      g.vfx.text(this.x, this.y - this.height - 12, 'RESIST', { color: '#ffd070', size: 9 });
    }
    if (!this.status.canMove()) this.wasControlled = true;
    else if (this.wasControlled) { this.wasControlled = false; this.ccImmuneT = CONTROL_IMMUNITY; }
    if (!this.status.canAct() && this.state === 'fight') { if (this.co) this.interruptMove(); this.pose = 'hurt'; return; }
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
      if (this.weakT <= 0) {
        this.state = 'fight'; this.pose = 'idle'; this.status.remove('vulnerable');
        if (this.pendingPhase) { this.pendingPhase = false; this.checkPhase(); }
      }
      return;
    }
    if (this.state === 'fight' && !this.co) this.think();
    if (this.phase > 1 && Math.random() < 0.2) g.vfx.particle(this.x + rand(-20, 20), this.y - rand(10, this.height * this.scale * 0.6), { color: `rgb(${this.look.aura || '200,120,255'})`, vy: -35, life: 0.7, size: 2, add: true });
  }

  // pick the next move from the current phase (cooldowns, range weights, never the same move twice in a row)
  think() {
    const g = this.game, p = g.player;
    if (p.dead) { this.pose = 'idle'; return; }
    for (const x of this.mech) { const turn = x.wantsTurn && x.wantsTurn(); if (turn) { this.run(turn); return; } }
    const d = dist(this.x, this.y, p.x, p.y);
    let ids = this.phaseDef.moves || [];
    for (const x of this.mech) if (x.filterMoves) ids = x.filterMoves(ids);
    const pool = [];
    for (const id of ids) {
      const m = this.def.moves[id];
      if (!m || (this.cds[id] || 0) > 0 || (id === this.lastMove && ids.length > 1)) continue;
      if (m.kind === 'summon' && this.summons.filter((s) => !s.dead).length >= (m.max || m.count || 1)) continue;
      const inRange = d <= (m.range || 999) && d >= (m.min || 0);
      pool.push([id, (m.weight || 1) * (inRange ? 1 : 0.2)]);
    }
    if (!pool.length) { this.run(this.approach(70, 0.6)); return; }
    let r = rand(0, pool.reduce((s, [, w]) => s + w, 0)), pickId = pool[0][0];
    for (const [id, w] of pool) { r -= w; if (r <= 0) { pickId = id; break; } }
    const m = this.def.moves[pickId];
    this.lastMove = pickId;
    this.cds[pickId] = m.cd || 2;
    this.run(this.execMove(m));
  }
  *approach(range, maxT = 1.6) {
    const p = this.game.player;
    let t = 0;
    yield (dt) => { t += dt; this.pose = 'walk'; return this.stepToward(p.x, p.y, this.speed(), dt) < range || t > maxT; };
    this.pose = 'idle';
  }
  *execMove(m) {
    const p = this.game.player;
    if (m.range && m.range < 999 && dist(this.x, this.y, p.x, p.y) > m.range * 0.9) yield* this.approach(m.range * 0.8);
    const kind = KINDS[m.kind];
    this.curMove = m; // sheet art: the move may name its own animations (m.anim)
    if (kind) yield* kind.call(this, m);
    this.curMove = null;
    this.pose = 'idle';
    this.mechHook('onMoveDone', m.id, m);
  }
}

// ---------------- move kinds (data: data/bosses.js `moves`)
// telegraph shape from move data (cone in front · circle at an offset · ring around)
function shapeTel(b, s, total) {
  const off = s.offset || 0, base = { x: b.x + Math.cos(b.facing) * off, y: b.y + Math.sin(b.facing) * off, total };
  return s.shape === 'cone' ? { ...base, shape: 'cone', r: s.r, half: s.half, ang: b.facing } : s.shape === 'ring' ? { ...base, shape: 'ring', r0: s.r0, r: s.r } : { ...base, shape: 'circle', r: s.r };
}
const KINDS = {
  // combo: several strikes in a row, each with its own wind-up (hits[]: { windup, shape?, power?, track? }). A late
  // last hit (long windup) punishes an early dodge — wait for it. track = turn to the player before that hit.
  *combo(m) {
    const g = this.game;
    this.facePlayer();
    let any = false;
    for (let i = 0; i < m.hits.length; i++) {
      const h = m.hits[i], s = h.shape || m.shape;
      if (h.track) this.facePlayer();
      this.pose = 'windup';
      const tel = this.tele(shapeTel(this, s, this.wind(h.windup)), m);
      this.mechHook('onTelegraph', tel, m);
      g.audio.sfx(i === m.hits.length - 1 ? 'windup_big' : 'enemy_swing');
      yield tel.total;
      this.pose = 'attack';
      if (this.hit(tel, { ...m, power: h.power ?? m.power })) any = true;
      if (!this.fx('slash', this.x + Math.cos(this.facing) * s.r * 0.55, this.y - 18 + Math.sin(this.facing) * s.r * 0.35, this.facing, { scale: s.r / 70, life: 0.3 })) g.vfx.sprite('shards', this.x + Math.cos(this.facing) * s.r * 0.6, this.y - 20, this.facing, { scale: 1, life: 0.24 });
      g.camera.shake(i === m.hits.length - 1 ? 0.4 : 0.2);
      yield h.after ?? 0.12;
    }
    yield this.wind((m.recover || 0.6) * this.missed(any, m));
    if (m.opening) this.enterWeak(m.opening, 'OPENING');
  },
  *strike(m) {
    const g = this.game, s = m.shape;
    this.facePlayer();
    this.pose = 'windup';
    const off = s.offset || 0;
    const base = { x: this.x + Math.cos(this.facing) * off, y: this.y + Math.sin(this.facing) * off, total: this.wind(m.windup) };
    const tel = this.tele(s.shape === 'cone' ? { ...base, shape: 'cone', r: s.r, half: s.half, ang: this.facing } : s.shape === 'ring' ? { ...base, shape: 'ring', r0: s.r0, r: s.r } : { ...base, shape: 'circle', r: s.r }, m);
    this.fx('charge', this.x, this.y, 0, { follow: this, off: 0, life: tel.total, scale: 1.2 });
    this.mechHook('onTelegraph', tel, m);
    g.audio.sfx('windup_big');
    yield tel.total;
    this.pose = 'attack';
    const struck = this.hit(tel, m);
    if (s.shape === 'cone') { if (!this.fx('slash', this.x + Math.cos(this.facing) * s.r * 0.55, this.y - 18 + Math.sin(this.facing) * s.r * 0.35, this.facing, { scale: s.r / 70, life: 0.32 })) g.vfx.sprite('shards', this.x + Math.cos(this.facing) * s.r * 0.6, this.y - 20 + Math.sin(this.facing) * s.r * 0.4, this.facing, { scale: 1.1, life: 0.26 }); }
    else { g.vfx.ring(tel.x, tel.y, s.r0 || 10, s.r, { color: this.look.aura || '220,200,160', life: 0.4, width: 6 }); this.fx('impact', tel.x, tel.y, 0, { scale: s.r / 50, life: 0.55, ground: true, squash: 0.7 }); }
    g.camera.shake(s.shape === 'cone' ? 0.25 : 0.45);
    g.audio.sfx(s.shape === 'cone' ? 'claw' : 'slam_big');
    yield this.wind((m.recover || 0.5) * this.missed(struck, m));
    if (m.opening) this.enterWeak(m.opening, 'OPENING');
  },
  *dash(m) {
    const g = this.game;
    this.facePlayer();
    this.pose = 'windup';
    const ang = this.facing;
    let len = 0;
    while (len < m.len && this.inArena(this.x + Math.cos(ang) * (len + this.radius), this.y + Math.sin(ang) * (len + this.radius), 8)) len += 12;
    const tel = this.tele({ shape: 'line', x: this.x, y: this.y, ang, len: len + this.radius, width: m.width, total: this.wind(m.windup) }, m);
    this.mechHook('onTelegraph', tel, m);
    g.audio.sfx('windup_big');
    yield tel.total;
    this.pose = 'attack';
    g.audio.sfx('charge');
    const sp = Math.max(420, len / 0.35);
    let travelled = 0, hitDone = false;
    yield (dt) => {
      const bx = this.x, by = this.y, step = sp * dt;
      g.world.map.moveCircle(this, Math.cos(ang) * step, Math.sin(ang) * step);
      const moved = Math.hypot(this.x - bx, this.y - by);
      travelled += step;
      this.moving = true;
      if (!hitDone && this.hit({ shape: 'circle', x: this.x, y: this.y, r: this.radius + 8 }, m, { knockAng: ang + (Math.random() < 0.5 ? 1.2 : -1.2) })) hitDone = true;
      if (Math.random() < 0.7) g.vfx.particle(this.x + rand(-12, 12), this.y, { color: 'rgba(140,130,110,0.7)', vy: -18, life: 0.4, size: 3 });
      return travelled >= len || moved < step * 0.3 || !this.inArena(this.x, this.y, 10);
    };
    g.camera.shake(0.4);
    g.vfx.ring(this.x, this.y, 8, 60, { color: '255,220,160', life: 0.35, width: 5 });
    this.fx('impact', this.x, this.y, 0, { scale: 1.3, life: 0.5, ground: true, squash: 0.7 });
    yield this.wind((m.recover || 0.6) * this.missed(hitDone, m));
    if (m.opening) this.enterWeak(m.opening, 'OPENING');
  },
  *leap(m) {
    const g = this.game, p = g.player;
    this.pose = 'windup';
    const tel = this.tele({ shape: 'circle', x: p.x, y: p.y, r: m.r, total: this.wind(m.windup) }, m);
    const trackUntil = tel.total * (m.track ?? 0.5);
    tel.follow = (t, dt) => {
      if (t.time >= trackUntil) return;
      const k = Math.min(1, dt * 4), c = this.clampToArena(lerp(t.x, p.x, k), lerp(t.y, p.y, k), 20);
      t.x = c.x; t.y = c.y;
    };
    g.audio.sfx('windup_big');
    yield 0.25;
    const sx = this.x, sy = this.y, flight = tel.total - 0.25;
    let t = 0;
    this.pose = 'attack';
    yield (dt) => {
      t += dt;
      const k = Math.min(1, t / flight);
      this.x = lerp(sx, tel.x, easeOutCubic(k)); this.y = lerp(sy, tel.y, easeOutCubic(k));
      this.air = Math.sin(k * Math.PI) * 90;
      this.facing = angleTo(sx, sy, tel.x, tel.y);
      return k >= 1;
    };
    this.air = 0;
    if (g.world.map.circleBlocked(this.x, this.y, this.radius)) { const pos = g.world.map.findOpen(this.x, this.y, 3); this.x = pos.x; this.y = pos.y; }
    const landed = this.hit(tel, m);
    g.camera.shake(0.6);
    g.vfx.ring(this.x, this.y, 10, m.r, { color: '220,210,170', life: 0.45, width: 7 });
    g.vfx.shards(this.x, this.y, '#8a7a5a', 18, 180);
    g.audio.sfx('slam_big');
    yield this.wind((m.recover || 0.6) * this.missed(landed, m));
    if (m.opening) this.enterWeak(m.opening, 'OPENING');
  },
  *volley(m) {
    const g = this.game;
    this.facePlayer();
    this.pose = 'windup';
    const n = m.count || 3, spread = m.spread || 0.6, tels = [];
    for (let i = 0; i < n; i++) {
      const a = this.facing + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
      tels.push(this.tele({ shape: 'line', x: this.x, y: this.y - 10, ang: a, len: 260, width: 5, total: this.wind(m.windup) }, m));
    }
    this.fx('charge', this.x, this.y, 0, { follow: this, off: 20, life: tels[0].total, scale: 1.1 });
    g.audio.sfx('cast');
    yield tels[0].total;
    this.pose = 'attack';
    const col = (m.color && m.color.startsWith('#') && m.color) || '#ff9a60';
    const bolt = this.look.vfx && this.look.vfx.bolt, bd = bolt && Assets.vfx[bolt];
    for (const t of tels) {
      g.combat.projectiles.fire({
        x: this.x + Math.cos(t.ang) * 26, y: this.y - 24 + Math.sin(t.ang) * 26, vx: Math.cos(t.ang) * (m.speed || 240), vy: Math.sin(t.ang) * (m.speed || 240),
        r: 6, life: 2.2, owner: this, power: m.power, color: col, wallStop: true, dmgType: m.dmg || 'physical', status: m.status || null,
        ...(bd ? { kind: 'sprite', sprite: bolt, frames: [...Array(bd.frames).keys()].slice(1, -1), fps: 14, scale: 0.8 } : { kind: 'shard' }),
      });
    }
    g.audio.sfx('shoot');
    yield this.wind(m.recover || 0.5);
  },
  *pattern(m) {
    const g = this.game, p = g.player;
    this.pose = 'roar';
    g.audio.sfx('roar_small');
    const spots = [];
    if (m.layout === 'cross') {
      for (let arm = 0; arm < 4; arm++) {
        const a = this.facing + (arm * Math.PI) / 2 + (this.phase > 1 ? Math.PI / 4 : 0); // phase 2 turns the cross
        for (let i = 0; i < (m.count || 4); i++) spots.push({ x: this.x + Math.cos(a) * m.step * (i + 1), y: this.y + Math.sin(a) * m.step * (i + 1), d: i });
      }
      spots.push({ x: p.x, y: p.y, d: 1 }); // one on the player: standing still between the arms is not safe either
    } else if (m.layout === 'ring') {
      // a ring around the player with one gap: find it (or dodge through a circle at the right moment)
      const n = m.count || 10, gap = Math.floor(rand(0, n)), a0 = rand(0, TAU);
      for (let i = 0; i < n; i++) if (i !== gap) spots.push({ x: p.x + Math.cos(a0 + (i / n) * TAU) * m.dist, y: p.y + Math.sin(a0 + (i / n) * TAU) * m.dist, d: 0 });
      spots.push({ x: p.x, y: p.y, d: 0 });
    } else {
      for (let i = 0; i < (m.count || 6); i++) { const a = rand(0, TAU), r = rand(20, this.arenaR - 30); spots.push({ x: this.center.x + Math.cos(a) * r, y: this.center.y + Math.sin(a) * r, d: i * 0.5 }); }
      spots.push({ x: p.x, y: p.y, d: 0 });
    }
    let last = 0;
    for (const s of spots) {
      if (!this.inArena(s.x, s.y, 4)) continue;
      const total = this.wind(m.windup) + s.d * (m.delay || 0);
      last = Math.max(last, total);
      const tel = this.tele({ shape: 'circle', x: s.x, y: s.y, r: m.r, total }, m);
      tel.onResolve = () => {
        this.hit(tel, m);
        this.fx('eruption', s.x, s.y, 0, { scale: m.r / 34, life: 0.6 });
        this.mechHook('onImpact', { x: s.x, y: s.y, r: m.r, move: m });
        g.vfx.burst(s.x, s.y - 4, `rgb(${(m.color && !m.color.startsWith('#') && m.color) || '255,140,90'})`, 8, 90);
        g.vfx.ring(s.x, s.y, 4, m.r, { color: '255,210,170', life: 0.25 });
      };
    }
    yield last + 0.1;
    g.camera.shake(0.3);
    g.audio.sfx('shatter');
    yield this.wind(m.recover || 0.6);
    if (m.opening) this.enterWeak(m.opening, 'OPENING');
  },
  *nova(m) {
    const g = this.game;
    this.pose = 'roar';
    g.audio.sfx('roar_small');
    const rings = m.rings || 3, w = m.width || 60, gap = m.gap || 70;
    for (let i = 0; i < rings; i++) {
      const tel = this.tele({ shape: 'ring', x: this.x, y: this.y, r0: 24 + i * gap, r: 24 + i * gap + w, total: this.wind(m.windup) + i * 0.35 }, m);
      tel.onResolve = () => { this.hit(tel, m); g.vfx.ring(tel.x, tel.y, tel.r0, tel.r, { color: this.look.aura || '220,70,255', life: 0.3, width: 8 }); this.fx('nova', tel.x, tel.y, 0, { scale: tel.r / 42, life: 0.45, ground: true, squash: 0.6 }); };
    }
    yield this.wind(m.windup) + rings * 0.35 + 0.2;
    yield this.wind(m.recover || 0.6);
  },
  *summon(m) {
    const g = this.game;
    this.summons = this.summons.filter((s) => !s.dead); // forget fallen adds (no growing list)
    const n = Math.min(m.count || 1, (m.max || m.count || 1) - this.summons.length);
    if (n <= 0) return;
    this.pose = 'roar';
    g.audio.sfx('roar_small');
    g.ui.callout('WAR CRY', 'Adds join the fight', '#ffb080');
    const spots = [];
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), c = this.clampToArena(this.x + Math.cos(a) * 90, this.y + Math.sin(a) * 90, 30);
      const pos = g.world.map.findOpen(c.x, c.y, 3);
      spots.push(pos);
      this.tele({ shape: 'circle', x: pos.x, y: pos.y, r: 22, total: this.wind(m.windup), color: '255,190,120' }, m);
    }
    yield this.wind(m.windup);
    for (const s of spots) {
      const mon = new Monster(g, m.monster, s.x, s.y, { summoned: true, corrupted: !!m.corrupted, levelBand: shiftBand(this.def.level - (this.def.nativeLevel ?? this.def.level)) });
      mon.aggro = true; mon.setState('chase');
      g.world.monsters.push(mon);
      this.summons.push(mon);
      g.vfx.burst(s.x, s.y, '#ffb080', 16, 120);
    }
    yield this.wind(m.recover || 0.6);
  },
};

// ---------------- render (placeholder art: an existing monster sprite, scaled up, with a boss aura)
AreaBoss.prototype.draw = function draw(ctx) {
  const g = this.game, t = this.animT;
  if (!this.dead) for (const m of this.mech) if (m.draw) m.draw(ctx);
  const x = Math.round(this.x), y = Math.round(this.y);
  const alpha = this.dead ? Math.max(0, 1 - Math.max(0, this.deathT - 1.2)) : 1;
  if (alpha <= 0) return;
  // look.phaseStyle[phase] = { aura: 'r,g,b', glow: px, scale } — every phase reads differently at a glance
  const ps = (this.look.phaseStyle && this.look.phaseStyle[this.phase]) || {};
  const aura = ps.aura || this.look.aura || '255,120,120';
  // shadow + aura
  const sh = 1 - this.air / 200;
  ctx.fillStyle = `rgba(0,0,0,${0.4 * alpha})`;
  ctx.beginPath(); ctx.ellipse(x, y, this.radius * 1.5 * sh, this.radius * 0.55 * sh, 0, 0, TAU); ctx.fill();
  if (!this.dead && this.state !== 'dormant') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${aura},${(ps.glow ? 0.26 : 0.16) + 0.08 * Math.sin(t * 4)})`;
    ctx.beginPath(); ctx.ellipse(x, y, this.radius * (ps.glow ? 2.6 : 2.1), this.radius * (ps.glow ? 1 : 0.8), 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  const shake = this.pose === 'roar' || (this.pose === 'windup' && this.state === 'fight') ? Math.sin(t * 70) * 1.2 : 0;
  ctx.translate(x + shake, y - this.air);
  if (Math.cos(this.facing) < 0) ctx.scale(-1, 1);
  if (this.dead && !(this.sprites && this.sprites.sheet)) ctx.rotate(Math.min(1, this.deathT * 2) * 0.35);
  const s = this.sprites;
  if (s && s.sheet) {
    const fr = this.sheetFrame(s);
    const sc = this.scale * (ps.scale || 1), w = s.w * sc, h = s.h * sc, ax = s.ax * sc, ay = s.ay * sc;
    if (this.state === 'dormant') ctx.filter = 'brightness(0.75)';
    else if (ps.glow && !this.dead) ctx.filter = `drop-shadow(0 0 ${ps.glow}px rgb(${aura}))`;
    ctx.drawImage(fr, -ax, -ay, w, h);
    ctx.filter = 'none';
    if (this.flash > 0 && !this.dead) { ctx.globalAlpha = Math.min(1, this.flash * 10); ctx.drawImage(flashOf(fr), -ax, -ay, w, h); }
    // the transformation: the body pulses white while it changes form
    if (this.state === 'transition' && !this.dead) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.35 * Math.sin(g.time * 18); ctx.drawImage(flashOf(fr), -ax, -ay, w, h); ctx.globalCompositeOperation = 'source-over'; }
    if (this.status.has('vulnerable') && !this.dead) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(g.time * 14);
      ctx.drawImage(flashOf(fr), -ax, -ay, w, h);
    }
  } else if (s) {
    const set = s;
    const fr = this.pose === 'walk' ? set.move[Math.floor(t * 10) % set.move.length]
      : this.pose === 'windup' || this.pose === 'roar' ? set.windup[0]
        : this.pose === 'attack' ? set.attack[0]
          : this.pose === 'hurt' ? set.hurt[0] : set.idle[Math.floor(t * 2) % set.idle.length];
    const sc = this.scale, w = s.w * sc, h = s.h * sc, ax = s.ax * sc, ay = s.ay * sc;
    if (this.state === 'dormant') ctx.filter = 'brightness(0.75)';
    ctx.drawImage(fr, -ax, -ay, w, h);
    ctx.filter = 'none';
    if (this.flash > 0 || this.dead) { ctx.globalAlpha = this.dead ? Math.max(0, 0.8 - this.deathT * 1.5) : Math.min(1, this.flash * 10); ctx.drawImage(flashOf(fr), -ax, -ay, w, h); }
    if (this.status.has('vulnerable') && !this.dead) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(g.time * 14);
      ctx.drawImage(flashOf(fr), -ax, -ay, w, h);
    }
  } else {
    // no sprite: simple placeholder body (canvas shapes)
    const r = this.radius;
    ctx.fillStyle = '#3a3040'; ctx.beginPath(); ctx.ellipse(0, -r, r * 1.2, r, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgb(${aura})`; ctx.fillRect(r * 0.4, -r * 1.3, 4, 3);
  }
  ctx.restore();
  // phase 2+: a pulsing crown of the aura colour over the head
  if (!this.dead && this.phase > 1) {
    const hy = y - this.air - (this.sprites ? this.sprites.ay * this.scale : this.radius * 2) - 6;
    ctx.fillStyle = `rgba(${aura},${0.5 + 0.3 * Math.sin(t * 6)})`;
    for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 6 - 1, hy - 4 + Math.abs(i) * 2, 3, 6);
  }
  if (this.state === 'dormant' && !this.dead) {
    ctx.fillStyle = 'rgba(255,230,200,0.8)'; ctx.font = '8px monospace';
    const zz = Math.floor(t * 1.5) % 3;
    ctx.fillText('z'.repeat(zz + 1), x + 26, y - this.height * this.scale * 0.6 - zz * 3);
  }
};
// sheet art (data/monsterArt.js): which animation a pose plays. Order: the current move's `anim` { pose: anim },
// then the phase's look.phaseAnims[phase] { pose: anim }, then look.anims { pose: anim }, then the pose name itself.
// idle / walk loop; the other poses play once from the moment the pose began (the last frame holds).
const DEFAULT_POSE_ANIM = { idle: 'idle', walk: 'move', windup: 'windup', attack: 'attack', hurt: 'hurt', roar: 'windup' };
AreaBoss.prototype.sheetFrame = function sheetFrame(set) {
  if (this.pose !== this.lastPose) { this.lastPose = this.pose; this.poseT0 = this.animT; }
  const look = this.look, A = set.anims;
  if (this.dead) { const d = set.death || set.hurt; return frameAt(d, this.deathT, d.length / 1.4, false); }
  const pick = (o) => o && o[this.pose] && A[o[this.pose]] ? o[this.pose] : null;
  let mechAnim = null;
  for (const x of this.mech) { const n = x.poseAnim && x.poseAnim(this.pose); if (n && A[n]) { mechAnim = n; break; } }
  const name = pick(this.curMove && this.curMove.anim) || mechAnim || pick(look.phaseAnims && look.phaseAnims[this.phase]) || pick(look.anims) || DEFAULT_POSE_ANIM[this.pose];
  const frames = A[name] || set.idle;
  const loop = this.pose === 'idle' || this.pose === 'walk';
  const fps = (set.fps && set.fps[name]) || (loop ? (this.pose === 'walk' ? 9 : 6) : this.pose === 'attack' ? 12 : 8);
  return frameAt(frames, loop ? this.animT : this.animT - (this.poseT0 || 0), fps, loop);
};

export const MOVE_KINDS = Object.keys(KINDS); // valid `kind` values (checked by tools/tests/boss.test.mjs)
