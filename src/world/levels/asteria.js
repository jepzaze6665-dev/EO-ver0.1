import { buildAsteriaTerrain } from '../../maps/asteriaCity.js';

// ASTERIA grid = City 2 (maps/city2.js, terrain maps/asteriaCity.js). Ground = the owner's city tileset (skin
// 'asteria'), props = the owner's city prop sheet ('a_*'). A city: smaller than the route maps, square like its reference.
export const ASTERIA = {
  id: 'asteria', name: 'Asteria City', size: [112, 112], seed: 4401, skin: 'asteria',
  generate: buildAsteriaTerrain,
  landmarks: [
    ['Crystal Plaza', 56, 56], ['Asteria Keep', 56, 18], ['Grand Bazaar', 24, 64], ['Guild Quarter', 85, 48],
    ['Forge Row', 26, 74], ['Old Quarter', 24, 91], ['South Gate', 56, 98], ['East Gate', 98, 56],
  ],
};
