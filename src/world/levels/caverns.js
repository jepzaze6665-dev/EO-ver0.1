import { buildCrystalCavernsTerrain } from '../../maps/crystalCaverns.js';

// CAVERNS grid = B2 Crystal Caverns (maps/fieldB2.js, terrain maps/crystalCaverns.js). Ground = the owner's B2 tileset
// (skin 'caverns'), props = the owner's B2 prop sheet ('k_*'). Reached from the Frost Arena's south road.
export const CAVERNS = {
  id: 'caverns', name: 'Crystal Caverns', size: [168, 208], seed: 6211, skin: 'caverns',
  generate: buildCrystalCavernsTerrain,
  landmarks: [
    ['Glittering Hall', 39, 33], ['Northern Gallery', 74, 28], ['Heart of the Caverns', 142, 30], ['Crystal Field', 58, 56],
    ['Old Mine', 32, 92], ['Underground Lake', 92, 98], ['Sunken Ruins', 143, 76], ['Eastern Plaza', 148, 116],
    ['Glowroot Grotto', 26, 156], ['Sealed Crystal Vault', 88, 172], ['Abyssal Arch', 148, 174],
  ],
};
