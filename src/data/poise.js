// POISE RULES (Combat 2.0 §48) — how much punishment an enemy takes before it STAGGERS.
// combat/poiseSystem.js (Poise) reads these; monsters / bosses only say their `poise` max (monsterTypes.js / bosses.js).
//
//  regenDelay      : seconds without poise damage before it refills
//  regenRate       : share of max poise refilled per second after the delay
//  breakImmunity   : seconds after a break in which poise cannot break again (no stun-lock, "not constantly stagger")
//  breakTime       : how long a broken monster is interrupted (bosses use their own weak window instead)
//  heavyArmor      : poise damage × this while a monster winds up a heavy attack (commit to punish it after)
//  counterMult     : poise damage × this against a target inside a Counter Window (data/counter.js)
//  bigMult         : poise damage × this for `big` hits (ultimates, bursts)
export const POISE = {
  monster: { regenDelay: 2.0, regenRate: 0.5, breakImmunity: 2.5, breakTime: 0.5, heavyArmor: 0.5 },
  boss: { regenDelay: 3.0, regenRate: 0.08, breakImmunity: 0, breakTime: 0, heavyArmor: 1 },
  counterMult: 1.5,
  bigMult: 1.2,
  defaultHit: 5,        // poise damage of a hit that names no `stagger`
};
