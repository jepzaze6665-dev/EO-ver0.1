import { buildAncientValleyTerrain } from '../../maps/ancientValley.js';

// ANCIENT VALLEY grid = A2 (maps/fieldA2.js, terrain maps/ancientValley.js). Ground art = the owner's A2 tileset
// (skin 'valley'), props = the owner's A2 prop sheet ('v_*').
export const ANCIENT_VALLEY = {
  id: 'ancient_valley', name: 'Ancient Valley', size: [168, 208], seed: 2207, skin: 'valley',
  generate: buildAncientValleyTerrain,
  landmarks: [
    ['Valley Gate', 84, 194], ['Statue Commons', 84, 101], ['Sunken Temple', 34, 93], ['Golden Arch', 140, 112],
    ['Gilded Shrine', 138, 58], ['Mirror Lake', 30, 168], ['Magma Rift', 84, 26],
  ],
};
