export const TILE = 32;
export const WORLD_W = 168;
export const WORLD_H = 208;
export const CHUNK = 16; // tiles per render chunk

// Ground tile ids
export const T = {
  VOID: 0,
  GRASS: 1,
  FOREST_FLOOR: 2,
  DIRT: 3,
  COBBLE: 4,
  RUIN: 5,
  WATER: 6,
  BRIDGE: 7,
  CANOPY: 8,
  CLIFF: 9,
  CAVE: 10,
  CAVE_WALL: 11,
  ARENA: 12,
  SAND: 13,
  CORRUPT: 14,
  SHALLOW: 15,
  FLOWERS: 16,
  VALLEY: 17,
  BUILDING: 18,
  RUIN_WALL: 19,
  MOSS_STONE: 20,
  DEEP_WATER: 21,
  STAIRS: 22, // walkable; rendered as steps rising toward the north
  SCORCHED: 23, // walkable burnt / cracked earth (A2 caldera rim)
  LAVA: 24, // molten rock: solid like deep water (shots fly over it), glows
};

// Which tiles block movement
export const SOLID_TILES = new Set([T.VOID, T.WATER, T.CANOPY, T.CLIFF, T.CAVE_WALL, T.BUILDING, T.RUIN_WALL, T.DEEP_WATER, T.LAVA]);

// Zones (major areas)
export const Z = {
  NONE: 0,
  VILLAGE: 1,
  FOREST: 2,
  RUINS: 3,
  GATE: 4,
  ARENA: 5,
  VALLEY: 6,
  CAVE: 7,
  ANCIENT: 8, // A2 Ancient Valley grid (world/levels/ancientValley.js)
  RIFT: 9, // A2 boss arena: the Magma Rift (maps/magmaRift.js)
  CITADEL: 10, // A3 Rune Citadel grid (world/levels/runeCitadel.js)
  SANCTUM: 11, // A3 boss arena (W4b)
};

export const ZONE_INFO = {
  [Z.VILLAGE]: { name: 'LUMINA VILLAGE', sub: 'Safe Zone', safe: true, music: 'village' },
  [Z.FOREST]: { name: 'WHISPERING FOREST', sub: 'Lv. 1 – 5', music: 'forest' },
  [Z.RUINS]: { name: 'ANCIENT RUINS', sub: 'Lv. 5 – 8', music: 'ruins' },
  [Z.GATE]: { name: 'GUARDIAN GATE', sub: 'Something ancient stirs', music: 'gate' },
  [Z.ARENA]: { name: 'GUARDIAN ARENA', sub: 'A1 Boss · Heart of the Forest', music: 'arena' },
  [Z.VALLEY]: { name: 'VALEHAVEN', sub: 'Secret City · Hidden Valley', safe: true, music: 'valley' },
  [Z.CAVE]: { name: 'HIDDEN CAVE', sub: 'Secret Area Discovered', music: 'cave' },
  [Z.ANCIENT]: { name: 'ANCIENT VALLEY', sub: 'Terraces of a fallen kingdom', music: 'ancient' },
  [Z.RIFT]: { name: 'MAGMA RIFT', sub: 'A2 Boss · the burning heart of the valley', music: 'arena' },
  [Z.CITADEL]: { name: 'RUNE CITADEL', sub: 'The fallen city of Asteria', music: 'ruins' },
  [Z.SANCTUM]: { name: 'THE SANCTUM', sub: 'A3 Major Boss · the Rune Knight', music: 'gate' },
};

export const TEAM = { PLAYER: 1, ENEMY: 2, NEUTRAL: 3 };
