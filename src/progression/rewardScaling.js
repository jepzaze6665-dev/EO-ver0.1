import { LEVEL_SCALING } from '../data/levelScaling.js';
import { scaleFor } from './levelScaling.js';

// REWARD SCALING (Level rework L4, pure): quest / secret EXP was written for the old levels. Each quest / secret names
// [nativeLevel, newLevel] in data/levelScaling.js (questLevels / hiddenLevels); its EXP follows like monster EXP
// (× EXP-to-next ratio × band slope), so a quest keeps being worth the same share of a level.
function scaled(exp, pair) {
  if (!(exp > 0) || !pair) return exp || 0;
  const [native, level, slope = 1] = pair;
  return Math.round(exp * scaleFor(native, level, slope).exp);
}
export function questExp(q, r = LEVEL_SCALING) { return scaled(q && q.rewards && q.rewards.exp, q && r.questLevels[q.id]); }
export function hiddenExp(h, r = LEVEL_SCALING) { return scaled(h && h.reward && h.reward.exp, h && r.hiddenLevels[h.id]); }
