import { buildAshenTerrain } from '../../maps/ashenBadlands.js';

// ASHEN BADLANDS grid = A2 (maps/fieldA2.js). Placeholder terrain skeleton — no setup / flag rules yet (W3).
export const ASHEN = {
  id: 'ashen', name: 'Ashen Badlands', size: [168, 208], seed: 2207,
  generate: buildAshenTerrain,
};
