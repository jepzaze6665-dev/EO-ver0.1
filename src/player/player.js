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
import { STATUSES } from '../data/statuses.js';
import { Assets } from '../core/assets.js';
import { Loadout } from './loadout.js';
import { levelMods, maxLevel, pointsEarned, pointsSpent, upgradeCheck } from '../progression/skillLevels.js';
import { masteryReward } from '../progression/masterySystem.js';
import { evolutionById, evolutionCheck, withEvolution, EVOLUTION_RULES } from '../progression/skillEvolution.js';
import { SKILL_TREE, skillUnlockCheck } from '../data/skillTree.js';
import { applySkillModifiers } from '../progression/skillModifiers.js';
import { CLASS_TREE } from '../data/classTree.js';
import { ActionRecorder } from '../combat/actionRecorder.js';
import { evaluateBlock } from '../combat/guardSystem.js';
import { LEVELS } from '../data/levels.js';
import { STAMINA } from '../data/stamina.js';
import { MAGIC_DAMAGE_TYPES, COUNTER_STATUS } from '../data/items/rules.js';
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
    // what this character just did (Record & Replay) — only for classes with `memory` rules (combat/actionRecorder.js)
    this.memory = classDef.memory ? new ActionRecorder(classDef.memory) : null;
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
  // total of one item modifier type from the gear loadout (data/items/rules.js MODIFIER_TYPES), 0 = none
  gearMod(type) { const eq = this.game.equipment; return eq && eq.getModifierValue ? eq.getModifierValue(type) : 0; }
  // GEAR hooks called by combat.dealDamage: damage taken × (1 - damageReduction); the pending next-hit bonus of an
  // item effect (nextHitBonus) is used up by the first real hit on a foe
  gearDamageTakenMult() { return 1 - this.gearMod('damageReduction'); }
  // outgoing: magicDamage (magic damage types), counterDamage (counter strikes / foes in a Counter Window), next-hit bonus
  gearHitMult(target, opts) {
    if (!target || target.team === this.team) return 1;
    let m = 1;
    if (MAGIC_DAMAGE_TYPES.includes(opts.type)) m *= 1 + this.gearMod('magicDamage');
    if (opts.counter || (target.status && target.status.has(COUNTER_STATUS))) m *= 1 + this.gearMod('counterDamage');
    const b = this.itemNextHit;
    if (b && !opts.itemEffect) { this.itemNextHit = null; if (this.game.time <= b.until) m *= b.mult; }
    return m;
  }
  // enemy targeting reads it (combat/targeting.js)
  get aggro() { return this.gearMod('aggro'); }
  // item modifiers on resources: resourceGeneration (every class resource) + the resource's own gearGain type
  // (data/resources.js, e.g. guardGeneration) -> gain; resourceCost -> cost. Stamina is never touched.
  syncGearResources() {
    if (!this.resources) return;
    const gen = this.gearMod('resourceGeneration'), cost = this.gearMod('resourceCost'), maxAdd = Math.round(this.gearMod('resourceMax'));
    for (const id of Object.keys(this.resources.defs)) {
      if (id === STAMINA.resource) continue;
      const d = this.resources.defs[id];
      const gain = (1 + gen) * (1 + (d.gearGain ? this.gearMod(d.gearGain) : 0));
      const set = (key, kind, v) => { const mid = 'gear_' + key + '_' + id; if (Math.abs(v - 1) < 1e-9) this.resources.removeModifier(mid); else this.resources.addModifier({ id: mid, resource: id, kind, value: v }); };
      set('gain', 'gainMult', Math.max(0, gain));
      set('cost', 'costMult', Math.max(0, 1 + cost));
      const mid = 'gear_max_' + id; // + points on the maximum (resourceMax)
      if (!maxAdd) this.resources.removeModifier(mid); else this.resources.addModifier({ id: mid, resource: id, kind: 'maxAdd', value: maxAdd });
    }
  }
  recomputeStats() {
    const c = this.cls;
    let s = { ...c.base }; // class base = level 1
    for (const [k, v] of Object.entries(levelStats(c.perLevel, this.level))) s[k] = (s[k] || 0) + v;
    const mods = {};
    const eq = this.game.equipment;
    if (eq) eq.applyTo(s, mods);
    if (this.game.world && this.game.world.state.flags.moonBlessing) { s.crit += 0.05; s.shadowGain += 0.1; }
    // ITEM MODIFIERS (gear loadout): a new stats object from the base above (base never edited); temporary buffs =
    // statuses, applied where they are read
    this.baseStats = s; // before item modifiers (the Loadout window shows base -> final)
    if (eq && eq.finalStats) s = eq.finalStats(s);
    this.syncGearResources();
    // resource tiers (data/resources.js "tiers"): e.g. a high Nightfall Gauge adds shadow damage / crit
    if (this.resources) for (const [k, v] of Object.entries(this.resources.tierStats())) { s[k] = (s[k] || 0) + v; if (this.baseStats !== s) this.baseStats[k] = (this.baseStats[k] || 0) + v; }
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
    if (this.classFollowsCharacter()) this.game.classProgress.syncLevel(this.cls.id, this.level, this.exp);
  }
  // ---------------- CLASS LEVEL (S5, data/skillTree.js): per class; a tier-1 class mirrors the character level
  classFollowsCharacter() {
    const node = CLASS_TREE[this.cls.id];
    return !!(this.game.classProgress && node && SKILL_TREE.followsCharacterTiers.includes(node.tier));
  }
  // the level that gives skill points / unlocks skills / gates skill levels (data/skillTree.js pointsFrom)
  progressLevel() { return SKILL_TREE.pointsFrom === 'class' ? this.classLevel() : this.level; }
  classLevel() {
    const cp = this.game.classProgress, c = cp && cp.classes[this.cls.id];
    return c ? c.level : 1;
  }
  skillUnlockCheck(skill) {
    return skillUnlockCheck(skill, {
      classLevel: this.progressLevel(), skill: (id) => this.skillSys.get(id),
      nameOf: (id) => (this.skillSys.get(id) || { name: id }).name,
    });
  }
  skillUnlocked(skill) { return this.skillUnlockCheck(skill).ok; }
  // rules in data/levels.js + progression/experience.js; feedback is the UI's job (listens to 'levelUp')
  gainExp(n) {
    if (!(n > 0) || this.isMaxLevel) return;
    const from = this.level;
    const s = addExp(this.level, this.exp, n);
    this.level = s.level; this.exp = s.exp;
    const ev = this.game.events;
    if (ev) ev.emit('expGained', { entity: this, amount: n, level: this.level, exp: this.exp });
    // class EXP for the active class ('classLevelUp'); a tier-1 class simply mirrors the character
    const cpr = this.game.classProgress;
    if (cpr) {
      const before = this.classLevel();
      if (this.classFollowsCharacter()) cpr.syncLevel(this.cls.id, s.level, s.exp); else cpr.addClassExp(this.cls.id, n);
      if (this.classLevel() > before && ev) ev.emit('classLevelUp', { entity: this, classId: this.cls.id, from: before, level: this.classLevel() });
    }
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
  get scriptCount() { return this.scripts ? this.scripts.length : 0; } // ground scripts a class wrote (Void Scribe) — requirement 'value'
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
    else if (th.color) { // smoke in the class colour: a dark and a mid shade of theme.color
      const v = parseInt(th.color.slice(1), 16), rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
      const shade = (k) => '#' + rgb.map((c) => Math.round(c * k).toString(16).padStart(2, '0')).join('');
      for (let i = 0; i < n; i++) g.vfx.shadowSmoke(this.x, this.y, 1, { color: i % 2 ? shade(0.25) : shade(0.6) });
    } else g.vfx.shadowSmoke(this.x, this.y, n);
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
  // ---------------- SKILL LEVELS (progression/skillLevels.js + game.classProgress). Skills of this class only.
  skillLevel(id) {
    const cp = this.game.classProgress, s = cp && cp.peekSkill(this.cls.id, id);
    return s ? s.level : 1;
  }
  skillMastery(id) {
    const cp = this.game.classProgress, s = cp && cp.peekSkill(this.cls.id, id);
    return s ? s.masteryLevel : 0;
  }
  // chosen evolution id of one of this class's skills (null = original)
  skillEvolution(id) {
    const cp = this.game.classProgress, s = cp && cp.peekSkill(this.cls.id, id);
    return (s && s.evolution) || null;
  }
  evolutionCheck(skillId, evoId) {
    const s = this.skillSys.get(skillId), g = this.game;
    if (!s) return { ok: false, reason: 'unknown', missing: [] };
    return evolutionCheck(s, evoId, {
      skillLevel: this.skillLevel(skillId), masteryLevel: this.skillMastery(skillId), charLevel: this.level,
      current: this.skillEvolution(skillId),
      hasFlag: (f) => !!(g.world && g.world.state.flags[f]), hasItem: (id) => !!(g.inventory && g.inventory.has(id)),
    });
  }
  // choose ONE evolution branch (event 'skillEvolved'). Not in combat.
  evolveSkill(skillId, evoId) {
    const g = this.game;
    if (g.combat && g.combat.inCombat) return { ok: false, reason: 'combat', missing: [] };
    const r = this.evolutionCheck(skillId, evoId);
    if (!r.ok) return r;
    g.classProgress.skill(this.cls.id, skillId).evolution = evoId;
    g.events.emit('skillEvolved', { player: this, skillId, evolution: evoId });
    g.save.dirty = true;
    return { ok: true };
  }
  // back to the original skill — only when the rules allow a respec (skillEvolution.js EVOLUTION_RULES.respec)
  revertEvolution(skillId) {
    const rule = EVOLUTION_RULES.respec, e = this.game.classProgress.peekSkill(this.cls.id, skillId);
    if (!rule.allowed) return { ok: false, reason: 'no_respec' };
    if (!e || !e.evolution) return { ok: false, reason: 'none' };
    if (rule.gold && !this.removeGold(rule.gold)) return { ok: false, reason: 'gold' };
    e.evolution = null;
    this.game.save.dirty = true;
    return { ok: true };
  }
  // skill level (data 'levels') + evolution (data 'evolutions') × mastery reward (data/skillMastery.js)
  skillMods(skill) {
    const m = withEvolution(levelMods(skill, this.skillLevel(skill.id)), evolutionById(skill, this.skillEvolution(skill.id)));
    const r = masteryReward(this.skillMastery(skill.id));
    // + equipment / rune modifiers (items.js skillModifiers, capped in skillModifiers.js)
    return applySkillModifiers({ ...m, cooldown: m.cooldown * r.cooldown, cost: m.cost * r.cost, skillId: skill.id }, this.mods && this.mods.skillModifiers, skill);
  }
  skillFlag(id, flag) { const s = this.skillSys.get(id); return !!(s && this.skillMods(s).flags[flag]); }
  skillValue(id, key, dflt) { const s = this.skillSys.get(id); const v = s && this.skillMods(s).values[key]; return v ?? dflt; }
  skillsById() { return Object.fromEntries(this.skillSys.list().map((s) => [s.id, s])); }
  skillPointsLeft() {
    const cp = this.game.classProgress;
    return pointsEarned(this.progressLevel()) - pointsSpent(cp && cp.classes[this.cls.id], this.skillsById());
  }
  upgradeCheck(id) {
    const s = this.skillSys.get(id);
    if (!s) return { ok: false, reason: 'unknown' };
    if (!this.skillUnlocked(s)) return { ok: false, reason: 'locked' };
    return upgradeCheck(s, this.skillLevel(id), this.progressLevel(), this.skillPointsLeft());
  }
  // spend skill points: Lv n -> n + 1 (event 'skillLevelUp')
  upgradeSkill(id) {
    const r = this.upgradeCheck(id);
    if (!r.ok) return r;
    const e = this.game.classProgress.skill(this.cls.id, id);
    e.level++;
    this.game.events.emit('skillLevelUp', { player: this, skillId: id, level: e.level, max: maxLevel(this.skillSys.get(id)) });
    this.game.save.dirty = true;
    return { ok: true, level: e.level };
  }
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
    // COUNTER STANCE: a skill action may open a counter window (action.counter = { from, to }, seconds into the
    // action). A hit inside it is parried like a Perfect Guard -> onBlock -> 'perfectGuard' + cls.onPerfectGuard.
    // Any direction; unblockable attacks still go through (dodge those). Outside the window: a normal hit.
    const a = this.action;
    if (a && a.counter && !opts.unblockable && !this.dead && a.t >= a.counter.from && a.t <= a.counter.to) return { perfect: true, mult: 0, counter: true };
    if (!this.cls.guard || !this.guardState.active || this.dead || opts.unblockable) return null; // unblockable: dodge it
    let res = evaluateBlock(this.cls.guard, this.guardState, this.aim, src.x - this.x, src.y - this.y, this.game.time);
    // status modifier guardBlockMult (e.g. FORTIFIED): a normal block lets even less through
    if (res && !res.perfect) res = { ...res, mult: res.mult * this.status.modifier('guardBlockMult') };
    // a guardBreak attack smashes a normal block (a parry still beats it): part of the hit goes through
    if (res && !res.perfect && opts.guardBreak) return { ...res, guardBreak: true, mult: Math.max(res.mult, STAMINA.guardBreak.damageTaken) };
    return res;
  }
  onBlock(res, src, opts, ang, raw = 0) {
    const g = this.game, fx = this.x + Math.cos(this.aim) * 16, fy = this.y - 16 + Math.sin(this.aim) * 16;
    if (res.perfect) {
      this.resources.gain(STAMINA.resource, STAMINA.parryRefund, { raw: true, reason: 'parry' });
      g.events.emit('perfectGuard', { player: this, source: src, blocked: raw });
      g.vfx.text(this.x, this.y - 72, this.cls.perfectGuardText || 'PERFECT GUARD', { color: '#fff0b0', size: 13, life: 1.2 });
      g.audio.sfx('perfect_guard');
      g.slowMo(0.25, 0.4);
      g.camera.punch(0.08);
      this.setGuard(false);
      if (this.cls.onPerfectGuard) this.cls.onPerfectGuard(this, g, src);
    } else {
      g.events.emit('guardBlocked', { player: this, source: src, blocked: Math.max(0, raw * (1 - res.mult)) });
      g.audio.sfx('block');
      g.vfx.text(fx, fy - 20, 'BLOCK', { color: '#ffe8a0', size: 9 });
      g.camera.shake(0.12);
      if (this.cls.onGuardBlock) this.cls.onGuardBlock(this, g, src);
      if (res.guardBreak) this.guardBreak(src, 'heavy');
      else this.drainGuard(clamp(raw * STAMINA.blockPerDamage, STAMINA.blockMin, STAMINA.blockMax), src);
    }
    if (this.cls.guard && this.cls.guard.fx) g.vfx.sprite(this.cls.guard.fx, fx, fy, 0, { scale: res.perfect ? 0.9 : 0.55, life: 0.25, glow: 0.5 });
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
    // colours = the class theme (data: theme.color), so every class flashes in its own colour
    const hex = (this.cls.theme && this.cls.theme.color) || '#c080ff';
    const n = parseInt(hex.slice(1), 16), rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const mix = (k) => rgb.map((v) => Math.round(v + (255 - v) * k)); // toward white
    g.vfx.flash(rgb.map((v) => Math.round(v * 0.7)).join(','), 0.35, 3);
    g.vfx.text(this.x, this.y - 70, 'PERFECT DODGE', { color: `rgb(${mix(0.75).join(',')})`, size: 13, life: 1.3 });
    g.vfx.ring(this.x, this.y, 8, 70, { life: 0.4, color: mix(0.25).join(','), width: 3 });
    g.vfx.burst(this.x, this.y - 20, hex, 22, 150);
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
    const steady = (this.action && this.action.superArmor) || this.status.flag('unshakable'); // holy ground / march
    if (!steady) {
      this.endAction(true);
      this.hurtT = 0.2;
    }
    // POISE: hits in a row break it -> STAGGERED + EXPOSED (a single hit never does — data/antiTank.js)
    const at = ANTI_TANK, hp = at.hitPoise;
    // stat poiseResist (0..0.8): hits wear the player's poise down slower (Bulwark UNBROKEN)
    const pr = 1 - clamp((this.stats && this.stats.poiseResist) || 0, 0, 0.8);
    const pd = (clamp((amount / Math.max(1, this.maxHp)) * hp.perHpShare, hp.min, hp.max) + (opts && (opts.guardBreak || opts.heavy) ? at.heavyBonus : 0)) * pr;
    if (this.poise.hit(pd, { canBreak: !steady })) this.onStaggered(src, ang);
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
    // the action carries its skill's level modifiers: hitboxes / projectiles spawned by its events pick them up
    if (r.ok && r.result) { if (!r.recast) r.result.skillMods = this.skillMods(skill); this.startAction(r.result); } // some skills (a held guard) have no action timeline
    return r.ok;
  }
  tryBreak() { return this.trySkill(this.cls.special); }
  // change which skill sits on key i+1 (Skills tab). Not allowed mid-fight.
  setSkillSlot(i, id) {
    const g = this.game;
    if (g.combat.inCombat) { g.ui.toast('Cannot change skills in combat', 1); g.audio.sfx('deny'); return false; }
    const sk = this.skillSys.get(id);
    if (sk && !this.skillUnlocked(sk)) { g.ui.toast(`Locked — ${this.skillUnlockCheck(sk).missing.join(', ')}`, 1.2); g.audio.sfx('deny'); return false; }
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
    this.game.events.emit('basicAttack', { player: this, step });
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
      this.castMods = a.skillMods || null; // read by combat.spawnHitbox / projectiles.fire (skill level power / area)
      if (a.update) a.update(a.t, dt);
      for (const ev of a.events) if (!ev.done && a.t >= ev.t) { ev.done = true; ev.fn(); }
      this.castMods = null;
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

  // STATUS AURA (data/statuses.js 'aura'): while a mode is active it stays visible — ground ring + glow under the feet,
  // light columns, a tinted pulse on the body, rising motes. { color: 'r,g,b', ring, columns, body, motes, scale }
  // aura art (status data aura.sprite = { key, loop: [first, last], fps, alpha, over, scale, lift }): a VFX strip
  // (tools/build-vfx.js) anchored at the feet — its first frames play once as the status starts, then [loop] repeats
  // while it lasts; the last frame is the fade-out, played in the final 0.3 s. Drawn behind the body ('under') and
  // again, faint and additive, over it ('over') so the body stands inside the aura
  drawAuraSprite(ctx, sp, st, layer) {
    const d = Assets.vfx[sp.key];
    if (!d || !d.img) return;
    const fps = sp.fps || 8, [l0, l1] = sp.loop || [0, d.frames - 1], age = (st.total || 0) - st.t;
    let fr;
    if (st.t < 0.3) fr = d.frames - 1;
    else if (age * fps < l0) fr = Math.floor(age * fps);
    else fr = l0 + (Math.floor(age * fps - l0) % (l1 - l0 + 1));
    const sc = sp.scale || 1, w = d.fw * sc, h = d.fh * sc;
    ctx.save();
    if (layer === 'over') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = sp.over ?? 0.25; } else ctx.globalAlpha = sp.alpha ?? 0.85;
    ctx.drawImage(d.img, fr * d.fw, 0, d.fw, d.fh, this.x - w / 2, this.y - h + (sp.lift ?? 0.2) * h, w, h);
    ctx.restore();
  }
  drawAura(ctx, a, layer, f, y, st) {
    const g = this.game, t = g.time, s = a.scale || 1, c = a.color, pulse = 0.5 + 0.5 * Math.sin(t * 4);
    if (a.sprite && st) this.drawAuraSprite(ctx, a.sprite, st, layer);
    if (layer === 'under') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const R = 30 * s * (a.ring || 1);
      const gr = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, R);
      gr.addColorStop(0, `rgba(${c},${0.35 + 0.15 * pulse})`); gr.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(this.x, this.y, R, R * 0.42, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${c},${0.55 + 0.3 * pulse})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, R * (0.8 + 0.08 * pulse), R * 0.34 * (0.8 + 0.08 * pulse), 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(this.x, this.y, R * 0.55, R * 0.23, 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < (a.columns || 0); i++) { // light columns around the body (a fortress of light)
        const ang = (i / a.columns) * TAU + t * 0.6, cx = this.x + Math.cos(ang) * R * 0.8, cy = this.y + Math.sin(ang) * R * 0.34;
        const h = (34 + 10 * Math.sin(t * 3 + i)) * s, lg = ctx.createLinearGradient(cx, cy, cx, cy - h);
        lg.addColorStop(0, `rgba(${c},0.5)`); lg.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = lg; ctx.fillRect(cx - 2, cy - h, 4, h);
      }
      ctx.restore();
      if (a.motes && Math.random() < a.motes * 0.2) { // ~12 motes a second at 60 fps
        const ang = Math.random() * TAU, r = Math.random() * R * 0.8;
        g.vfx.particle(this.x + Math.cos(ang) * r, this.y + Math.sin(ang) * r * 0.4, { vx: 0, vy: -40 - Math.random() * 30, color: `rgb(${c})`, life: 0.8, size: 2, grav: 0, drag: 0.5 });
      }
    } else if (a.body && f) { // tinted glow pulse over the body (class ghost / flash sheets)
      ctx.globalCompositeOperation = 'lighter';
      this.sprites.draw(ctx, this.currentFrame('flash'), this.x, y, a.body * (0.4 + 0.6 * pulse));
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // GUARD HOLD VFX (every class with guard data): the class's shield strip (guard.fx, 6 frames: 0 = shield, 1-3 = raise /
  // glow, 4-5 = fade) floats in front of the player toward the aim while the guard is up — intro frames once, then the
  // glow frames loop, the fade frames play after release. Data guard.hold = { intro, loop, out, fps, scale, dist, lift,
  // alpha } overrides the defaults. Drawn behind the body when aiming up (back view), in front otherwise.
  drawGuardFx(ctx, layer) {
    const gd = this.cls.guard, st = this.guardState, t = this.game.time;
    if (!gd || !gd.fx) return;
    const d = Assets.vfx[gd.fx];
    if (!d || !d.img) return;
    const h = { intro: [0, 3], loop: [1, 2], out: [4, 5], fps: 14, scale: 0.68, dist: 24, lift: 30, alpha: 0.9, ...(gd.hold || {}) };
    const aim = this.aim ?? this.facing, behind = dir4(aim) === 1;
    if ((layer === 'under') !== behind) return;
    let fr, a = h.alpha;
    if (st.active) {
      const n = Math.floor((t - st.since) * h.fps), introLen = h.intro[1] - h.intro[0] + 1;
      fr = n < introLen ? h.intro[0] + n : h.loop[0] + (Math.floor((n - introLen) / 3) % (h.loop[1] - h.loop[0] + 1)); // loop slower
      a *= 0.85 + 0.15 * Math.sin(t * 6);
    } else {
      const k = (t - st.releasedAt) * h.fps, outLen = h.out[1] - h.out[0] + 1;
      if (k < 0 || k >= outLen) return;
      fr = h.out[0] + Math.floor(k);
    }
    const sc = h.scale, w = d.fw * sc, hh = d.fh * sc;
    const cx = this.x + Math.cos(aim) * h.dist, cy = this.y - h.lift + Math.sin(aim) * h.dist * 0.5;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.drawImage(d.img, fr * d.fw, 0, d.fw, d.fh, cx - w / 2, cy - hh / 2, w, hh);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.25; // soft glow pass
    ctx.drawImage(d.img, fr * d.fw, 0, d.fw, d.fh, cx - w / 2, cy - hh / 2, w, hh);
    ctx.restore();
  }
  draw(ctx) {
    const g = this.game;
    // shadow
    const sk = this.stealthK || 0; // stealth: body fades to ~35%, shadow almost gone
    ctx.fillStyle = `rgba(0,0,0,${0.35 * (1 - sk * 0.7)})`;
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 12, 4.5, 0, 0, TAU); ctx.fill();
    const auras = this.status.list().filter((s) => STATUSES[s.id].aura); // status data 'aura' (a mode is on)
    for (const st of auras) this.drawAura(ctx, STATUSES[st.id].aura, 'under', null, 0, st);
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
    this.drawGuardFx(ctx, 'under');
    this.sprites.draw(ctx, f, this.x, y, bodyA);
    this.drawGuardFx(ctx, 'over');
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
    for (const st of auras) this.drawAura(ctx, STATUSES[st.id].aura, 'over', f, y, st);
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
