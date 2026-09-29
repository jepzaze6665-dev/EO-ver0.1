// DIFFICULTY (owner playtest 2026-09-29: "levels come too easily, bosses deal no damage — guarding and dodging must matter").
// Global knobs on top of every other rule; change here to tune the whole game.
export const DIFFICULTY = {
  // × damage of every flat (monster / boss) hit on a player — applied in combat.dealDamage
  enemyDamage: {
    monster: 1.7, // field monsters: an ordinary hit ≈ 12-15% HP, a heavy one ≈ 20%
    boss: 1.9,    // bosses (area / major / mini): ≈ 20% average, telegraphed heavies up to about half your HP
    dot: 1.2,     // burn / poison ticks (already stack up)
  },
  // × HP of FIELD monsters by role (owner: "normal monsters should be tankier"). Small / fast ones were dying in 2-3
  // hits, big bruisers already took long -> the small ones gain the most. Bosses and their summoned adds unchanged.
  monsterHp: { swarm: 2.2, skirmisher: 2.0, caster: 1.9, bruiser: 1.4, tank: 1.3, default: 1.7 },
  // × every EXP reward (monsters, bosses, quests, secrets, exploration) — ExperienceSystem + tools/pacing.js
  expRate: 0.5, // owner: 0.75 -> 0.40 -> 0.50 together with more monsters per map (spawnDensity)
  // MORE MONSTERS PER MAP (world/spawnDensity.js): × ordinary monsters of each map (packs +packBonus, the rest = new packs
  // minDist-maxDist tiles from an existing one, never closer than gap tiles to another pack)
  spawnDensity: { density: 1.5, packBonus: 1, packChance: 0.35, minDist: 7, maxDist: 14, gap: 6 },
  // seconds before a cleared pack comes back (the player must be > 700 px away)
  respawnTime: 35,
};
