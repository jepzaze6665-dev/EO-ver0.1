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
  // ROUTE DIFFICULTY (owner: A easier, B harder and pays more) — map `monsterMod` for field monsters
  routeMod: {
    B: { hp: 1.2, power: 1.2, exp: 1.25, detect: 1.1 },
  },
  // QUEST / SECRET EXP (progression/rewardScaling.js): [level the reward was written for, level it is earned at now, slope]
  // slope = how many new levels one old level became on that map (A1 1.44 · A2 3 · A3 3 · B1 2 · B2 3.5 · B3 3.5)
  questLevels: {
    beyond_lumina: [3, 4, 1.44], first_steps: [2, 3, 1.44], forest_hunts: [8, 11, 1.44], depths: [8, 11, 1.44],
    whispers: [10, 14, 1.44], valley: [10, 14, 1.44], route_a: [10, 14, 3],
    burning_rift: [14, 26, 3], fallen_city: [18, 38, 3], asteria: [18, 38, 1],
    eastern_road: [10, 17, 2], crystal_depths: [14, 31, 3.5], frostpeak_climb: [18, 45, 3.5],
  },
  hiddenLevels: {
    hidden_cave: [6, 8, 1.44], behind_waterfall: [6, 8, 1.44], moonlit_shrine: [7, 10, 1.44], sealed_archive: [8, 11, 1.44],
    valehaven: [10, 14, 1.44],
  },
  // party scaling (future party system, spec: B3 boss must be party-ready): × per extra party member
  party: { hp: 0.75, poise: 0.5 },
};
