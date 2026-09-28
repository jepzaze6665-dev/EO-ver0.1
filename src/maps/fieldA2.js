import { Z } from '../core/constants.js';

// A2 — ANCIENT VALLEY (own grid: world/levels/ancientValley.js, terrain maps/ancientValley.js). Built from the
// owner's A2 art: terraced cliffs, a river from a northern waterfall to Mirror Lake, bridges, the ruins of an old
// kingdom (Sunken Temple, Statue Commons, Golden Arch, Gilded Shrine) — and at the far north the Magma Rift, the lair
// of its boss, the Magma Beast (data/bosses.js boss_a2; its fight arrives in W3c). Monsters: W3b (armadillo / rhino).
//   main route : Valley Gate -> Pine Terraces -> River Fords -> Statue Commons -> High Meadow -> Magma Rift
//   side routes: Sunken Temple (W) · Golden Arch -> Gilded Shrine (E, loops back) · Mirror Lake (SW)
//   hidden slot: Quiet Hollow (SE cleft off the Valley Gate)
const PLAQUE = [
  'VALLEY GATE — a weathered plaque',
  '"Here the kings of the valley kept their summer court, before the mountain woke."',
  'The road climbs north past the river fords to the statue of the last king.',
  'Beyond the high meadow the ground still burns. Travellers do not go there.',
].join('\n');

export const FIELD_A2 = {
  id: 'a2', name: 'ANCIENT VALLEY', short: 'A2', sub: 'Route A · A2 — Ancient Valley · Lv. 10 – 14', grid: 'ancient_valley',
  type: 'field', route: 'A', nextMap: 'a3', bossId: 'boss_a2', // the Magma Beast waits in the Magma Rift (planned fight)
  requires: [{ type: 'boss_defeated', boss: 'boss_a1', label: 'Defeat the Guardian of the Forest (A1 Boss)' }],
  hiddenAreas: [],
  region: { zones: [Z.ANCIENT] },
  spawn: [84.5, 192],
  content: {
    interactables: [
      { id: 'a2_gate_plaque', kind: 'sign', tx: 88, ty: 191, prompt: 'Read Plaque', title: 'Valley Gate', text: PLAQUE },
      { id: 'ws_a2_gate', kind: 'waystone', tx: 79, ty: 194, name: 'Valley Gate', prompt: 'Waystone' },
    ],
  },
  exits: [
    { id: 'south_road', rect: [80, 202, 88, 203], to: 'arena', entry: [136, 14.5], label: 'Guardian Arena' },
  ],
};
