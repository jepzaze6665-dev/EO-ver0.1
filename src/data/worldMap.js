// WORLD MAP for the map-select screen (panels.dungeonGate). Presentation data only: the server still decides what may
// be entered (server/dungeons.js). Pin x / y are PERCENT of the map picture, so they can be moved to match the owner's
// painted map (assets/ui/worldmap.png, made from the prompt in docs/ui/world_map_prompt.md) without touching code.
//   pins   : one per dungeon area (ONLINE.dungeon.areas) — boss = atlas id in assets/monsters (portrait = its idle frame),
//            desc = the line shown in the side panel
//   cities : non-enterable landmarks drawn on the map (where the roads start / meet)
//   roads  : polylines (percent points) drawn under the pins; route A / B colours
export const WORLD_MAP = {
  image: 'assets/ui/worldmap.png', // the owner's painted map (desgin/UI/worldmap.png, 1536×1024 = 3:2); null = the code-drawn map
  aspect: 1.5,                     // width / height of the picture: pins are placed on a box of this shape (cover-fit)
  pins: {
    a1: { x: 22, y: 68, boss: 'forest_guardian', desc: 'A whispering forest south of Lumina. Wolves, hares and treants guard the old ruins; the Guardian waits in its arena.' },
    a2: { x: 27, y: 43, boss: 'magma_beast', desc: 'Green terraced cliffs, river fords and sunken temples — and a lava rift where the Magma Beast sleeps.' },
    a3: { x: 16, y: 16, boss: 'rune_knight', desc: 'The fallen Rune Citadel: walled streets, bronze hoplites and sealed vaults. The Rune Knight holds the Sanctum.' },
    b1: { x: 77, y: 71, boss: 'hoarfang', desc: 'Frostwind Plains: a snowfield swept by blizzards. Keep near the campfires — Hoarfang hunts in the storm.' },
    b2: { x: 74, y: 38, boss: 'amethyst_colossus', desc: 'Crystal Caverns: dark chambers lit only by glow crystals. The Amethyst Colossus guards the Heart.' },
    b3: { x: 83, y: 13, boss: 'crystal_warden', desc: 'Frostpeak: the colder you climb, the harder it bites. The Crystal Warden waits at the summit.' },
  },
  cities: [
    { id: 'lumina', name: 'Lumina', x: 50, y: 90 },
    { id: 'city2', name: 'Asteria', x: 49, y: 31 },
  ],
  roads: {
    A: [[50, 90], [22, 68], [27, 43], [16, 16], [49, 31]],
    B: [[50, 90], [77, 71], [74, 38], [83, 13], [49, 31]],
  },
  routeColor: { A: '#8fd06a', B: '#8ad0ff' },
};

// POSSIBLE REWARDS on the map select (panels.dungeonGate): the field monsters + mini-bosses of each dungeon area (read from
// the built grids once; tools/tests/worldMap.test.mjs checks the ids exist). Their loot tables (data/lootTables.js) are
// shown first, so every area lists its own drops; the area boss's table joins once it has been beaten (it stays secret).
export const AREA_DROPS = {
  a1: { monsters: ['rabbit', 'wolf', 'leafling', 'treant', 'elder_treant'], minis: ['mini_hollow_fang', 'mini_grukk'] },
  a2: { monsters: ['armadillo', 'rock_rhino', 'quill_lizard', 'burrower'], minis: ['mini_sunken_horn'] },
  a3: { monsters: ['crystal_golem', 'bronze_hoplite', 'void_scarab', 'rune_wisp'], minis: ['mini_archive_warden'] },
  b1: { monsters: ['snow_hare', 'rime_wolf', 'frost_harrier', 'frost_bear'], minis: ['mini_old_scarclaw'] },
  b2: { monsters: ['crystal_slime', 'crystal_bat', 'cave_spider', 'moss_tortoise'], minis: ['mini_broodmother'] },
  b3: { monsters: ['glacier_wolf', 'frost_imp', 'snow_eagle', 'yeti'], minis: ['mini_icebound_king'] },
};
