// LOOT TABLES — what a defeated enemy drops. Monsters name their table (`loot: 'wolf'`); the Monster class
// never decides drops. loot/lootSystem.js rolls these when 'enemyDefeated' fires.
//
//  gold  : [min, max] (inclusive)
//  drops : [{ item, chance 0..1, count? (default 1) }] — each rolled independently
export const LOOT_TABLES = {
  rabbit: { gold: [1, 3], drops: [{ item: 'hare_pelt', chance: 0.5 }] },
  crystal_golem: { gold: [30, 50], drops: [{ item: 'rune_crystal', chance: 0.55 }, { item: 'hp_potion', chance: 0.12 }] },
  bronze_hoplite: { gold: [34, 56], drops: [{ item: 'bronze_plate', chance: 0.55 }, { item: 'hp_potion', chance: 0.12 }] },
  armadillo: { gold: [14, 24], drops: [{ item: 'stone_scute', chance: 0.6 }, { item: 'hp_potion', chance: 0.08 }] },
  rock_rhino: { gold: [24, 40], drops: [{ item: 'crag_horn', chance: 0.45 }, { item: 'stone_scute', chance: 0.3 }, { item: 'hp_potion', chance: 0.12 }] },
  wolf: { gold: [2, 6], drops: [{ item: 'wolf_fang', chance: 0.6 }] },
  leafling: { gold: [6, 14], drops: [{ item: 'goblin_iron', chance: 0.5 }, { item: 'hp_potion', chance: 0.12 }] },
  treant: { gold: [10, 20], drops: [{ item: 'crystal_shard', chance: 0.75 }, { item: 'goblin_iron', chance: 0.3 }] },
  elder_treant: { gold: [60, 90], drops: [{ item: 'moon_crystal', chance: 1 }, { item: 'crystal_shard', chance: 1, count: 3 }] },
  quill_lizard: { gold: [16, 26], drops: [{ item: 'stone_scute', chance: 0.5 }, { item: 'hp_potion', chance: 0.1 }] },
  burrower: { gold: [22, 36], drops: [{ item: 'crag_horn', chance: 0.4 }, { item: 'stone_scute', chance: 0.4 }, { item: 'hp_potion', chance: 0.12 }] },
  void_scarab: { gold: [18, 30], drops: [{ item: 'rune_crystal', chance: 0.3 }] },
  rune_wisp: { gold: [30, 48], drops: [{ item: 'rune_crystal', chance: 0.5 }, { item: 'shadow_tonic', chance: 0.12 }] },
  thornling: { gold: [0, 2], drops: [] },
  crystal_slime: { gold: [12, 22], drops: [{ item: 'crystal_shard', chance: 0.5 }, { item: 'hp_potion', chance: 0.08 }] },
  cave_spider: { gold: [16, 28], drops: [{ item: 'crystal_shard', chance: 0.4 }, { item: 'moon_crystal', chance: 0.12 }] },
  crystal_bat: { gold: [14, 26], drops: [{ item: 'crystal_shard', chance: 0.45 }, { item: 'shadow_tonic', chance: 0.08 }] },
  moss_tortoise: { gold: [28, 44], drops: [{ item: 'moon_crystal', chance: 0.4 }, { item: 'stone_scute', chance: 0.5 }, { item: 'hp_potion', chance: 0.15 }] },
  snow_hare: { gold: [1, 3], drops: [{ item: 'hare_pelt', chance: 0.5 }] },
  rime_wolf: { gold: [3, 8], drops: [{ item: 'wolf_fang', chance: 0.6 }, { item: 'frost_pelt', chance: 0.2 }] },
  frost_harrier: { gold: [5, 12], drops: [{ item: 'crystal_shard', chance: 0.5 }, { item: 'hp_potion', chance: 0.08 }] },
  frost_bear: { gold: [10, 22], drops: [{ item: 'frost_pelt', chance: 0.7 }, { item: 'hp_potion', chance: 0.15 }] },
  elite: { gold: [20, 40], drops: [{ item: 'hp_potion', chance: 0.5 }, { item: 'shadow_tonic', chance: 0.25 }] }, // extra roll for elites
  // area bosses (data/bosses.js rewards.loot) — rolled once, on the first kill
  hoarfang: { gold: [140, 140], drops: [{ item: 'frost_pelt', chance: 1, count: 4 }, { item: 'hp_potion', chance: 1, count: 3 }, { item: 'shadow_tonic', chance: 1, count: 2 }] },
  rune_knight: { gold: [200, 200], drops: [{ item: 'rune_crystal', chance: 1, count: 4 }, { item: 'bronze_plate', chance: 1, count: 3 }, { item: 'hp_potion', chance: 1, count: 4 }] },
  magma_beast: { gold: [120, 120], drops: [{ item: 'ember_core', chance: 1, count: 3 }, { item: 'hp_potion', chance: 1, count: 3 }, { item: 'shadow_tonic', chance: 1, count: 2 }] },
  hollow_fang: { gold: [80, 80], drops: [{ item: 'wolf_fang', chance: 1, count: 3 }, { item: 'hp_potion', chance: 1, count: 2 }] },
  grukk: { gold: [150, 150], drops: [{ item: 'goblin_iron', chance: 1, count: 4 }, { item: 'shadow_tonic', chance: 1 }, { item: 'hp_potion', chance: 1, count: 2 }] },
  guardian: { gold: [300, 300], drops: [{ item: 'guardian_heart', chance: 1 }, { item: 'guardian_heartwood', chance: 1 }] },
};
