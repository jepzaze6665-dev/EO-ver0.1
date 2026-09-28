// LOOT TABLES — what a defeated enemy drops. Monsters name their table (`loot: 'wolf'`); the Monster class
// never decides drops. loot/lootSystem.js rolls these when 'enemyDefeated' fires.
//
//  gold  : [min, max] (inclusive)
//  drops : [{ item, chance 0..1, count? (default 1) }] — each rolled independently
export const LOOT_TABLES = {
  rabbit: { gold: [1, 3], drops: [{ item: 'hare_pelt', chance: 0.5 }] },
  armadillo: { gold: [14, 24], drops: [{ item: 'stone_scute', chance: 0.6 }, { item: 'hp_potion', chance: 0.08 }] },
  rock_rhino: { gold: [24, 40], drops: [{ item: 'crag_horn', chance: 0.45 }, { item: 'stone_scute', chance: 0.3 }, { item: 'hp_potion', chance: 0.12 }] },
  wolf: { gold: [2, 6], drops: [{ item: 'wolf_fang', chance: 0.6 }] },
  goblin: { gold: [6, 14], drops: [{ item: 'goblin_iron', chance: 0.5 }, { item: 'hp_potion', chance: 0.12 }] },
  crystal_beast: { gold: [10, 20], drops: [{ item: 'crystal_shard', chance: 0.75 }] },
  crystal_alpha: { gold: [60, 90], drops: [{ item: 'moon_crystal', chance: 1 }, { item: 'crystal_shard', chance: 1, count: 3 }] },
  thornling: { gold: [0, 2], drops: [] },
  wraith: { gold: [15, 30], drops: [{ item: 'moon_crystal', chance: 0.25 }] },
  elite: { gold: [20, 40], drops: [{ item: 'hp_potion', chance: 0.5 }, { item: 'shadow_tonic', chance: 0.25 }] }, // extra roll for elites
  // area bosses (data/bosses.js rewards.loot) — rolled once, on the first kill
  magma_beast: { gold: [120, 120], drops: [{ item: 'ember_core', chance: 1, count: 3 }, { item: 'hp_potion', chance: 1, count: 3 }, { item: 'shadow_tonic', chance: 1, count: 2 }] },
  hollow_fang: { gold: [80, 80], drops: [{ item: 'wolf_fang', chance: 1, count: 3 }, { item: 'hp_potion', chance: 1, count: 2 }] },
  grukk: { gold: [150, 150], drops: [{ item: 'goblin_iron', chance: 1, count: 4 }, { item: 'shadow_tonic', chance: 1 }, { item: 'hp_potion', chance: 1, count: 2 }] },
  guardian: { gold: [300, 300], drops: [{ item: 'guardian_heart', chance: 1 }, { item: 'guardian_heartwood', chance: 1 }] },
};
