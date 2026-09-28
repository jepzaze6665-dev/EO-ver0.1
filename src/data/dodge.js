// DODGE RULES (Combat 2.0 §43-44) — SPACE dodge + Perfect Dodge. Stamina cost: data/stamina.js.
//
//  time, dist        : the dash (seconds, pixels) — direction = movement input, else the aim
//  iframes           : invulnerable seconds from the start of the dodge (a little longer than the dash)
//  recovery          : after the dash, this long before the next dodge / attack / skill (small, "clean recovery")
//  perfectWindow     : an attack that lands within this many seconds of pressing SPACE (while invulnerable) = PERFECT
//  perfectCooldown   : seconds before another Perfect Dodge can trigger (no multi-proc from one AoE)
//  slowMo            : [time scale, real seconds] of the Perfect Dodge slow motion
//  perfectDefault    : rewards for classes without their own `perfectDodge` data
//
// Class rewards (class data `perfectDodge`): { marks, resource, stamina, cooldownCut, statuses: [{ id, dur, mult? }] }
//   marks: class mark stacks · resource: primary resource (raw) · stamina: refund · cooldownCut: seconds off every skill
// A class may still add behaviour in `onPerfectDodge(p, g, attacker)` (runs after the data rewards).
export const DODGE = {
  time: 0.24, dist: 100, iframes: 0.28, recovery: 0.08,
  perfectWindow: 0.2, perfectCooldown: 0.5,
  slowMo: [0.3, 0.45],
  perfectDefault: { cooldownCut: 0.5, stamina: 10 },
};

// pure: is this dodge-avoided hit a Perfect Dodge?
export function isPerfectDodge(now, dodgeStart, perfectCooldownLeft, bonusWindow = 0) {
  return perfectCooldownLeft <= 0 && now - dodgeStart >= 0 && now - dodgeStart <= DODGE.perfectWindow + bonusWindow;
}
