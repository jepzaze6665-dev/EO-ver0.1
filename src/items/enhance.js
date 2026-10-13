// GEAR ENHANCEMENT (pure) — rules in data/enhance.js. An instance carries `plus` (0..10; missing = 0).
import { ENHANCE } from '../data/enhance.js';

export const plusOf = (inst) => Math.max(0, Math.min(ENHANCE.max, Math.floor((inst && inst.plus) || 0)));
export function enhanceCost(def, plus) {
  if (!def || plus >= ENHANCE.max) return null;
  const base = ENHANCE.baseGold[def.rarity] ?? ENHANCE.baseGold.rare;
  return { gold: Math.round(base * Math.pow(plus + 1, ENHANCE.goldPow)), mats: { ...ENHANCE.mats[plus] }, chance: ENHANCE.chance[plus] };
}
// the item's modifiers at this plus: good (positive) values grow, minus ones stay
export function enhancedModifiers(mods, plus) {
  if (!plus) return mods;
  const k = 1 + ENHANCE.perPlus * plus;
  return mods.map((m) => (m.value > 0 ? { ...m, value: m.value * k } : m));
}
// one try: { ok, plus (after), dropped }
export function rollEnhance(plus, rng = Math.random) {
  if (plus >= ENHANCE.max) return { ok: false, plus, dropped: false };
  if (rng() < ENHANCE.chance[plus]) return { ok: true, plus: plus + 1, dropped: false };
  const dropped = plus >= ENHANCE.failDropFrom;
  return { ok: false, plus: dropped ? plus - 1 : plus, dropped };
}
