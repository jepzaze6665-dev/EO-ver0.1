import { STAMINA } from '../data/stamina.js';
import { staminaCost } from '../data/skillTiers.js';
import { Cooldowns } from './cooldownSystem.js';

// SKILL SYSTEM — generic skill pipeline for any caster (player today; enemies, party
// members or a server tomorrow). It never touches the DOM and never names a class.
//
//   check  : known? caster free to act? cooldown ready? requirements met? resource affordable?
//   spend  : resource cost through the caster's ResourcePool
//   start  : cooldown (reduced by the caster's `cdr` stat)
//   cast   : skill.cast(...args) returns the behaviour (an action timeline) — class code lives there
//   report : onUsed / onFailed callbacks with a machine-readable reason
//
// Skill data (see skills/*.js):
//   { id, name, description, type: 'active'|'ultimate'|'special', slot, cost, costResource?,
//     cooldown, targeting: 'direction'|'self'|'point', requirements: [...], tags: [], cast(),
//     recast?: { window, cast() } }
//   RECAST: after a skill with `recast` is used, pressing it again within `window` seconds runs recast.cast()
//   instead — no cooldown / cost / stamina check (the first cast paid them). One recast per use.
//   (Duskrunner's Flash Step second dash, Mirage Shift's return.) recastLeft(id) tells the UI.
// Caster interface (duck-typed): resources (ResourcePool), stats.cdr, primaryResource,
//   canAct(skill) -> bool, and whatever fields REQUIREMENTS read.
export const SKILL_FAIL = {
  UNKNOWN: 'unknown', BUSY: 'busy', SILENCED: 'silenced', COOLDOWN: 'cooldown', REQUIREMENT: 'requirement', RESOURCE: 'resource', STAMINA: 'stamina',
};

// Requirement checks are data -> predicate. New condition types register here, not in the pipeline.
export const REQUIREMENTS = {
  // { type: 'value', key: 'marks', min: 3, label: '3 Shadow Marks' } — reads caster[key]
  value: (caster, r) => (caster[r.key] || 0) >= r.min,
  // { type: 'resource', resource: 'astral_charge', min: 50 }
  resource: (caster, r) => caster.resources.get(r.resource) >= r.min,
  // { type: 'mark', mark: 'shadow_mark', min: 3 } — stacks the caster holds (caster.markCount)
  mark: (caster, r) => (caster.markCount ? caster.markCount(r.mark) : 0) >= r.min,
  // { type: 'markedFoe', mark: 'reaper_mark', range: 320, min?: 1 } — foes within range carrying that mark
  //   (caster.markedFoes(markId, range) -> list)
  // { type: 'recorded', ids: [...], within: 6 } — the caster's ActionRecorder (caster.memory) remembers one of these
  recorded: (caster, r) => !!(caster.memory && caster.game && caster.memory.last(caster.game.time, (e) => (!r.ids || r.ids.includes(e.id)) && caster.game.time - e.t <= (r.within ?? Infinity))),
  // { type: 'hpBelow', max: 0.4, label: 'below 40% HP' } — caster.hp / caster.maxHp under the line
  hpBelow: (caster, r) => caster.maxHp > 0 && caster.hp / caster.maxHp < r.max,
  markedFoe: (caster, r) => (caster.markedFoes ? caster.markedFoes(r.mark, r.range).length : 0) >= (r.min || 1),
};

export const MAX_CDR = 0.6; // cooldown reduction cap — prevents "no cooldown" builds

export class SkillSystem {
  constructor(caster, skills, { onUsed, onFailed } = {}) {
    this.caster = caster;
    this.skills = {};
    this.cooldowns = new Cooldowns();
    this.recasts = {}; // skill id -> seconds left to recast
    this.onUsed = onUsed || null;
    this.onFailed = onFailed || null;
    for (const s of skills) this.register(s);
  }

  register(skill) {
    if (!skill || !skill.id || typeof skill.cast !== 'function') throw new Error('Invalid skill data: ' + (skill && skill.id));
    this.skills[skill.id] = skill;
  }
  get(id) { return this.skills[id] || null; }
  list(type) { return Object.values(this.skills).filter((s) => !type || s.type === type); }
  costResource(skill) { return skill.costResource || this.caster.primaryResource; }
  cooldownFor(skill) {
    const cdr = Math.min(MAX_CDR, Math.max(0, (this.caster.stats && this.caster.stats.cdr) || 0));
    return (skill.cooldown || 0) * (1 - cdr) * this.mods(skill).cooldown;
  }
  // SKILL LEVELS (progression/skillLevels.js): the caster may scale a skill's numbers (caster.skillMods(skill))
  mods(skill) { return (this.caster.skillMods && this.caster.skillMods(skill)) || { cooldown: 1, cost: 1 }; }
  costFor(skill) { return skill.cost ? Math.round(skill.cost * this.mods(skill).cost) : 0; }

  canUse(id) {
    const s = this.skills[id];
    if (!s) return { ok: false, reason: SKILL_FAIL.UNKNOWN };
    if (this.caster.canAct && !this.caster.canAct(s)) return { ok: false, reason: SKILL_FAIL.BUSY, skill: s };
    // status effects (silence) — any caster with a StatusSet; basic attacks are not skills-that-cast
    if (this.caster.status && this.caster.status.canCast && !this.caster.status.canCast() && s.type !== 'basic') return { ok: false, reason: SKILL_FAIL.SILENCED, skill: s };
    if (this.recastLeft(id) > 0) return { ok: true, skill: s, recast: true };
    if (!this.cooldowns.ready(id)) return { ok: false, reason: SKILL_FAIL.COOLDOWN, skill: s, remaining: this.cooldowns.remaining(id) };
    for (const r of s.requirements || []) {
      const check = REQUIREMENTS[r.type];
      if (!check || !check(this.caster, r)) return { ok: false, reason: SKILL_FAIL.REQUIREMENT, skill: s, requirement: r };
    }
    if (s.cost && !this.caster.resources.canAfford(this.costResource(s), this.costFor(s))) {
      return { ok: false, reason: SKILL_FAIL.RESOURCE, skill: s, resource: this.costResource(s) };
    }
    // COMBAT 2.0: stamina (skill.stamina, else its tier's default — data/skillTiers.js) on top of the class resource cost
    const sta = staminaCost(s);
    if (sta && this.caster.resources.has(STAMINA.resource) && !this.caster.resources.canAfford(STAMINA.resource, sta)) {
      return { ok: false, reason: SKILL_FAIL.STAMINA, skill: s, resource: STAMINA.resource };
    }
    return { ok: true, skill: s };
  }

  // Returns { ok, reason, result }. On failure nothing is spent and no cooldown starts.
  use(id, ...castArgs) {
    const check = this.canUse(id);
    if (!check.ok) {
      if (this.onFailed && check.reason !== SKILL_FAIL.BUSY) this.onFailed({ caster: this.caster, skillId: id, ...check });
      return check;
    }
    const s = check.skill;
    if (this.caster.beforeCast) this.caster.beforeCast(s);
    if (check.recast) {
      delete this.recasts[id];
      const result = s.recast.cast(...castArgs);
      if (this.onUsed) this.onUsed({ caster: this.caster, skillId: id, skill: s, recast: true });
      return { ok: true, skill: s, result, recast: true };
    }
    if (s.cost) this.caster.resources.spend(this.costResource(s), this.costFor(s), 'skill:' + id);
    const sta = staminaCost(s);
    if (sta && this.caster.resources.has(STAMINA.resource)) this.caster.resources.spend(STAMINA.resource, sta, 'skill:' + id);
    this.cooldowns.start(id, this.cooldownFor(s));
    const result = s.cast(...castArgs);
    if (s.recast && s.recast.window > 0) this.recasts[id] = s.recast.window;
    if (this.onUsed) this.onUsed({ caster: this.caster, skillId: id, skill: s });
    return { ok: true, skill: s, result };
  }

  recastLeft(id) { return this.recasts[id] || 0; }
  closeRecast(id) { delete this.recasts[id]; }

  update(dt) {
    this.cooldowns.update(dt);
    if (dt > 0) for (const id in this.recasts) if ((this.recasts[id] -= dt) <= 0) delete this.recasts[id];
  }
}
