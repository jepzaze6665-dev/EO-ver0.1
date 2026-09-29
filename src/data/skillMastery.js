// SKILL MASTERY rules (Skill System S3) — how well the player has LEARNED a skill by using it.
// Separate from Skill Level (skill points). Short curve: a few fights per level, no endless grind.
// Mastery gives SMALL utility only (no big damage) and gates Skill Evolution (S4).
// Read by progression/masterySystem.js (events -> XP) and Player.skillMods (rewards).
export const MASTERY = {
  // masteryXp needed for mastery level n (index = level). 0 = unmastered, max = thresholds.length - 1
  thresholds: [0, 60, 180, 400, 750],
  names: ['—', 'I', 'II', 'III', 'IV'],
  // XP per action (the skill must belong to the active class)
  xp: {
    use: 3,          // cast it
    hit: 1,          // each enemy hit...
    hitCapPerCast: 4, // ...up to this many per cast (AoE into a pack doesn't explode the curve)
    kill: 8,         // the skill's hit killed an enemy
    counter: 6,      // hit an enemy inside its Counter Window (data/counter.js)
    afterPerfect: 10, // the first skill hit within `perfectWindow` s after a Perfect Dodge
    combo: 4,        // cast within `comboWindow` s after ANOTHER skill hit something
  },
  perfectWindow: 2,
  comboWindow: 1.5,
  // targets that give no hit / kill XP (training dummies, breakable props) — flags on the entity
  noXpFlags: ['isDummy', 'isBreakable'],
  // reward per mastery level (index = level, FULL set like skill levels): small utility, applied by the core
  rewards: [
    { text: 'Unmastered' },
    { cooldown: 0.97, text: 'Practised: -3% cooldown' },
    { cooldown: 0.97, cost: 0.95, text: 'Adept: -3% cooldown, -5% cost' },
    { cooldown: 0.95, cost: 0.95, text: 'Expert: -5% cooldown, -5% cost · evolutions open' },
    { cooldown: 0.94, cost: 0.92, text: 'Master: -6% cooldown, -8% cost' },
  ],
};
