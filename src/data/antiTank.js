// ANTI-TANKING RULES (Combat 2.0 §52, §68) — standing in front of enemies and eating hits must be dangerous, but one
// mistake must never be instant death. "PLAY BETTER", not "MEMORIZE PERFECTLY OR DIE".
//
// PLAYER POISE (combat/poiseSystem.js, same Poise class as enemies): every hit you take wears it down; at 0 you are
// STAGGERED (status 'staggered': cannot act) and EXPOSED (status 'exposed': take more damage) for a moment.
//  poise         : { max, regenDelay, regenRate, breakImmunity } — regenerates fast once you stop getting hit
//  hitPoise      : poise a hit removes = damage share of max HP × perHpShare, clamped to [min, max]
//                  (max < poise.max: no single hit ever staggers you)
//  heavyBonus    : extra poise damage from guardBreak / heavy attacks
//  staggerTime   : seconds of 'staggered'        exposedTime : seconds of 'exposed'
//  knock         : extra knockback when staggered (position disruption)
// ENDURE: a hit taken at >= `endure.fromHp` of max HP leaves at least 1 HP (no one-shots from healthy).
export const ANTI_TANK = {
  poise: { max: 100, regenDelay: 1.6, regenRate: 0.6, breakImmunity: 3, breakTime: 0, heavyArmor: 1 },
  hitPoise: { perHpShare: 300, min: 20, max: 45 }, // ~5 ordinary hits or 2 heavy ones in a row -> stagger
  heavyBonus: 15,
  staggerTime: 0.6,
  exposedTime: 2.5,
  knock: 220,
  endure: { fromHp: 0.9 },
};
