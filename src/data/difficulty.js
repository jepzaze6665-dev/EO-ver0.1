// DIFFICULTY (owner playtest 2026-09-29: "levels come too easily, bosses deal no damage — guarding and dodging must matter").
// Global knobs on top of every other rule; change here to tune the whole game.
export const DIFFICULTY = {
  // × damage of every flat (monster / boss) hit on a player — applied in combat.dealDamage
  enemyDamage: {
    monster: 1.7, // field monsters: an ordinary hit ≈ 12-15% HP, a heavy one ≈ 20%
    boss: 1.9,    // bosses (area / major / mini): ≈ 20% average, telegraphed heavies up to about half your HP
    dot: 1.2,     // burn / poison ticks (already stack up)
  },
  // × every EXP reward (monsters, bosses, quests, secrets, exploration) — ExperienceSystem + tools/pacing.js
  expRate: 0.75,
};
