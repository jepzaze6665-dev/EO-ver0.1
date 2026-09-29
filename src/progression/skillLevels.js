// SKILL LEVELS — generic rules for Skill Level 1..maxLevel (Skill System S2). Pure: no DOM, no game loop.
//
// Skill data may carry `levels`: one entry per level (index 0 = Lv 1), each the FULL set for that level:
//   levels: [
//     { text: 'Base' },
//     { power: 1.1, text: '+10% damage' },
//     { power: 1.25, area: 1.15, text: 'Bigger cut' },
//     { power: 1.25, area: 1.15, cooldown: 0.85, text: '-15% cooldown' },
//     { power: 1.5, area: 1.15, cooldown: 0.85, flags: { shadowTrail: true }, text: 'Leaves a shadow trail' },
//   ]
// Fields the CORE applies to every skill (no class code needed):
//   power    × damage of every hitbox / projectile the skill's action spawns (combat.spawnHitbox / projectiles.fire)
//   area     × hitbox size (r, r0, len, width) and projectile radius
//   cooldown × cooldown (SkillSystem.cooldownFor)
//   cost     × resource cost (SkillSystem.costFor)
// `flags` = NEW BEHAVIOUR the class code reads (p.skillFlag(id, 'shadowTrail')) — levels change how a skill plays,
// not only its numbers. `values` = named numbers for class code (p.skillValue(id, 'veilTime', 3)).
// A skill without `levels` has one level (ultimates / specials by default).

export const SKILL_LEVEL_RULES = {
  // CLASS level needed to RAISE a skill to level n (index = n - 1). Keeps power creep tied to the level cap (30).
  charLevelFor: [1, 3, 6, 10, 15],
  // skill points: 1 per CLASS level after the first (S5: class level, data/skillTree.js)
  pointsPerLevel: 1,
  // points to raise a skill to level n (index = n - 1)
  pointCost: [0, 1, 1, 2, 2],
};

const NONE = Object.freeze({ power: 1, area: 1, cooldown: 1, cost: 1, flags: Object.freeze({}), values: Object.freeze({}), text: '' });

export function maxLevel(skill) {
  return Array.isArray(skill && skill.levels) && skill.levels.length ? skill.levels.length : 1;
}

// level (1-based) -> merged modifiers for that level
export function levelMods(skill, level = 1) {
  if (!skill || !Array.isArray(skill.levels) || !skill.levels.length) return NONE;
  const e = skill.levels[Math.max(0, Math.min(skill.levels.length, level) - 1)] || {};
  return {
    power: e.power ?? 1, area: e.area ?? 1, cooldown: e.cooldown ?? 1, cost: e.cost ?? 1,
    flags: e.flags || {}, values: e.values || {}, text: e.text || '',
  };
}

// skill points of one class: earned from the character level, minus what that class's skills already cost
export function pointsSpent(classEntry, skillsById) {
  let n = 0;
  for (const [id, s] of Object.entries((classEntry && classEntry.skills) || {})) {
    if (!skillsById[id]) continue;
    for (let lv = 2; lv <= s.level; lv++) n += SKILL_LEVEL_RULES.pointCost[lv - 1] ?? 1;
  }
  return n;
}
export function pointsEarned(charLevel) { return Math.max(0, (charLevel - 1) * SKILL_LEVEL_RULES.pointsPerLevel); }

// can `skill` go from `current` to current + 1? -> { ok, reason?, cost, need? }
// (classLevel since S5; the rules field keeps its old name)
export function upgradeCheck(skill, current, charLevel, pointsLeft) {
  const next = current + 1;
  if (next > maxLevel(skill)) return { ok: false, reason: 'max' };
  const cost = SKILL_LEVEL_RULES.pointCost[next - 1] ?? 1;
  const need = SKILL_LEVEL_RULES.charLevelFor[next - 1] ?? 1;
  if (charLevel < need) return { ok: false, reason: 'level', need, cost };
  if (pointsLeft < cost) return { ok: false, reason: 'points', cost };
  return { ok: true, cost };
}
