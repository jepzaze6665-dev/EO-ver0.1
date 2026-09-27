// LOOT TABLES — what a defeated enemy drops. Monsters name their table (`loot: 'wolf'`); the Monster class
// never decides drops. loot/lootSystem.js rolls these when 'enemyDefeated' fires.
//
//  gold  : [min, max] (inclusive)
//  drops : [{ item, chance 0..1, count? (default 1) }] — each rolled independently
export const LOOT_TABLES = {
  wolf: { gold: [2, 6], drops: [{ item: 'wolf_fang', chance: 0.6 }] },
  goblin: { gold: [6, 14], drops: [{ item: 'goblin_iron', chance: 0.5 }, { item: 'hp_potion', chance: 0.12 }] },
  crystal_beast: { gold: [10, 20], drops: [{ item: 'crystal_shard', chance: 0.75 }] },
  crystal_alpha: { gold: [60, 90], drops: [{ item: 'moon_crystal', chance: 1 }, { item: 'crystal_shard', chance: 1, count: 3 }] },
  thornling: { gold: [0, 2], drops: [] },
  wraith: { gold: [15, 30], drops: [{ item: 'moon_crystal', chance: 0.25 }] },
  guardian: { gold: [300, 300], drops: [{ item: 'guardian_heart', chance: 1 }, { item: 'guardian_heartwood', chance: 1 }] },
};
