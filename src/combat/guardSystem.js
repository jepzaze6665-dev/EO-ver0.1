// GUARD SYSTEM — generic blocking (Aegis Guardian today; Warden of Dawn, Bulwark Sentinel... tomorrow).
// Pure rule: given the class guard data, the defender's guard state and where the hit comes from,
// decide whether the hit is blocked, perfectly blocked, or goes through. No DOM, no game refs.
//
// class data: guard: { arc, reduction, perfectWindow, moveMul, recover }
//   arc           : half-angle (radians) in front of the defender that the guard covers
//   reduction     : share of damage removed by a normal block (0..0.95)
//   perfectWindow : seconds after raising the guard in which a block is PERFECT (no damage + counter)
//   recover       : seconds after lowering the guard before it can be raised again (no perfect-spam)
export const GUARD_RULES = { maxReduction: 0.95, maxArc: Math.PI * 0.95, maxPerfectWindow: 0.35 };

const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// state: { active, since }   facing: radians   dx, dy: vector defender -> attacker   now: seconds
export function evaluateBlock(guard, state, facing, dx, dy, now) {
  if (!guard || !state || !state.active) return null;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return null;
  const arc = Math.min(GUARD_RULES.maxArc, Math.max(0, guard.arc || 0));
  if (Math.abs(wrap(Math.atan2(dy, dx) - facing)) > arc) return null; // from behind / the side: not covered
  const win = Math.min(GUARD_RULES.maxPerfectWindow, Math.max(0, guard.perfectWindow || 0));
  const perfect = now - state.since <= win;
  const red = Math.min(GUARD_RULES.maxReduction, Math.max(0, guard.reduction || 0));
  return { perfect, mult: perfect ? 0 : 1 - red };
}
