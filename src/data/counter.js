// COUNTER WINDOW RULES (Combat 2.0 §47) — after the player beats an attack, the attacker is open for a moment.
// combat/counterSystem.js reads this; it never names a class or a monster.
//
//  status     : the status put on the attacker (data/statuses.js 'counter_window': less DEF, more damage taken)
//  sources    : seconds of window per way of beating the attack
//      perfectDodge : Perfect Dodge (attackDodged perfect)      parry : perfect guard (Aegis 'perfectGuard')
//      whiff        : a normal dodge made the attack miss
//  bossMult   : bosses / elites get shorter windows (they have their own weak windows)
//  firstHitText : feedback on the first hit that lands inside a window
//
// Class rewards (class data `counterBonus`): { marks, resource } — given once per window, on the first counter hit.
// Skill / hitbox data may set `counterMult` (e.g. 1.3): extra power against a target inside its counter window.
export const COUNTER = {
  status: 'counter_window',
  sources: { perfectDodge: 1.6, parry: 2.0, whiff: 0.8 },
  bossMult: 0.6,
  firstHitText: 'COUNTER!',
};

// pure: how long a window this event opens on this target (0 = none)
export function counterDuration(reason, target) {
  const base = COUNTER.sources[reason] || 0;
  if (!base || !target || target.dead || !target.status) return 0;
  return target.isBoss || target.elite ? base * COUNTER.bossMult : base;
}
