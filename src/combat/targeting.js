import { ATTACK_SLOTS } from '../data/attackSlots.js';

// ENEMY TARGETING (Combat 2.0 §64) — pure: which player should this enemy fight? Weights: data/attackSlots.js.
// Works on a list of players (solo = a list of one), so the party version needs no AI changes.
export function scoreTarget(enemy, player, rules = ATTACK_SLOTS.targeting) {
  if (!player || player.dead) return -Infinity;
  const st = player.status;
  let s = Math.hypot(player.x - enemy.x, player.y - enemy.y) * rules.perPx;
  const taunter = enemy.status && enemy.status.get && enemy.status.get('taunted');
  if (taunter && taunter.source === player) s += rules.taunt;
  if (enemy.target === player) s += rules.current;
  if (st && (st.has('guard_broken') || st.has('stun'))) s += rules.vulnerable;
  if (player.maxHp && player.hp / player.maxHp < 0.35) s += rules.lowHp;
  const ranged = player.cls && player.cls.ratings && player.cls.ratings.range >= 4;
  if (ranged && enemy.def && enemy.def.role === 'skirmisher') s += rules.ranged;
  return s;
}
export function pickTarget(enemy, players, rules = ATTACK_SLOTS.targeting) {
  let best = null, bestS = -Infinity;
  for (const p of players) { const s = scoreTarget(enemy, p, rules); if (s > bestS) { bestS = s; best = p; } }
  return best;
}
