import { buildFrostwindTerrain } from '../../maps/frostwind.js';

// FROSTWIND grid = B1 Frostwind Plains (maps/fieldB1.js, terrain maps/frostwind.js). Ground = the owner's B1 tileset
// (skin 'frost'), props = the owner's B1 prop sheet ('f_*'). Route B's first map, reached by Lumina's Eastern Road.
export const FROSTWIND = {
  id: 'frostwind', name: 'Frostwind Plains', size: [168, 208], seed: 5121, skin: 'frost',
  generate: buildFrostwindTerrain,
  landmarks: [
    ["Hunter's Lodge", 20, 20], ['Old Watchtower', 89, 26], ['Frostwind Crossroads', 81, 57], ['Nomad Camp', 144, 63],
    ["Trapper's Ruins", 35, 62], ['Frozen Mere', 56, 122], ['Ice Shrine', 21, 156], ['Crystal Ridge', 115, 16],
  ],
};
