// SKILL TREE rules (Skill System S5). A class's skills unlock by CLASS LEVEL (+ optional prerequisite skills).
// Skill data:  unlock: { classLevel: 4, requires: ['shade_step'] }   (no `unlock` = open from class level 1)
//              category: 'OFFENSE' | 'MOBILITY' | 'UTILITY' | 'RESOURCE' | 'BURST' | 'PASSIVE'  (tree grouping)
// CLASS LEVEL = EXP earned while that class is active (progression/classProgress.js, same curve as the character).
// A starting (tier 1) class is played from character level 1, so its class level simply FOLLOWS the character level;
// a class reached by class change (Class 2, later Awakening / Secret) starts at class level 1.
export const SKILL_TREE = {
  // dev / regression tools (tools/combatTest.js, testkit.js, checklist.js) set this to true: every skill usable at any level
  unlockAll: false,
  // OWNER DECISION (after S5): what gives skill points and unlocks skills — 'character' (default) or 'class'.
  // 'character' = a new class (Class 2, later Awakening) arrives with ALL its points at the current character level:
  // no regrind after a class change. Every class still spends its own points (each class has its own pool).
  // Class level is still tracked (classProgress) for future rules (awakening trials, titles).
  pointsFrom: 'character',
  // class tree tiers whose class level mirrors the character level (data/classTree.js `tier`)
  followsCharacterTiers: [1],
  categories: {
    OFFENSE: { label: 'Offense', color: '#ff8a8a' },
    MOBILITY: { label: 'Mobility', color: '#8ad8ff' },
    UTILITY: { label: 'Defense / Utility', color: '#a0e0a0' },
    RESOURCE: { label: 'Resource', color: '#e0c070' },
    BURST: { label: 'Burst', color: '#d0a0ff' },
    PASSIVE: { label: 'Passive', color: '#c0c0c0' },
  },
};

// pure: can this skill be used / slotted at this class level? -> { ok, missing: [text] }
// ctx: { classLevel, nameOf(id) }
export function skillUnlockCheck(skill, ctx) {
  if (SKILL_TREE.unlockAll || !skill || !skill.unlock) return { ok: true, missing: [] };
  const u = skill.unlock, missing = [];
  if (u.classLevel && ctx.classLevel < u.classLevel) missing.push(`${SKILL_TREE.pointsFrom === 'class' ? 'Class ' : ''}LV ${u.classLevel}`);
  // prerequisite skills must themselves be unlocked
  for (const id of u.requires || []) {
    const req = ctx.skill && ctx.skill(id);
    if (req && !skillUnlockCheck(req, ctx).ok) missing.push(ctx.nameOf ? ctx.nameOf(id) : id);
  }
  return { ok: !missing.length, missing };
}
