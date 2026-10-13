// GEAR ENHANCEMENT (owner 2026-10-13: "too much gold, nothing to spend it on") — the smith raises ONE gear copy (instance)
// from +0 to +10. Each step costs gold + materials, may FAIL (gold + materials spent), and from FAIL_DROP_FROM a failure
// also takes one level away. Every + adds PER_PLUS to the item's GOOD modifiers (minus modifiers stay as they are).
// Pure rules: src/items/enhance.js.
export const ENHANCE = {
  max: 10,
  perPlus: 0.05,                    // +10 = good modifiers ×1.5
  baseGold: { common: 40, uncommon: 60, rare: 100, epic: 160, legendary: 250, mythic: 400 },
  goldPow: 1.6,                     // gold = base × (target level) ^ goldPow  (legendary +10 ≈ 10 000 G)
  chance: [1, 1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3], // index = current plus -> plus + 1
  failDropFrom: 5,                  // a failure at +5 or higher drops one level
  // materials per step (index = current plus)
  mats: [
    { crystal_shard: 1 }, { crystal_shard: 2 }, { crystal_shard: 3 }, { crystal_shard: 4 }, { moon_crystal: 1 },
    { moon_crystal: 2 }, { moon_crystal: 2, crystal_shard: 4 }, { moon_crystal: 3 }, { moon_crystal: 4 }, { moon_crystal: 5 },
  ],
};
