import { Z } from '../core/constants.js';

// A2 — ASHEN BADLANDS (own grid: world/levels/ashen.js, terrain maps/ashenBadlands.js). W2: the map + its place in
// Route A (after the Guardian). Placeholder look / no monsters yet — W3 brings the badlands tiles, the armadillo /
// rock rhino packs and the boss (the magma beast, data/bosses.js boss_a2, planned).
//   Scorched Pass (south entry) -> Ember Canyon (main route) -> Magma Caldera (boss area)
//   side routes: Ash Flats (west) · Cinder Rift (east, loops back) · hidden slot: Smouldering Hollow (south-east)
const SURVEY = [
  'SURVEYOR\'S MARKER — ASHEN BADLANDS',
  'Scorched canyons beyond the forest. The ground is warm; the air tastes of ash.',
  'Ember Canyon runs north to a glowing caldera. Wide flats lie west, a broken rift east.',
  '(Uncharted — the Guild has not surveyed this land yet.)',
].join('\n');

export const FIELD_A2 = {
  id: 'a2', name: 'ASHEN BADLANDS', short: 'A2', sub: 'Route A · A2 — Ashen Badlands · Lv. 10 – 14', grid: 'ashen',
  type: 'field', route: 'A', nextMap: 'a3', bossId: 'boss_a2', // planned boss: no fight yet
  requires: [{ type: 'boss_defeated', boss: 'boss_a1', label: 'Defeat the Guardian of the Forest (A1 Boss)' }],
  hiddenAreas: [],
  region: { zones: [Z.BADLANDS] },
  spawn: [84.5, 192],
  content: {
    interactables: [
      { id: 'ashen_survey', kind: 'sign', tx: 88, ty: 191, prompt: "Read Surveyor's Marker", title: "Surveyor's Marker", text: SURVEY },
    ],
  },
  exits: [
    { id: 'south_road', rect: [80, 202, 88, 203], to: 'arena', entry: [136, 14.5], label: 'Guardian Arena' },
  ],
};
