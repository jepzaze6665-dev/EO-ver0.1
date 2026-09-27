// Stable content IDs (never renumbered). Saves and future content reference these,
// internal short keys stay as lookup handles. Add new classes/maps/bosses here.
export const IDS = {
  classes: { class_umbral_sword: 'umbral_sword', class_astral_weaver: 'astral_weaver' /* class 2: future */ },
  maps: {
    map_lumina_village: 1, map_whispering_forest: 2, map_ancient_ruins: 3, map_guardian_gate: 4,
    map_guardian_arena: 5, map_ancient_valley: 6, map_hidden_cave: 7,
  },
  bosses: { boss_guardian_forest: 'guardian' },
  monsters: { mon_forest_wolf: 'wolf', mon_forest_goblin: 'goblin', mon_crystal_beast: 'crystal_beast', mon_amethyst_behemoth: 'crystal_alpha', mon_thornling: 'thornling', mon_rune_wraith: 'wraith' },
  quests: { quest_whispers_forest: 'whispers', quest_path_valley: 'valley', quest_sealed_depths: 'depths', quest_first_steps: 'first_steps' },
};
export const itemId = (key) => 'item_' + key;
export const keyOf = (table, stableId) => IDS[table][stableId];
