import { Poise } from '../combat/poiseSystem.js';
import { ANTI_TANK } from '../data/antiTank.js';
import { Entity } from '../core/entity.js';
import { TEAM } from '../core/constants.js';
import { angleTo, dir4, damp, clamp, rand, TAU, easeOutCubic } from '../core/math.js';
import { DODGE, isPerfectDodge } from '../data/dodge.js';
import { CHARACTER } from './characterConfig.js';
import { ResourcePool } from '../combat/resourceSystem.js';
import { RESOURCES } from '../data/resources.js';
import { SkillSystem } from '../combat/skillSystem.js';
import { MARKS } from '../data/marks.js';
import { Loadout } from './loadout.js';
import { evaluateBlock } from '../combat/guardSystem.js';
import { LEVELS } from '../data/levels.js';
import { STAMINA } from '../data/stamina.js';
import { expToNext, addExp, normalize as normalizeExp, levelStats } from '../progression/experience.js';

const WALK_MUL = 1.08; // Combat 2.0: sprint removed, base walk a little faster to compensate
const HURT_IFRAMES = 0.55;

export class Player extends Entity {
  constructor(game, classDef, sprites) {
    super(0, 0);
    this.game = game;
    this.cls = classDef;
    this.sprites = sprites;
    this.team = TEAM.PLAYER;
    this.radius = CHARACTER.collisionRadius; // fixed feet collision, independent of animation
    this.hurtRadius = CHARACTER.hurtRadius;
    this.height = CHARACTER.bodyHeight;
    this.id = 'player'; // single local player for now; a server would assign ids
    this.level = LEVELS.start.level; this.exp = 0; this.gold = LEVELS.start.gold;
    // generic resource pool — the class only names its resources, the rules live in data/resources.js
    // + 'stamina' for everyone (Combat 2.0 decision resource: dodge / guard / some skills — data/stamina.js)
    this.resources = new ResourcePool([...(classDef.resources || [classDef.resource]), STAMINA.resource], RESOURCES, {
      stats: () => this.stats,
      onChange: (e) => game.events && game.events.emit('resourceChanged', { entity: this, ...e }),
    });
    // class mark lives in the generic MarkSystem (game.marks); `marks` below is a convenience alias
    this.markId = classDef.mark || null;
    this.markPulse = 0;
    // generic skill pipeline: checks, costs, cooldowns and failure reasons live in combat/skillSystem.js
    this.skillSys = new SkillSystem(this, [...classDef.skills, classDef.special].filter(Boolean), {
      onUsed: (e) => game.events && game.events.emit('skillUsed', e),
      onFailed: (e) => game.events && game.events.emit('skillFailed', e),
    });
    // which skills sit on keys 1-4 (key 5 = ultimate) — chosen in the Skills tab, saved with the character
    this.loadout = new Loadout(classDef);
    // class passives listen to core events (markTriggered, threadTouched, ...) — no class checks in the core
    this.unsubs = Object.entries(classDef.on || {}).map(([name, fn]) => game.events.on(name, (e) => fn(this, game, e)));
    this.mods = {};
    this.stats = { ...classDef.base };
    this.action = null;
    this.combo = 0; this.comboTimer = 0;
    this.dodging = false; this.dodgeReadyAt = -9; this.dodgeStart = -9; this.dodgeOrigin = null; this.dodgeAng = 0; this.dodgeT = 0;
    this.invulnT = 0; this.hurtT = 0;
    this.guardState = { active: false, since: -9, releasedAt: -9 }; // Guard System (classes with guard data)
    this.perfectCooldown = 0;
    this.poise = new Poise(ANTI_TANK.poise.max, ANTI_TANK.poise); // Combat 2.0 anti-tanking (data/antiTank.js)
    this.anim = 'idle'; this.animT = 0;
    this.aim = 0; this.facing = Math.PI / 2;
    this.moving = false;
    this.deathT = 0;
    this.stepT = 0;
    this.lastHitTime = -99;
    this.recomputeStats();
    this.hp = this.maxHp;
  }

  // ---------------- stats / progression
  recomputeStats() {
    const c = this.cls;
    const s = { ...c.base }; // class base = level 1
    for (const [k, v] of Object.entries(levelStats(c.perLevel, this.level))) s[k] = (s[k] || 0) + v;
    const mods = {};
    const eq = this.game.equipment;
    if (eq) eq.applyTo(s, mods);
    if (this.game.world && this.game.world.state.flags.moonBlessing) { s.crit += 0.05; s.shadowGain += 0.1; }
    // resource tiers (data/resources.js "tiers"): e.g. a high Nightfall Gauge adds shadow damage / crit
    if (this.resources) for (const [k, v] of Object.entries(this.resources.tierStats())) s[k] = (s[k] || 0) + v;
    this.resTier = this.resources ? this.resources.tier(this.primaryResource) : -1;
    this.stats = s;
    this.mods = mods;
    const maxHp = Math.round(s.hp);
    if (maxHp !== this.maxHp) { // keep the HP ratio when max HP changes (level, gear); otherwise HP is untouched
      const ratio = this.maxHp ? this.hp / this.maxHp : 1;
      this.maxHp = maxHp;
      this.hp = Math.min(this.maxHp, Math.round(this.maxHp * ratio));
    }
  }
  get classId() { return this.cls.id; }
  // every heal goes through here: clamped to max HP, reported as 'healed' (UI shows +N HP)
  heal(amount, source = null) {
    if (this.dead || !(amount > 0)) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const healed = Math.round(this.hp - before);
    if (healed > 0 && this.game.events) this.game.events.emit('healed', { entity: this, amount: healed, source });
    return healed;
  }
  // ---------------- gold (never negative; 'goldChanged' for the UI / quests / a future server)
  addGold(n) {
    n = Math.floor(n);
    if (!(n > 0)) return 0;
    this.gold += n;
    if (this.game.events) this.game.events.emit('goldChanged', { entity: this, amount: n, gold: this.gold });
    return n;
  }
  canAfford(n) { return n >= 0 && this.gold >= n; }
  removeGold(n) {
    n = Math.floor(n);
    if (!(n >= 0) || !this.canAfford(n)) return false;
    this.gold -= n;
    if (this.game.events) this.game.events.emit('goldChanged', { entity: this, amount: -n, gold: this.gold });
    return true;
  }
  get isMaxLevel() { return this.level >= LEVELS.maxLevel; }
  expToNext() { return expToNext(this.level); }
  // level + EXP from a save / class change / test; repaired to a valid state (level range, exp < next)
  setLevel(level, exp = 0) {
    const s = normalizeExp(level, exp);
    this.level = s.level; this.exp = s.exp;
    this.recomputeStats();
  }
  // rules in data/levels.js + progression/experience.js; feedback is the UI's job (listens to 'levelUp')
  gainExp(n) {
    if (!(n > 0) || this.isMaxLevel) return;
    const from = this.level;
    const s = addExp(this.level, this.exp, n);
    this.level = s.level; this.exp = s.exp;
    const ev = this.game.events;
    if (ev) ev.emit('expGained', { entity: this, amount: n, level: this.level, exp: this.exp });
    if (!s.levelsGained) return;
    this.recomputeStats();
    const lu = LEVELS.levelUp;
    if (lu.restoreHp) this.hp = this.maxHp;
    for (const rid in this.resources.defs) {
      const d = this.resources.defs[rid];
      if (lu.resource === 'max') this.resources.set(rid, this.resources.max(rid), 'levelUp');
      else if (lu.resource === 'respawn') this.resources.set(rid, Math.max(this.resources.get(rid), d.respawn ?? d.start ?? 0), 'levelUp');
    }
    if (ev) ev.emit('levelUp', { entity: this, from, level: this.level });
  }

  // ---------------- resources
  // primary-resource aliases (kept so older code, the HUD and v1 saves keep working)
  get primaryResource() { return this.cls.resource; }
  get shadow() { return this.resources.get(this.primaryResource); }
  set shadow(v) { this.resources.set(this.primaryResource, v); }
  get maxShadow() { return this.resources.max(this.primaryResource); }
  gainShadow(n, raw = false) { this.resources.gain(this.primaryResource, n, { raw }); }
  gainResource(n, raw = false) { this.resources.gain(this.primaryResource, n, { raw }); } // class-neutral name
  // threads this player has woven (ThreadSystem) — read by skill requirements and the HUD
  get threadCount() { return this.game.threads ? this.game.threads.count(this) : 0; }
  // foes within range carrying a mark (any class's enemy mark) — read by 'markedFoe' skill requirements
  markedFoes(markId, range = Infinity) {
    const g = this.game;
    if (!g.marks || !g.world) return [];
    return g.world.hostiles().filter((m) => !m.dead && !m.isBreakable && g.marks.get(m, markId) > 0 && Math.hypot(m.x - this.x, m.y - this.y) <= range);
  }
  // movement trail in the class VFX theme (shadow smoke / stardust)
  trailFx(n) {
    const g = this.game, th = this.cls.theme || {};
    if (th.trail === 'stardust') for (let i = 0; i < n; i++) g.vfx.particle(this.x + rand(-6, 6), this.y - rand(0, 30), { color: th.color, life: 0.4, size: 2, vy: -20, drag: 3, add: true });
    else g.vfx.shadowSmoke(this.x, this.y, n);
  }
  // ---------------- marks (stacks stored in game.marks — see combat/markSystem.js)
  markCount(id) { return this.game.marks ? this.game.marks.get(this, id) : 0; }
  get marks() { return this.markId ? this.markCount(this.markId) : 0; }
  set marks(v) { // used by respawn / tests: set the class mark to an exact stack count
    if (!this.markId || !this.game.marks) return;
    this.game.marks.consume(this, this.markId);
    const n = Math.max(0, Math.min(this.maxMarks, Math.floor(v) || 0));
    if (n) this.game.marks.apply(this, this.markId, { source: this, stacks: n, sourceClass: this.cls.id });
  }
  get maxMarks() { return this.markId ? MARKS[this.markId].maxStacks : 0; }
  addMark(n = 1) {
    if (!this.markId) return;
    const r = this.game.marks.apply(this, this.markId, { source: this, stacks: n, sourceClass: this.cls.id });
    if (r.added > 0) {
      this.markPulse = 1;
      const g = this.game, hc = this.cls.hudCounter ? this.cls.hudCounter(this) : null, full = this.marks >= this.maxMarks;
      g.audio.sfx(full ? 'mark_full' : 'mark');
      g.vfx.burst(this.x, this.y - 64, (hc && hc.color) || '#c080ff', 8, 50);
      if (full) {
        // Combat 2.0 §55: the last mark lands with a beat — short freeze, a pulse, the ready call (class text)
        g.hitStop = Math.max(g.hitStop, 0.05);
        if (hc && hc.readyText) g.vfx.text(this.x, this.y - 78, hc.readyText, { color: hc.full || '#e8c0ff', size: 10, life: 1.4 });
        g.vfx.ring(this.x, this.y, 36, 6, { life: 0.3, color: '200,120,255', width: 3 });
        g.events.emit('marksFull', { player: this, mark: this.markId });
      }
    }
  }
  consumeMarks(n) { return this.markId ? this.game.marks.consume(this, this.markId, n) : 0; }
  reduceCooldowns(sec) { this.skillSys.cooldowns.reduceAll(sec); }

  // class change: detach this character's class from the world (passive listeners, guard, action)
  dispose() {
    for (const off of this.unsubs || []) off();
    this.unsubs = [];
    if (this.guardState.active) this.setGuard(false);
    this.endAction(true);
    this.disposed = true;
  }

  // ---------------- guard (combat/guardSystem.js; rules in the class data: guard {...})
  setGuard(on) {
    const g = this.game, st = this.guardState, gd = this.cls.guard;
    if (!gd) return false;
    if (on && !st.active) {
      if (this.dead || this.hurtT > 0 || this.dodging || !this.status.canAct()) return false;
      if (g.time - st.releasedAt < (gd.recover || 0)) return false; // no perfect-guard spamming
      if (this.action && this.action.t < (this.action.cancelAt ?? 0)) return false;
      if (!this.resources.spend(STAMINA.resource, STAMINA.guardRaise, 'guard')) return false; // too tired to guard
      this.endAction(true);
      st.active = true; st.since = g.time;
      g.events.emit('guardStarted', { player: this });
      return true;
    }
    if (!on && st.active) {
      st.active = false; st.releasedAt = g.time;
      g.events.emit('guardEnded', { player: this });
    }
    return false;
  }
  // guard stamina: when it runs out the guard drops (full Guard Break / Poise = Combat 2.0 phase C4)
  drainGuard(amount, src = null) {
    const r = STAMINA.resource;
    this.resources.drain(r, amount, 'guard');
    if (this.guardState.active && this.resources.get(r) <= 0) this.guardBreak(src, 'stamina');
  }
  // GUARD BREAK: guard drops, a short stun, stamina lost (data/stamina.js guardBreak)
  guardBreak(src = null, reason = 'heavy') {
    const g = this.game, gb = STAMINA.guardBreak;
    this.setGuard(false);
    this.resources.drain(STAMINA.resource, gb.staminaLoss, 'guardBreak');
    this.status.add('guard_broken', gb.stun);
    g.vfx.text(this.x, this.y - 72, 'GUARD BREAK', { color: '#ff9a80', size: 13, life: 1.1 });
    g.camera.shake(0.3);
    g.audio.sfx('crash');
    g.events.emit('guardBroken', { player: this, source: src, reason });
  }
  // called by combat.dealDamage for every incoming hit
  tryBlock(src, opts = {}) {
    if (!this.cls.guard || !this.guardState.active || this.dead || opts.unblockable) return null; // unblockable: dodge it
    const res = evaluateBlock(this.cls.guard, this.guardState, this.aim, src.x - this.x, src.y - this.y, this.game.time);
    // a guardBreak attack smashes a normal block (a parry still beats it): part of the hit goes through
    if (res && !res.perfect && opts.guardBreak) return { ...res, guardBreak: true, mult: Math.max(res.mult, STAMINA.guardBreak.damageTaken) };
    return res;
  }
  onBlock(res, src, opts, ang, raw = 0) {
    const g = this.game, fx = this.x + Math.cos(this.aim) * 16, fy = this.y - 16 + Math.sin(this.aim) * 16;
    if (res.perfect) {
      this.resources.gain(STAMINA.resource, STAMINA.parryRefund, { raw: true, reason: 'parry' });
      g.events.emit('perfectGuard', { player: this, source: src });
      g.vfx.text(this.x, this.y - 72, 'PERFECT GUARD', { color: '#fff0b0', size: 13, life: 1.2 });
      g.audio.sfx('perfect_guard');
      g.slowMo(0.25, 0.4);
      g.camera.punch(0.08);
      this.setGuard(false);
      if (this.cls.onPerfectGuard) this.cls.onPerfectGuard(this, g, src);
    } else {
      g.events.emit('guardBlocked', { player: this, source: src });
      g.audio.sfx('block');
      g.vfx.text(fx, fy - 20, 'BLOCK', { color: '#ffe8a0', size: 9 });
      g.camera.shake(0.12);
      if (this.cls.onGuardBlock) this.cls.onGuardBlock(this, g, src);
      if (res.guardBreak) this.guardBreak(src, 'heavy');
      else this.drainGuard(clamp(raw * STAMINA.blockPerDamage, STAMINA.blockMin, STAMINA.blockMax), src);
    }
    if (this.cls.guard.fx) g.vfx.sprite(this.cls.guard.fx, fx, fy, 0, { scale: res.perfect ? 0.9 : 0.55, life: 0.25, glow: 0.5 });
  }

  // ---------------- defense
  invulnerable() {
    return this.invulnT > 0 || this.dodging || this.downed || (this.action && this.action.invuln && this.action.t >= this.action.invuln[0] && this.action.t <= this.action.invuln[1]);
  }
  canPerfect() {
    return isPerfectDodge(this.game.time, this.dodgeStart, this.perfectCooldown, this.mods.perfectWindow || 0);
  }
  onPerfectDodge(attacker) {
    const g = this.game;
    this.perfectCooldown = DODGE.perfectCooldown;
    g.slowMo(DODGE.slowMo[0], DODGE.slowMo[1]);
    g.vfx.flash('150,60,255', 0.35, 3);
    g.vfx.text(this.x, this.y - 70, 'PERFECT DODGE', { color: '#f2d8ff', size: 13, life: 1.3 });
    g.vfx.ring(this.x, this.y, 8, 70, { life: 0.4, color: '200,120,255', width: 3 });
    g.vfx.burst(this.x, this.y - 20, '#c080ff', 22, 150);
    g.camera.punch(0.08);
    g.audio.sfx('perfect');
    // rewards = class data (data/dodge.js explains the fields); the class hook adds anything special
    const r = this.cls.perfectDodge || DODGE.perfectDefault;
    if (r.marks && this.addMark) this.addMark(r.marks);
    if (r.resource) this.gainResource(r.resource, true);
    if (r.stamina) this.resources.gain(STAMINA.resource, r.stamina, { raw: true, reason: 'perfectDodge' });
    if (r.cooldownCut) this.reduceCooldowns(r.cooldownCut);
    for (const s of r.statuses || []) this.status.add(s.id, s.dur, { refresh: true, ...(s.mult ? { mult: s.mult } : {}) });
    if (this.cls.onPerfectDodge) this.cls.onPerfectDodge(this, g, attacker);
    if (this.mods.perfectHeal) this.heal(this.maxHp * 0.05, 'perfectHeal');
    g.events.emit('perfectDodge', attacker);
  }
  onHurt(amount, src, opts, ang) {
    const g = this.game;
    this.invulnT = HURT_IFRAMES;
    this.lastHitTime = g.time;
    g.camera.shake(0.28);
    g.vfx.flash('255,40,40', 0.18, 5);
    g.hitStop = Math.max(g.hitStop, 0.06);
    if (!(this.action && this.action.superArmor)) {
      this.endAction(true);
      this.hurtT = 0.2;
    }
    // POISE: hits in a row break it -> STAGGERED + EXPOSED (a single hit never does — data/antiTank.js)
    const at = ANTI_TANK, hp = at.hitPoise;
    const pd = clamp((amount / Math.max(1, this.maxHp)) * hp.perHpShare, hp.min, hp.max) + (opts && (opts.guardBreak || opts.heavy) ? at.heavyBonus : 0);
    if (this.poise.hit(pd, { canBreak: !(this.action && this.action.superArmor) })) this.onStaggered(src, ang);
  }
  onStaggered(src, ang) {
    const g = this.game, at = ANTI_TANK;
    this.endAction(true); this.setGuard(false);
    this.status.add('staggered', at.staggerTime);
    this.status.add('exposed', at.exposedTime);
    if (ang !== undefined) { this.kx = (this.kx || 0) + Math.cos(ang) * at.knock; this.ky = (this.ky || 0) + Math.sin(ang) * at.knock; }
    g.vfx.text(this.x, this.y - 74, 'STAGGERED', { color: '#ff9a80', size: 12, life: 1 });
    g.camera.shake(0.4);
    g.events.emit('playerStaggered', { player: this, source: src });
  }
  // ENDURE (data/antiTank.js): a hit taken while healthy never kills outright
  endure(amount) {
    if (this.hp >= this.maxHp * ANTI_TANK.endure.fromHp && amount >= this.hp) return this.hp - 1;
    return amount;
  }
  onDeath() {
    this.guardState.active = false;
    this.deathT = 0;
    this.endAction(true);
    this.dodging = false;
    this.game.onPlayerDeath(this); // party: downed (revivable) or defeated -> sets dead / downed
  }

  // ---------------- actions
  startAction(act) {
    if (this.action) this.endAction(true);
    act.t = 0;
    act.events = (act.events || []).map(([t, fn]) => ({ t, fn, done: false }));
    act.ghostT = 0;
    this.action = act;
    this.facing = act.ang ?? this.facing;
    if (act.start) act.start();
  }
  endAction(interrupted = false) {
    const a = this.action;
    if (!a) return;
    this.action = null;
    if (a.end) a.end(interrupted);
  }

  beginDodge(ang, fromSkill = false) {
    this.dodging = true;
    this.dodgeStart = this.game.time;
    this.dodgeOrigin = { x: this.x, y: this.y };
    this.dodgeAng = ang;
    this.dodgeT = 0;
    this.dodgeFromSkill = fromSkill;
    this.dodgeReadyAt = this.game.time + (fromSkill ? 0 : DODGE.time + DODGE.recovery);
  }

  tryDodge() {
    if (this.hurtT > 0 || !this.status.canMove()) return false;
    if (this.dodging || this.game.time < this.dodgeReadyAt) return false; // one dash at a time + small recovery
    if (this.action && this.action.t < (this.action.cancelAt ?? 0)) return false;
    const cost = this.dodgeCost();
    if (!this.resources.canAfford(STAMINA.resource, cost)) { this.game.events.emit('staminaEmpty', { entity: this, action: 'dodge' }); return false; }
    const g = this.game, mv = g.input.moveVector();
    const ang = mv.x || mv.y ? Math.atan2(mv.y, mv.x) : this.aim;
    this.endAction(true);
    this.resources.spend(STAMINA.resource, cost, 'dodge');
    this.beginDodge(ang);
    g.events.emit('playerDodged', { player: this });
    this.facing = ang;
    g.audio.sfx('dodge');
    this.trailFx(5);
    return true;
  }

  // stamina per dodge: data/stamina.js, cut by the stat `dodgeCostCut` (e.g. a resource tier, max 60%)
  // and the status modifier `dodgeCostMult` (e.g. an overdrive buff)
  dodgeCost() {
    const cut = clamp(this.stats.dodgeCostCut || 0, 0, 0.6);
    return STAMINA.dodge * (1 - cut) * this.status.modifier('dodgeCostMult');
  }
  // basic-attack speed: stat `attackSpeed` (+0.2 = 20% faster) × status modifier `attackSpeedMult`
  attackSpeed() { return Math.max(0.5, (1 + (this.stats.attackSpeed || 0)) * this.status.modifier('attackSpeedMult')); }

  // --- caster interface used by the generic SkillSystem ---
  // Caster-state rules only (the pipeline handles cooldown / cost / requirements).
  canAct(skill) {
    if (this.dead || this.hurtT > 0 || !this.status.canAct()) return false;
    if (this.action && !this.action.basic && this.action.t < (this.action.cancelAt ?? 0)) return false;
    if (!this.dodgeFromSkill && (this.dodging || this.game.time < this.dodgeReadyAt)) return false; // dash + small recovery (data/dodge.js)
    return true;
  }
  beforeCast() { this.dodging = false; if (this.guardState.active) this.setGuard(false); }

  trySkill(skill) {
    const r = this.skillSys.use(skill.id, this, this.game, this.aim);
    if (r.ok && r.result) this.startAction(r.result); // some skills (a held guard) have no action timeline
    return r.ok;
  }
  tryBreak() { return this.trySkill(this.cls.special); }
  // change which skill sits on key i+1 (Skills tab). Not allowed mid-fight.
  setSkillSlot(i, id) {
    const g = this.game;
    if (g.combat.inCombat) { g.ui.toast('Cannot change skills in combat', 1); g.audio.sfx('deny'); return false; }
    if (!this.loadout.assign(i, id)) return false;
    g.events.emit('loadoutChanged', { player: this, slots: this.loadout.serialize() });
    g.audio.sfx('equip');
    g.save.dirty = true;
    return true;
  }

  tryAttack() {
    if (this.hurtT > 0 || this.dodging || this.game.time < this.dodgeReadyAt || this.guardState.active || !this.status.canAct()) return false;
    const a = this.action;
    if (a) {
      if (!a.basic || a.t < a.comboAt) return false;
    }
    const step = a && a.basic ? (a.step + 1) % 3 : this.comboTimer > 0 ? this.combo : 0;
    this.combo = (step + 1) % 3;
    this.comboTimer = 0.55;
    this.startAction(this.cls.basic(this, this.game, this.aim, step));
    return true;
  }

  // ---------------- update
  update(dt) {
    const g = this.game, input = g.input, map = g.world.map;
    this.status.update(dt);
    // stealth blend 0..1 (status flag 'stealth') — fades smoothly so entering / leaving is readable
    this.stealthK = damp(this.stealthK || 0, this.status.flag('stealth') ? 1 : 0, 10, dt);
    this.flash = Math.max(0, this.flash - dt);
    this.markPulse = Math.max(0, this.markPulse - dt * 2);
    if (this.dead) { this.deathT += dt; return; }
    if (this.downed) { this.vx = this.vy = 0; this.moving = false; return; } // waits for a teammate (party/partySystem.js)

    this.invulnT = Math.max(0, this.invulnT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.perfectCooldown = Math.max(0, this.perfectCooldown - dt);
    this.poise.update(dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    this.skillSys.update(dt);
    this.resources.update(dt, { inCombat: g.combat.inCombat });
    // resource tier crossed (data tiers): refresh stats and tell the class / HUD
    const tier = this.resources.tier(this.primaryResource);
    if (tier !== this.resTier) {
      const before = this.resTier;
      this.recomputeStats();
      g.events.emit('resourceTier', { entity: this, resource: this.primaryResource, tier, before, def: this.resources.tierDef(this.primaryResource) });
    }
    if (this.guardState.active) this.drainGuard(STAMINA.guardDrain * dt);
    // hp regen out of combat (resource regen and mark decay are handled by their systems)
    if (!g.combat.inCombat) {
      if (g.time - this.lastHitTime > 6 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.02 * dt);
    }

    // aim from mouse
    const mw = g.mouseWorld();
    this.aim = angleTo(this.x, this.y - 12, mw.x, mw.y);

    // ---- input (buffered)
    if (g.controlsEnabled()) {
      if (input.pressed('Space')) input.pushBuffer('dodge');
      if (input.mouse.leftPressed || (input.mouse.left && !this.action)) input.pushBuffer('attack');
      // classes with guard data HOLD Q / right-click to guard; the others tap it for their special
      if (this.cls.guard) this.setGuard(input.isDown('KeyQ') || input.isDown('ShiftLeft') || input.isDown('ShiftRight') || input.mouse.right);
      else if (input.pressed('KeyQ') || input.mouse.rightPressed) input.pushBuffer('break');
      for (let i = 1; i <= 5; i++) if (input.pressed('Digit' + i)) input.pushBuffer('skill' + i);
      if (input.pressed('KeyR')) g.inventory.quickUse('hp_potion');
      if (input.isDown('KeyE') && g.party) g.party.tryRevive(this, dt); // hold [E] next to a downed teammate
      if (input.pressed('KeyF')) g.inventory.quickUse('shadow_tonic');

      if (input.peek('dodge') && this.tryDodge()) input.consume('dodge');
      if (input.peek('break') && this.tryBreak()) input.consume('break');
      for (const b of this.loadout.bindings()) if (input.peek('skill' + b.key) && this.trySkill(b.skill)) input.consume('skill' + b.key);
      if (input.peek('attack') && this.tryAttack()) input.consume('attack');
    }

    // ---- movement
    const mv = g.controlsEnabled() ? input.moveVector() : { x: 0, y: 0 };
    let speed = this.stats.speed * this.status.moveMult() * WALK_MUL;
    let tvx = mv.x * speed, tvy = mv.y * speed;

    if (this.dodging) {
      this.dodgeT += dt;
      const dur = this.action && this.action.dash ? this.action.dur : DODGE.time;
      const dist = this.action && this.action.dash ? this.action.dash.dist : DODGE.dist;
      const f0 = easeOutCubic(Math.min(1, (this.dodgeT - dt) / dur)), f1 = easeOutCubic(Math.min(1, this.dodgeT / dur));
      const step = (f1 - f0) * dist;
      map.moveCircle(this, Math.cos(this.dodgeAng) * step, Math.sin(this.dodgeAng) * step);
      this.vx = this.vy = 0;
      if (Math.random() < 0.7) this.trailFx(1);
      this.stepGhost(dt, 0.035);
      if (this.dodgeT >= dur) { this.dodging = false; if (!this.dodgeFromSkill) this.invulnT = Math.max(this.invulnT, DODGE.iframes - dur); }
    } else if (this.hurtT > 0) {
      this.vx = damp(this.vx, 0, 10, dt); this.vy = damp(this.vy, 0, 10, dt);
    } else {
      if (this.action) { tvx *= this.action.moveMul ?? 0.4; tvy *= this.action.moveMul ?? 0.4; }
      else if (this.guardState.active) { tvx *= this.cls.guard.moveMul ?? 0.4; tvy *= this.cls.guard.moveMul ?? 0.4; }
      const accel = mv.x || mv.y ? 30 : 22; // quick start / quick stop, minimal inertia
      this.vx = damp(this.vx, tvx, accel, dt);
      this.vy = damp(this.vy, tvy, accel, dt);
      map.moveCircle(this, this.vx * dt, this.vy * dt);
    }
    this.applyKnockback(dt, map);
    this.moving = Math.hypot(this.vx, this.vy) > 20;
    // standing still (no move / action / dodge / guard): skirmishers punish it (data/enemyCombat.js)
    this.idleT = this.moving || this.action || this.dodging || this.guardState.active ? 0 : (this.idleT || 0) + dt;
    // class behaviour that runs every frame (e.g. Momentum draining while standing still) — optional hook
    if (this.cls.tick) this.cls.tick(this, g, dt);

    // ---- action timeline
    const a = this.action;
    if (a) {
      const prevT = a.t;
      a.t += a.basic ? dt * this.attackSpeed() : dt;
      if (a.lunge && a.t > a.lunge.t0 && prevT < a.lunge.t1) {
        const span = a.lunge.t1 - a.lunge.t0;
        const f = (Math.min(a.t, a.lunge.t1) - Math.max(prevT, a.lunge.t0)) / span;
        const ang = a.ang;
        // stop lunging into an enemy we're already touching
        const blocked = g.world.hostiles().some((m) => !m.dead && Math.hypot(m.x - this.x, m.y - this.y) < m.radius + this.radius + 4);
        if (!blocked) map.moveCircle(this, Math.cos(ang) * a.lunge.dist * f, Math.sin(ang) * a.lunge.dist * f);
      }
      if (a.ghostEvery) this.stepGhost(dt, a.ghostEvery);
      if (a.update) a.update(a.t, dt);
      for (const ev of a.events) if (!ev.done && a.t >= ev.t) { ev.done = true; ev.fn(); }
      if (a.t >= a.dur) this.endAction();
      this.facing = a.ang ?? this.facing;
    } else if (this.dodging) {
      this.facing = this.dodgeAng;
    } else if (this.guardState.active) {
      this.facing = this.aim; // the guard faces the mouse
    } else if (this.moving) {
      this.facing = Math.atan2(this.vy, this.vx);
    }

    // ---- animation selection
    let anim, at;
    if (this.hurtT > 0) { anim = 'hurt'; at = 1 - this.hurtT / 0.2; }
    else if (this.action) { anim = this.action.anim; at = this.action.t / this.action.dur; }
    else if (this.dodging) { anim = 'dodge'; at = this.dodgeT / DODGE.time; }
    else if (this.guardState.active) { anim = 'guard'; at = 0; }
    else if (this.moving) { anim = 'walk'; at = this.animT; }
    else { anim = 'idle'; at = 0; }
    if (anim !== this.anim) { this.anim = anim; this.animT = 0; }
    this.animT += dt;
    this.animProgress = at;

    // footsteps
    if (this.moving && !this.dodging) {
      this.stepT += dt;
      if (this.stepT > 0.3) {
        this.stepT = 0;
        g.vfx.particle(this.x + rand(-4, 4), this.y, { color: 'rgba(120,110,100,0.6)', life: 0.35, size: 3, vy: -8, drag: 4 });
        g.audio.sfx('step');
      }
    }
    // stealthed: faint shadow wisps drifting off the body
    if (this.stealthK > 0.5 && Math.random() < 0.25) g.vfx.shadowSmoke(this.x + rand(-6, 6), this.y - rand(0, 20), 1, { vy: -25 });
    // idle aura while the class mark is full (colours from data/marks.js)
    if (this.markId && this.marks >= this.maxMarks && Math.random() < 0.35) {
      const a2 = rand(0, TAU);
      g.vfx.particle(this.x + Math.cos(a2) * 12, this.y - rand(0, 40), { color: MARKS[this.markId].display.color, vy: -30, life: 0.6, size: 2, add: true });
    }
  }

  stepGhost(dt, every) {
    this.ghostAcc = (this.ghostAcc || 0) + dt;
    if (this.ghostAcc >= every) {
      this.ghostAcc = 0;
      const f = this.currentFrame('ghost');
      this.game.vfx.ghost(f, this.x, this.y, { life: 0.28, alpha: 0.5 });
    }
  }

  currentFrame(variant = 'img') {
    const dir = dir4(this.facing);
    const ad = this.sprites.anims[this.anim];
    const t = ad && ad.loop ? this.animT : this.animProgress || 0; // looping anims (walk, run, breathing idle) run on time
    return this.sprites.frame(this.anim, t, dir, variant);
  }

  draw(ctx) {
    const g = this.game;
    // shadow
    const sk = this.stealthK || 0; // stealth: body fades to ~35%, shadow almost gone
    ctx.fillStyle = `rgba(0,0,0,${0.35 * (1 - sk * 0.7)})`;
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 12, 4.5, 0, 0, TAU); ctx.fill();
    if (this.markId && this.marks >= this.maxMarks) {
      ctx.fillStyle = MARKS[this.markId].display.color;
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(g.time * 8);
      ctx.beginPath(); ctx.ellipse(this.x, this.y, 18, 7, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    let y = this.y;
    if (this.dead) {
      const f = this.sprites.frame('death', Math.min(1, this.deathT / 0.6), dir4(this.facing));
      this.sprites.draw(ctx, f, this.x, y, Math.max(0.25, 1 - this.deathT * 0.4));
      return;
    }
    if (this.downed) { // party: lying on the ground, waiting for a revive (pulses so teammates spot it)
      this.sprites.draw(ctx, this.sprites.frame('death', 1, dir4(this.facing)), this.x, y, 0.75 + 0.2 * Math.sin(g.time * 4));
      return;
    }
    const f = this.currentFrame();
    // step bob (animation data 'bob'): 2 bounces per cycle, whole pixels only
    const ad = this.sprites.anims[this.anim];
    if (ad && ad.bob) y -= Math.round(Math.abs(Math.sin(this.animT * Math.PI * (ad.fps || 8) / 3)) * ad.bob);
    const flicker = this.invulnT > 0 && !this.dodging && Math.floor(g.time * 20) % 2 === 0;
    const bodyA = (flicker ? 0.45 : 1) * (1 - sk * (0.65 + 0.08 * Math.sin(g.time * 5)));
    this.sprites.draw(ctx, f, this.x, y, bodyA);
    if (sk > 0.05) {
      // shadow-tinted shimmer over the faded body (class ghost colour)
      ctx.globalCompositeOperation = 'lighter';
      this.sprites.draw(ctx, this.currentFrame('ghost'), this.x + Math.sin(g.time * 7) * 1.5, y, sk * (0.22 + 0.1 * Math.sin(g.time * 9)));
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.flash > 0) {
      const ff = this.currentFrame('flash');
      this.sprites.draw(ctx, ff, this.x, y, Math.min(1, this.flash * 8) * 0.8);
    }
    if (this.status.has('surge')) {
      ctx.globalCompositeOperation = 'lighter';
      this.sprites.draw(ctx, this.currentFrame('ghost'), this.x, y, 0.18 + 0.08 * Math.sin(g.time * 10));
      ctx.globalCompositeOperation = 'source-over';
    }
    // class mark stacks above the head (diamonds, colours from data/marks.js)
    if (this.markId && this.marks > 0) {
      const md = MARKS[this.markId].display, full = this.marks >= this.maxMarks;
      const top = this.y - 70 - this.markPulse * 4;
      for (let i = 0; i < this.maxMarks; i++) {
        const mx = this.x + (i - (this.maxMarks - 1) / 2) * 9;
        const on = i < this.marks;
        ctx.fillStyle = on ? (full ? md.full : md.color) : 'rgba(60,40,80,0.7)';
        ctx.beginPath();
        ctx.moveTo(mx, top - 4); ctx.lineTo(mx + 3.5, top); ctx.lineTo(mx, top + 4); ctx.lineTo(mx - 3.5, top); ctx.closePath();
        ctx.fill();
        if (on) { ctx.strokeStyle = '#1a0828'; ctx.lineWidth = 1; ctx.stroke(); }
      }
    }
  }
}
