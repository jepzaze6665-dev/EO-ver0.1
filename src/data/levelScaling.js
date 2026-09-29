// LEVEL SCALING rules (Level rework L1, owner 2026-09-29: cap 50, Class 2 at LV 30, Route A ends ≈ LV 38, Route B ≈ 45).
// Monsters keep their hand-tuned stats at their NATIVE level (monsterTypes.js / bosses.js `level`). A map may move its
// monsters to a new level band (`levelBand` in map data, used from L2); progression/levelScaling.js then scales them so
// the FIGHT FEELS THE SAME against a player of that level:
//   hp, def  × P(new) / P(native)   P = expected player damage at a level (class atk growth)
//   power    × H(new) / H(native)   H = expected player max HP at a level
//   exp      × E(new) / E(native) × slope   E = EXP to next level (data/levels.js); slope = new levels per native level
//            -> the same number of kills per level as before, even though the band is wider.
// Difficulty is then set by map / route modifiers (B harder than A), not by the level number itself.
export const LEVEL_SCALING = {
  // average tier-1 class at level 1 and per level (base / perLevel in skills/*.js × LEVELS.statGrowth)
  player: { atk: 20, atkPerLevel: 1.5, hp: 240, hpPerLevel: 12 },
  // floor for scale factors (a monster moved DOWN in level never becomes trivial)
  minMult: 0.5,
  // party scaling (future party system, spec: B3 boss must be party-ready): × per extra party member
  party: { hp: 0.75, poise: 0.5 },
};
