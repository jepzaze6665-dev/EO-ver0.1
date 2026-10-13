import { TILE } from '../../core/constants.js';
import { TrainingDummy } from '../../entities/trainingDummy.js';
import { buildLuminaCity } from '../../maps/luminaCity.js';

// LUMINA grid = City 1 (maps/luminaVillage.js, terrain maps/luminaCity.js). Its own small grid since the city rework
// (owner 2026-10-13): before it was the south corner of the whispering grid. Painted tiles (no skin) like A1.
export const LUMINA = {
  id: 'lumina', name: 'Lumina Village', size: [96, 96], seed: 2024,
  generate: buildLuminaCity,
  landmarks: [['Town Square', 48, 48], ['Adventurer Guild', 30, 46], ['Forest Gate', 48, 9], ['Eastern Road', 88, 48], ['Farmstead', 18, 78]],
  // training yard beside the Adventurer Guild (class / combat testing)
  setup(w, L) {
    L.dummies = [[26, 52], [29, 53.5], [32, 52]].map(([tx, ty]) => {
      const pos = L.map.findOpen(tx * TILE, ty * TILE, 3);
      return new TrainingDummy(w.game, pos.x, pos.y);
    });
  },
};
