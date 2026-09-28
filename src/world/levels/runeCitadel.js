import { buildRuneCitadelTerrain } from '../../maps/runeCitadel.js';

// RUNE CITADEL grid = A3 (maps/fieldA3.js, terrain maps/runeCitadel.js). Ground = the owner's A3 tileset (skin
// 'citadel'), props = the owner's A3 prop sheet ('c_*').
export const RUNE_CITADEL = {
  id: 'citadel', name: 'Rune Citadel', size: [168, 208], seed: 3313, skin: 'citadel',
  generate: buildRuneCitadelTerrain,
  landmarks: [
    ['Gate Ward', 84, 196], ['Market Square', 46, 184], ['Winged Plaza', 84, 114], ['Crystal Shrine', 46, 114],
    ['Well Court', 122, 114], ['Archive Ruins', 46, 78], ['Bronze Barracks', 122, 78], ['Golden Gate', 84, 54],
  ],
};
