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
    // packs per terrace: the Valley Gate stays quiet; armadillos on the open terraces, rhinos guard the ruins
    spawns: [
      { id: 'a2_pines', type: 'armadillo', count: 3, tx: 58, ty: 156, radius: 5 },
      { id: 'a2_lake', type: 'armadillo', count: 2, tx: 40, ty: 160, radius: 3 },
      { id: 'a2_fords', type: 'armadillo', count: 2, tx: 98, ty: 134, radius: 4 },
      { id: 'a2_fords_rhino', type: 'rock_rhino', count: 1, tx: 104, ty: 130, radius: 2 },
      { id: 'a2_commons', type: 'armadillo', count: 2, tx: 78, ty: 112, radius: 4 },
      { id: 'a2_temple', type: 'rock_rhino', count: 2, tx: 36, ty: 102, radius: 5 },
      { id: 'a2_temple_b', type: 'armadillo', count: 1, tx: 28, ty: 96, radius: 2 },
      { id: 'a2_arch', type: 'armadillo', count: 3, tx: 138, ty: 120, radius: 5 },
      { id: 'a2_upper', type: 'rock_rhino', count: 2, tx: 80, ty: 64, radius: 5 },
      { id: 'a2_upper_b', type: 'armadillo', count: 2, tx: 72, ty: 60, radius: 3 },
      // B0: the owner's extra A2 sheets — lizards flank in the open terraces, burrowers ambush on the fords and paths
      { id: 'a2_pines_liz', type: 'quill_lizard', count: 2, tx: 66, ty: 150, radius: 3 },
      { id: 'a2_fords_burrow', type: 'burrower', count: 1, tx: 92, ty: 140, radius: 2 },
      { id: 'a2_commons_liz', type: 'quill_lizard', count: 2, tx: 88, ty: 116, radius: 3 },
      { id: 'a2_temple_burrow', type: 'burrower', count: 1, tx: 44, ty: 96, radius: 2 },
      { id: 'a2_arch_liz', type: 'quill_lizard', count: 2, tx: 130, ty: 112, radius: 3 },
      { id: 'a2_upper_burrow', type: 'burrower', count: 2, tx: 88, ty: 70, radius: 4 },
      // Elite: a Crag Rhino guards the Gilded Shrine (killed once)
      { id: 'a2_shrine_warden', type: 'rock_rhino', elite: true, unique: true, count: 1, tx: 138, ty: 66, radius: 0 },
    ],
  },
  exits: [
    { id: 'south_road', rect: [80, 202, 88, 203], to: 'arena', entry: [136, 14.5], label: 'Guardian Arena' },
    {
      id: 'rift_gate', rect: [81, 43, 87, 43], to: 'rift', entry: [84, 38], label: 'Magma Rift',
      confirm: {
        title: 'The Magma Rift',
        text: 'The ground beyond glows red. Something vast breathes in the heat.\nOnce it wakes, the rift seals behind you until one of you falls.\n\nEnter the Magma Rift?',
        yes: 'Enter', no: 'Not yet',
      },
    },
  ],
};
