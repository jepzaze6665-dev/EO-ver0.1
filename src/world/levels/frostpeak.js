import { buildFrostpeakTerrain } from '../../maps/frostpeak.js';

// FROSTPEAK grid = B3 (maps/fieldB3.js, terrain maps/frostpeak.js). Ground = the owner's B3 tileset (skin 'frostpeak'),
// props = the owner's B3 prop sheet ('p_*'). Reached through the Crystal Caverns' Abyssal Arch.
export const FROSTPEAK = {
  id: 'frostpeak', name: 'Frostpeak', size: [168, 208], seed: 7321, skin: 'frostpeak',
  generate: buildFrostpeakTerrain,
  landmarks: [
    ['South Gate', 81, 198], ['Frozen Lakes', 66, 146], ['Icebound Cave', 18, 136], ['Crystal Plateau', 30, 76], ["Hermit's Shrine", 26, 32],
    ['Nomad Camp', 131, 108], ['Glacier Stairs', 82, 108], ['Eastern Switchback', 140, 60], ['Lookout Tower', 150, 26], ['Summit Citadel', 90, 28],
  ],
};
