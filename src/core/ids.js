// Stable content IDs (never renumbered). Saves and future content reference these,
// internal short keys stay as lookup handles. Add new classes/maps/bosses here.
export const IDS = {
  classes: { class_umbral_sword: 'umbral_sword', class_astral_weaver: 'astral_weaver', class_aegis_guardian: 'aegis_guardian', class_nightfall_reaper: 'nightfall_reaper' },
  maps: {
    map_lumina_village: 1, map_whispering_forest: 2, map_ancient_ruins: 3, map_guardian_gate: 4,
    map_guardian_arena: 5, map_ancient_valley: 6, map_hidden_cave: 7,
  },
  bosses: { boss_guardian_forest: 'guardian', boss_hollow_fang: 'boss_a1', boss_grukk_thornbound: 'boss_a2', boss_route_a_major: 'boss_a3' },
  // V2.2 map registry ids (maps/mapRegistry.js) — `valley` (V2.1) became `city2` (City 2 Valehaven)
  mapIds: { map_city_1: 'lumina', map_route_a_1: 'a1', map_route_a_2: 'a2', map_route_a_3: 'a3', map_route_a_boss: 'arena', map_city_2: 'city2' },
  monsters: { mon_forest_wolf: 'wolf', mon_forest_goblin: 'goblin', mon_crystal_beast: 'crystal_beast', mon_amethyst_behemoth: 'crystal_alpha', mon_thornling: 'thornling', mon_rune_wraith: 'wraith' },
  quests: { quest_whispers_forest: 'whispers', quest_path_valley: 'valley', quest_sealed_depths: 'depths', quest_first_steps: 'first_steps', quest_route_a: 'route_a' },
};
export const itemId = (key) => 'item_' + key;
export const keyOf = (table, stableId) => IDS[table][stableId];
