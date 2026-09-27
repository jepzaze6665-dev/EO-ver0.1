import { LEVELS } from '../data/levels.js';

// EXPERIENCE (pure): level / EXP math. No DOM, no game object — easy to test and to move to a server later.

const clampLevel = (lv, rules) => Math.max(1, Math.min(rules.maxLevel, Math.floor(Number(lv) || 1)));

// EXP needed to go from `level` to `level + 1` (0 at the cap)
export function expToNext(level, rules = LEVELS) {
  const lv = clampLevel(level, rules);
  if (lv >= rules.maxLevel) return 0;
  if (rules.table && rules.table[lv] != null) return rules.table[lv];
  const n = lv - 1, e = rules.exp;
  return Math.round(e.base + e.linear * n + e.quad * n * n);
}

// Adds EXP and returns the new state: { level, exp, levelsGained }. Negative / invalid amounts are ignored.
export function addExp(level, exp, amount, rules = LEVELS) {
  let lv = clampLevel(level, rules);
  let xp = Math.max(0, Number(exp) || 0) + Math.max(0, Number(amount) || 0);
  let levelsGained = 0;
  while (lv < rules.maxLevel && xp >= expToNext(lv, rules)) {
    xp -= expToNext(lv, rules);
    lv++; levelsGained++;
  }
  if (lv >= rules.maxLevel) xp = 0; // nothing to fill at the cap
  return { level: lv, exp: Math.floor(xp), levelsGained };
}

// Repairs a loaded / edited state (old saves, bad data): level in range, 0 <= exp < expToNext
export function normalize(level, exp, rules = LEVELS) {
  return addExp(level, exp, 0, rules);
}

// Level-based stat bonus for a class: perLevel * (level - 1) * statGrowth
export function levelStats(perLevel, level, rules = LEVELS) {
  const k = (clampLevel(level, rules) - 1) * rules.statGrowth, out = {};
  for (const [stat, v] of Object.entries(perLevel || {})) out[stat] = v * k;
  return out;
}
