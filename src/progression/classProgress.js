// CLASS PROGRESS — what the character has earned IN EACH CLASS, kept for every class it has played.
// Pure data (no DOM, no game loop): saved as `classProgress` and unit-tested (tools/tests/classProgress.test.mjs).
//
//   classProgress = {
//     active: 'nightfall_reaper',
//     classes: {
//       umbral_sword:     { level, exp, mastery, loadout: [id x4], skills: { twin_fang: { level, masteryXp, masteryLevel, evolution } } },
//       nightfall_reaper: { ... },
//     },
//   }
//
// Rules (Skill System spec §10-11, §32):
//   - a class change NEVER deletes the old class's entry: its skills become LOCKED (not usable), not lost;
//   - only skills of the ACTIVE class (or skills that list it in `sharedClassIds`) are usable;
//   - character level / EXP / gold / items / quests are NOT here (they belong to the character, not the class).
// Class level, skill level, mastery and evolution only get their rules in later phases (S2-S5); this file stores them.

import { addExp, normalize } from './experience.js';

export const SKILL_DEFAULT = () => ({ level: 1, masteryXp: 0, masteryLevel: 0, evolution: null });
export const CLASS_DEFAULT = () => ({ level: 1, exp: 0, mastery: 0, loadout: null, skills: {} });

const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const int = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : d);

export class ClassProgress {
  constructor() {
    this.active = null;
    this.classes = {};
  }

  // the entry of one class (made on first use)
  ensure(classId) {
    if (!this.classes[classId]) this.classes[classId] = CLASS_DEFAULT();
    return this.classes[classId];
  }
  has(classId) { return !!this.classes[classId]; }
  played() { return Object.keys(this.classes); }

  // one skill's progress inside its class (made on first use; never removed)
  skill(classId, skillId) {
    const c = this.ensure(classId);
    if (!c.skills[skillId]) c.skills[skillId] = SKILL_DEFAULT();
    return c.skills[skillId];
  }
  // read-only look without creating anything
  peekSkill(classId, skillId) {
    const c = this.classes[classId];
    return (c && c.skills[skillId]) || null;
  }

  // switch the active class. The old class's loadout is kept so switching back restores it.
  // -> the saved loadout of the new class (or null = use its default)
  switchTo(classId, oldLoadout = null) {
    if (this.active && oldLoadout) this.ensure(this.active).loadout = [...oldLoadout];
    this.active = classId;
    return this.ensure(classId).loadout;
  }
  // CLASS LEVEL (S5): EXP earned while this class is active, same curve as the character (data/levels.js)
  // -> levels gained
  addClassExp(classId, amount) {
    const c = this.ensure(classId), s = addExp(c.level, c.exp, amount);
    c.level = s.level; c.exp = s.exp;
    return s.levelsGained;
  }
  // a class whose level follows the character (tier 1): copy the character level / EXP
  syncLevel(classId, level, exp = 0) {
    const c = this.ensure(classId), s = normalize(level, exp);
    c.level = s.level; c.exp = s.exp;
  }
  rememberLoadout(slots) { if (this.active) this.ensure(this.active).loadout = [...slots]; }

  // can a skill be used right now? skill data: { id, classId?, sharedClassIds? }.
  // Skills carried in a class's own `skills` list belong to it even without a classId field.
  usable(skill, ownerClassId = skill.classId) {
    if (!this.active) return true;
    if ((skill.classId || ownerClassId) === this.active) return true;
    return Array.isArray(skill.sharedClassIds) && skill.sharedClassIds.includes(this.active);
  }

  // skills of every OTHER class that has progress: shown LOCKED in the skill UI.
  // classDefs = the class registry { id: { skills } }
  lockedSkills(classDefs) {
    const out = [];
    for (const id of this.played()) {
      if (id === this.active || !classDefs[id]) continue;
      for (const s of classDefs[id].skills) {
        if (this.usable(s, id)) continue; // shared with the active class
        out.push({ classId: id, skill: s, progress: this.peekSkill(id, s.id), reason: 'old_class' });
      }
    }
    return out;
  }

  serialize() {
    return { active: this.active, classes: JSON.parse(JSON.stringify(this.classes)) };
  }
  // repairs bad numbers, drops junk; never throws
  load(d) {
    this.active = null;
    this.classes = {};
    if (!isObj(d)) return this;
    if (typeof d.active === 'string') this.active = d.active;
    for (const [id, c] of Object.entries(isObj(d.classes) ? d.classes : {})) {
      if (!isObj(c)) continue;
      const e = this.ensure(id);
      e.level = int(c.level, 1, 999, 1);
      e.exp = Math.max(0, Number(c.exp) || 0);
      e.mastery = Math.max(0, Number(c.mastery) || 0);
      e.loadout = Array.isArray(c.loadout) ? c.loadout.map((x) => (typeof x === 'string' ? x : null)) : null;
      for (const [sid, s] of Object.entries(isObj(c.skills) ? c.skills : {})) {
        if (!isObj(s)) continue;
        e.skills[sid] = {
          level: int(s.level, 1, 99, 1),
          masteryXp: Math.max(0, Number(s.masteryXp) || 0),
          masteryLevel: int(s.masteryLevel, 0, 99, 0),
          evolution: typeof s.evolution === 'string' ? s.evolution : null,
        };
      }
    }
    return this;
  }
}
