import { buildAshenTerrain } from '../../maps/ashenBadlands.js';

// ASHEN BADLANDS grid (future A2). Placeholder in W1: terrain skeleton only — no setup / flag rules yet.
export const ASHEN = {
  id: 'ashen', name: 'Ashen Badlands', size: [168, 208], seed: 2207,
  generate: buildAshenTerrain,
};
