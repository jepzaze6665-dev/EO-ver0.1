import { Z } from '../core/constants.js';

// ASHEN BADLANDS — the first map on its own grid (world/levels/ashen.js, terrain maps/ashenBadlands.js).
// W1 placeholder: proves the multi-grid world (load / unload, transitions both ways, save / load on another grid).
// It becomes A2 in W2 / W3 (monsters: armadillo, rock rhino · boss: magma beast). For now the way in is a
// temporary ember portal on the Guardian Arena's east rim, open once the Guardian falls.
const SURVEY = [
  'SURVEYOR\'S MARKER — ASHEN BADLANDS',
  'Scorched canyons beyond the forest. The ground is warm; the air tastes of ash.',
  'Ember Canyon runs north to a glowing caldera. Wide flats lie west, a broken rift east.',
  '(Uncharted — the Guild has not surveyed this land yet.)',
].join('\n');

export const FIELD_ASHEN = {
  id: 'ashen', name: 'ASHEN BADLANDS', short: 'Badlands', sub: 'Uncharted · Scorched canyons', grid: 'ashen',
  type: 'field', route: 'A', bossId: 'boss_ashen', // planned boss (data/bosses.js): no fight yet
  requires: [{ type: 'boss_defeated', boss: 'boss_a3', label: 'Defeat the Guardian of the Forest' }],
  region: { zones: [Z.BADLANDS] },
  spawn: [84.5, 192],
  content: {
    interactables: [
      { id: 'ashen_survey', kind: 'sign', tx: 88, ty: 191, prompt: "Read Surveyor's Marker", title: "Surveyor's Marker", text: SURVEY },
    ],
  },
  exits: [
    { id: 'portal_back', rect: [80, 202, 88, 203], to: 'arena', entry: [143.5, 28.5], label: 'Guardian Arena' },
  ],
};
