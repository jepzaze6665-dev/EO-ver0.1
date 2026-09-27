// LEVEL DATA — every number about levels lives here, never in the game loop.
// progression/experience.js reads these rules; the Player only asks it "how much EXP for the next level?".
//
//  start.level / start.gold : a new character
//  maxLevel                 : level cap (EXP stops at the cap)
//  exp                      : EXP needed to go from level L to L+1 = base + linear*(L-1) + quad*(L-1)^2
//                             (L1 60 · L2 95 · L3 140 · L5 260 · L10 735 · L29 4820)
//  table                    : optional per-level override { [level]: exp } (wins over the formula)
//  statGrowth               : multiplier on each class's `perLevel` stats (class data stays untouched)
//                             class `base` stats = the character at level 1
//  levelUp.restoreHp        : refill HP on level up
//  levelUp.resource         : 'max' fill the class resource · 'respawn' raise it to its respawn value · 'none'
//  expSources               : EXP for exploration events (monsters / bosses use their own expReward,
//                             quests their reward.exp)
export const LEVELS = {
  start: { level: 1, gold: 120 },
  maxLevel: 30,
  exp: { base: 60, linear: 30, quad: 5 },
  table: {},
  statGrowth: 0.35,
  levelUp: { restoreHp: true, resource: 'respawn' },
  expSources: { secretFound: 60, areaDiscovered: 10, loreFound: 25 },
};
