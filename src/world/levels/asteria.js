import { buildAsteriaTerrain } from '../../maps/asteriaCity.js';

// ASTERIA grid = City 2 (maps/city2.js, terrain maps/asteriaCity.js). Ground = the owner's city tileset (skin
// 'asteria'), props = the owner's city prop sheet ('a_*'). A city: smaller than the route maps, square like its reference.
export const ASTERIA = {
  id: 'asteria', name: 'Asteria City', size: [160, 160], seed: 4401, skin: 'asteria',
  generate: buildAsteriaTerrain,
  landmarks: [
    ['Crystal Plaza', 80, 67], ['Asteria Keep', 80, 24], ['Grand Bazaar', 37, 60], ['Guild Quarter', 123, 64],
    ['Forge Row', 37, 90], ['Old Quarter', 40, 116], ['South Gate', 80, 136],
  ],
};
