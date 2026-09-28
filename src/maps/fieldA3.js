import { Z } from '../core/constants.js';

// A3 — RUNE CITADEL (own grid: world/levels/runeCitadel.js, terrain maps/runeCitadel.js). The fallen city of Asteria,
// built from the owner's A3 art. Reached from the Magma Rift's east causeway once the Magma Beast falls.
// Monsters: Crystal Golems (front chest weak point, slams wall you in with crystal spikes) and Bronze Hoplites
// (frontal shields — flank or break them; two together form a phalanx). Major Boss: the Rune Knight in the Sanctum
// behind the Golden Gate (data/bosses.js boss_a3 — its fight arrives in W4b).
const PLAQUE = [
  'GATE WARD — a bronze plaque, half melted',
  '"Asteria, city of runes. Keep to the lamps; the soldiers still keep their posts."',
  'The avenue climbs north past the Winged Plaza to the Golden Gate.',
  'Beyond it lies the Sanctum, where the last knight of the city still stands guard.',
].join('\n');

export const FIELD_A3 = {
  id: 'a3', name: 'RUNE CITADEL', short: 'A3', sub: 'Route A · A3 — Rune Citadel · Lv. 14 – 17', grid: 'citadel',
  type: 'field', route: 'A', nextMap: 'city2', bossId: 'boss_a3',
  requires: [{ type: 'boss_defeated', boss: 'boss_a2', label: 'Defeat the Magma Beast (A2 Boss)' }],
  hiddenAreas: [],
  region: { zones: [Z.CITADEL] },
  spawn: [84, 196],
  content: {
    interactables: [
      { id: 'a3_gate_plaque', kind: 'sign', tx: 90, ty: 194, prompt: 'Read Plaque', title: 'Gate Ward', text: PLAQUE },
      { id: 'ws_a3_gate', kind: 'waystone', tx: 77, ty: 194, name: 'Gate Ward', prompt: 'Waystone' },
    ],
    // golems hold the ruins and the shrine; hoplites stand in pairs (phalanx) at the barracks and the plazas
    spawns: [
      { id: 'a3_market', type: 'crystal_golem', count: 1, tx: 46, ty: 176, radius: 2 },
      { id: 'a3_lamplight', type: 'bronze_hoplite', count: 2, tx: 122, ty: 184, radius: 2 },
      { id: 'a3_winged', type: 'bronze_hoplite', count: 2, tx: 84, ty: 120, radius: 3 },
      { id: 'a3_winged_golem', type: 'crystal_golem', count: 1, tx: 76, ty: 108, radius: 1 },
      { id: 'a3_shrine', type: 'crystal_golem', count: 2, tx: 46, ty: 118, radius: 3 },
      { id: 'a3_well', type: 'bronze_hoplite', count: 2, tx: 122, ty: 118, radius: 2 },
      { id: 'a3_archive', type: 'crystal_golem', count: 2, tx: 46, ty: 80, radius: 4 },
      { id: 'a3_barracks', type: 'bronze_hoplite', count: 3, tx: 122, ty: 80, radius: 3 },
      { id: 'a3_golden', type: 'bronze_hoplite', count: 2, tx: 84, ty: 60, radius: 2 },
      // B0: the owner's extra A3 sheets — scarabs swarm the alleys in threes, wisps haunt the shrine and the archive
      { id: 'a3_gate_scarabs', type: 'void_scarab', count: 3, tx: 58, ty: 170, radius: 3 },
      { id: 'a3_lamp_scarabs', type: 'void_scarab', count: 3, tx: 108, ty: 170, radius: 3 },
      { id: 'a3_shrine_wisp', type: 'rune_wisp', count: 1, tx: 54, ty: 110, radius: 2 },
      { id: 'a3_well_scarabs', type: 'void_scarab', count: 3, tx: 132, ty: 110, radius: 3 },
      { id: 'a3_archive_wisp', type: 'rune_wisp', count: 2, tx: 40, ty: 70, radius: 3 },
      { id: 'a3_barracks_scarabs', type: 'void_scarab', count: 3, tx: 110, ty: 88, radius: 3 },
      { id: 'a3_golden_wisp', type: 'rune_wisp', count: 1, tx: 92, ty: 62, radius: 2 },
      // Elite: a Crystal Golem guards the Golden Gate (killed once)
      { id: 'a3_gate_warden', type: 'crystal_golem', elite: true, unique: true, count: 1, tx: 84, ty: 54, radius: 0 },
    ],
  },
  exits: [
    { id: 'south_gate', rect: [80, 203, 88, 204], to: 'rift', entry: [101, 22], label: 'Magma Rift' },
    {
      id: 'golden_gate', rect: [83, 49, 85, 49], to: 'sanctum', entry: [84, 40], label: 'The Sanctum',
      confirm: {
        title: 'The Sanctum',
        text: 'Behind the Golden Gate a knight in bronze and runes still keeps his watch.\nOnce he raises his blade, the Sanctum seals until one of you falls.\n\nEnter the Sanctum?',
        yes: 'Enter', no: 'Not yet',
      },
    },
  ],
};
