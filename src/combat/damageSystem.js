// DAMAGE SYSTEM — pure calculation, no side effects.
// Input is plain data, output is a DamageResult. It never touches the DOM, the renderer,
// audio or global game state, so the exact same code can later run on a server
// (server-authoritative combat) or in unit tests (tools/tests/combat.test.mjs).
//
// attacker: { stats?: {atk, crit, critDmg, shadowDmg, magicDmg, armorBreak,
//                     executeDmg, executeAt, executeType}, damageMult? }
//           — no stats means a "flat" attacker (monsters): the hit's power is the raw damage.
//           execute*: bonus damage against targets below `executeAt` of their max HP (only hits of
//           `executeType` when set) — e.g. a reaper passive. Never applies to damage-over-time ticks.
// target:   { defense?, stats?: {def}, weakness?: [], vulnerable?: bool, armor?: number,
//             damageTakenMult?: number (statuses: curse > 1, damage reduction < 1), defenseMult?: number (Counter Window < 1),
//             hpRatio?: number (hp / maxHp, read by execute bonuses) }
// hit:      { power, type ('physical'|'shadow'|'magic'|...), critBonus?, forceCrit?,
//             breakBonus?, armorBreak?, weakPoint?: bool (attacker is behind the target),
//             flat?: bool (power is raw damage even with an attacker — damage-over-time ticks) }
// roll:     () => number in [0,1)  — injectable so tests and a future server are deterministic

export const DAMAGE_RULES = {
  critBase: 1.6,          // crit multiplier before critDmg bonuses
  weaknessMult: 1.2,
  vulnerableMult: 1.35,   // weak window / exposed core
  weakPointMult: 1.6,
  armorAbsorb: 0.3,       // share of damage that passes through intact armour
  defenseFactor: 0.5,
  variance: 0.08,         // ±8 %
  executeAt: 0.35,        // default "low HP" line for execute bonuses
  minDamage: 1,
};

export function computeDamage(attacker, target, hit, roll = Math.random) {
  const R = DAMAGE_RULES;
  const st = attacker && attacker.stats;
  const tags = [];
  let amount, crit = false, armorDamage = 0;
  // invalid numbers (NaN, ±Infinity, negatives) are bad data: treat as 0, never as a default
  const num = (v, dflt) => (v === undefined ? dflt : Number.isFinite(v) ? Math.max(0, v) : 0);
  const power = num(hit.power, st && !hit.flat ? 1 : 10);

  if (st && !hit.flat) {
    amount = power * num(st.atk, 0);
    // type bonus: stats.<type>Dmg (e.g. shadowDmg, magicDmg) — no class names in the core
    const typeBonus = st[(hit.type || 'physical') + 'Dmg'] || 0;
    amount *= 1 + typeBonus;
    amount *= attacker.damageMult || 1;
    if (st.executeDmg > 0 && !hit.dot && target.hpRatio < (st.executeAt || R.executeAt) && (!st.executeType || st.executeType === (hit.type || 'physical'))) {
      amount *= 1 + st.executeDmg;
      tags.push('execute');
    }
    if (hit.forceCrit || roll() < (st.crit || 0) + (hit.critBonus || 0)) { crit = true; amount *= R.critBase + (st.critDmg || 0); }
  } else {
    amount = power;
  }
  if (target.weakness && target.weakness.includes(hit.type)) { amount *= R.weaknessMult; tags.push('weak'); }
  if (target.vulnerable) { amount *= R.vulnerableMult * (hit.breakBonus || 1); tags.push('window'); }
  if (target.armor > 0) {
    if (hit.weakPoint) { amount *= R.weakPointMult; tags.push('weakpoint'); }
    else {
      armorDamage = amount * (hit.armorBreak || 1) * ((st && st.armorBreak) || 1);
      amount *= R.armorAbsorb;
      tags.push('armored');
    }
  }
  amount *= num(target.damageTakenMult, 1);
  const def = (target.defense ?? (target.stats ? target.stats.def : 0) ?? 0) * num(target.defenseMult, 1);
  amount = Math.max(R.minDamage, amount - def * R.defenseFactor);
  amount *= 1 + (roll() * 2 - 1) * R.variance;
  amount = Math.max(R.minDamage, Math.round(amount));
  if (!Number.isFinite(amount)) amount = R.minDamage; // guard: never NaN / Infinity
  return { amount, crit, tags, armorDamage, armorBroken: target.armor > 0 && armorDamage >= target.armor };
}
