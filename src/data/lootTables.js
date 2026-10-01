// LOOT TABLES — what a defeated enemy drops. Monsters name their table (`loot: 'wolf'`); the Monster class
// never decides drops. loot/lootSystem.js rolls these when 'enemyDefeated' fires.
//
//  gold  : [min, max] (inclusive)
//  drops : [{ item, chance 0..1, count? (default 1) }] — each rolled independently
//  oneOf : [{ chance, items: [{ item, weight }] }] — each group: with `chance`, exactly ONE item picked by weight
//          (e.g. "a random Weapon Core")
// GEAR (Item System G6): bosses pay their rewards ONCE (first kill: boss/bossSystem.js), so a boss SIGNATURE item
// (item dropSource = that boss) drops at chance 1 — a 5% roll you can never retry would lock it away. Farmable
// sources (elites, which respawn) carry the random gear chances.
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
  glacier_wolf: { gold: [20, 34], drops: [{ item: 'frost_pelt', chance: 0.5 }, { item: 'wolf_fang', chance: 0.4 }] },
  yeti: { gold: [34, 56], drops: [{ item: 'frost_pelt', chance: 0.8, count: 2 }, { item: 'hp_potion', chance: 0.18 }] },
  frost_imp: { gold: [18, 30], drops: [{ item: 'moon_crystal', chance: 0.2 }, { item: 'shadow_tonic', chance: 0.1 }] },
  snow_eagle: { gold: [22, 36], drops: [{ item: 'crystal_shard', chance: 0.5 }, { item: 'hp_potion', chance: 0.1 }] },
  crystal_slime: { gold: [12, 22], drops: [{ item: 'crystal_shard', chance: 0.5 }, { item: 'hp_potion', chance: 0.08 }] },
  cave_spider: { gold: [16, 28], drops: [{ item: 'crystal_shard', chance: 0.4 }, { item: 'moon_crystal', chance: 0.12 }] },
  crystal_bat: { gold: [14, 26], drops: [{ item: 'crystal_shard', chance: 0.45 }, { item: 'shadow_tonic', chance: 0.08 }] },
  moss_tortoise: { gold: [28, 44], drops: [{ item: 'moon_crystal', chance: 0.4 }, { item: 'stone_scute', chance: 0.5 }, { item: 'hp_potion', chance: 0.15 }] },
  snow_hare: { gold: [1, 3], drops: [{ item: 'hare_pelt', chance: 0.5 }] },
  rime_wolf: { gold: [3, 8], drops: [{ item: 'wolf_fang', chance: 0.6 }, { item: 'frost_pelt', chance: 0.2 }] },
  frost_harrier: { gold: [5, 12], drops: [{ item: 'crystal_shard', chance: 0.5 }, { item: 'hp_potion', chance: 0.08 }] },
  frost_bear: { gold: [10, 22], drops: [{ item: 'frost_pelt', chance: 0.7 }, { item: 'hp_potion', chance: 0.15 }] },
  elite: { gold: [20, 40], drops: [{ item: 'hp_potion', chance: 0.5 }, { item: 'shadow_tonic', chance: 0.25 }], // extra roll for elites (+ mini-bosses A2+)
    oneOf: [{ chance: 0.25, items: [ // gear: a rune or a charm
      { item: 'rune_guarding_soul', weight: 3 }, { item: 'rune_iron_will', weight: 3 }, { item: 'rune_retribution', weight: 2 }, { item: 'rune_provocation', weight: 2 },
      { item: 'charm_heavy', weight: 3 }, { item: 'charm_swift', weight: 3 }, { item: 'charm_focus', weight: 2 }, { item: 'charm_guardian', weight: 2 },
      // I3: Umbral / Astral / universal runes + charms (any class can find them: a class change may use them later)
      { item: 'rune_red_thirst', weight: 2 }, { item: 'rune_full_moon', weight: 2 }, { item: 'rune_shadow_hunger', weight: 2 }, { item: 'charm_assassin', weight: 2 },
      { item: 'rune_comet_tail', weight: 2 }, { item: 'rune_supernova', weight: 2 }, { item: 'charm_starfocus', weight: 2 },
      { item: 'rune_second_wind', weight: 3 }, { item: 'rune_executioner', weight: 2 }, { item: 'rune_hunters_sigil', weight: 2 }, { item: 'charm_wanderer', weight: 3 },
    ] }] },
  // A2+ mini-bosses (data/bosses.js): the elite roll + one non-signature relic (paid once, on the first kill)
  mini_relic: { gold: [40, 60], drops: [{ item: 'hp_potion', chance: 1 }, { item: 'shadow_tonic', chance: 0.5 }],
    oneOf: [
      { chance: 1, items: [{ item: 'relic_heart_eclipse', weight: 1 }, { item: 'relic_bloodletter', weight: 1 }, { item: 'relic_orrery', weight: 1 }, { item: 'relic_spindle', weight: 1 }, { item: 'relic_ember_war', weight: 1 }] },
      { chance: 0.25, items: [{ item: 'rune_second_wind', weight: 1 }, { item: 'rune_executioner', weight: 1 }, { item: 'charm_wanderer', weight: 1 }, { item: 'rune_full_moon', weight: 1 }, { item: 'rune_supernova', weight: 1 }] },
    ] },
  // area bosses (data/bosses.js rewards.loot) — rolled once, on the first kill
  crystal_warden: { gold: [200, 200], drops: [{ item: 'moon_crystal', chance: 1, count: 4 }, { item: 'frost_pelt', chance: 1, count: 3 }, { item: 'hp_potion', chance: 1, count: 4 }] },
  amethyst_colossus: { gold: [170, 170], drops: [{ item: 'moon_crystal', chance: 1, count: 3 }, { item: 'crystal_shard', chance: 1, count: 5 }, { item: 'hp_potion', chance: 1, count: 3 }, { item: 'shadow_tonic', chance: 1, count: 2 }],
    oneOf: [{ chance: 1, items: [{ item: 'core_nightglass', weight: 1 }, { item: 'core_fallen_constellation', weight: 1 }] }] },
  hoarfang: { gold: [140, 140], drops: [{ item: 'frost_pelt', chance: 1, count: 4 }, { item: 'hp_potion', chance: 1, count: 3 }, { item: 'shadow_tonic', chance: 1, count: 2 }, { item: 'relic_last_bastion', chance: 1 }],
    oneOf: [{ chance: 1, items: [{ item: 'core_ironheart', weight: 1 }, { item: 'core_counter', weight: 1 }, { item: 'core_vanguard', weight: 1 }, { item: 'core_shadow_fang', weight: 1 }, { item: 'core_star_loom', weight: 1 }] }] },
  rune_knight: { gold: [200, 200], drops: [{ item: 'rune_crystal', chance: 1, count: 4 }, { item: 'bronze_plate', chance: 1, count: 3 }, { item: 'hp_potion', chance: 1, count: 4 }] },
  varkharon: { gold: [200, 200], drops: [{ item: 'ember_core', chance: 1, count: 5 }, { item: 'hp_potion', chance: 1, count: 4 }, { item: 'shadow_tonic', chance: 1, count: 3 }] },
  magma_beast: { gold: [120, 120], drops: [{ item: 'ember_core', chance: 1, count: 3 }, { item: 'hp_potion', chance: 1, count: 3 }, { item: 'shadow_tonic', chance: 1, count: 2 }, { item: 'relic_dawn_core', chance: 1 }],
    oneOf: [{ chance: 1, items: [{ item: 'core_nightglass', weight: 1 }, { item: 'core_fallen_constellation', weight: 1 }] }] },
  hollow_fang: { gold: [80, 80], drops: [{ item: 'wolf_fang', chance: 1, count: 3 }, { item: 'hp_potion', chance: 1, count: 2 }],
    oneOf: [{ chance: 1, items: [{ item: 'core_ironheart', weight: 1 }, { item: 'core_counter', weight: 1 }, { item: 'core_vanguard', weight: 1 }, { item: 'core_shadow_fang', weight: 1 }, { item: 'core_star_loom', weight: 1 }] }] },
  grukk: { gold: [150, 150], drops: [{ item: 'goblin_iron', chance: 1, count: 4 }, { item: 'shadow_tonic', chance: 1 }, { item: 'hp_potion', chance: 1, count: 2 }],
    oneOf: [{ chance: 1, items: [{ item: 'armor_fortress', weight: 1 }, { item: 'armor_guardian', weight: 1 }, { item: 'armor_risk', weight: 1 }, { item: 'armor_duskweave', weight: 1 }, { item: 'armor_starveil', weight: 1 }, { item: 'armor_pathfinder', weight: 1 }] }] },
  guardian: { gold: [300, 300], drops: [{ item: 'guardian_heart', chance: 1 }, { item: 'guardian_heartwood', chance: 1 }, { item: 'relic_oath_mirror', chance: 1 }] },
};
