// POWER — one number that sums up how strong a character is right now (character window, later party / matchmaking).
// Pure: reads the final stats (base + level + items) the player already has. Display only: no system depends on it.
// Weights: 1 ATK ≈ 6 HP ≈ 1.5 DEF; percent stats count as fractions of ATK (crit 30% of ATK ≈ +0.3 × ATK × weight).
export const POWER_WEIGHTS = { hp: 0.5, atk: 3, def: 2, crit: 3, critDmg: 1.5, cdr: 4, attackSpeed: 2.5, dmg: 2 };

export function powerOf(stats = {}, maxHp = stats.hp || 0) {
  const w = POWER_WEIGHTS, atk = stats.atk || 0;
  const dmgPct = (stats.physicalDmg || 0) + (stats.shadowDmg || 0) + (stats.lightningDmg || 0) + (stats.voidDmg || 0) + (stats.lightDmg || 0);
  const offence = atk * w.atk * (1 + (stats.crit || 0) * w.crit * 0.5 * (1 + (stats.critDmg || 0)) / 1.5 + (stats.cdr || 0) * w.cdr * 0.25
    + (stats.attackSpeed || 0) * w.attackSpeed * 0.25 + dmgPct * w.dmg * 0.25);
  return Math.round(maxHp * w.hp + (stats.def || 0) * w.def + offence);
}

export const playerPower = (p) => powerOf(p.stats || {}, p.maxHp);
