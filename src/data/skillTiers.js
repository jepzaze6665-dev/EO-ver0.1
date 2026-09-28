// SKILL COMMITMENT TIERS (Combat 2.0 §41, §56-57) — there is no Heavy Attack button: commitment lives in skills.
// Every class skill names a `tier`; the tier sets the default stamina cost and the limits its action must respect
// (checked by T.tierCheck in the real game). Basic attacks are always low commitment and cost no stamina.
//
//  label    : UI (skill tooltip / Skills tab)
//  stamina  : default stamina cost (a skill's own `stamina` overrides; 0 = free, e.g. a special paid by marks)
//  maxDur   : longest action (seconds) — fast skills get you moving again quickly
//  maxCancel: latest point a dodge may cancel it (`cancelAt`) — high-impact skills cannot be cancelled at all
//  superArmor: high-impact skills cannot be interrupted once started (you committed, so did the game)
export const SKILL_TIERS = {
  fast: { label: 'FAST', color: '#9af8ff', stamina: 6, maxDur: 0.45, maxCancel: 0.35 },
  medium: { label: 'MEDIUM', color: '#ffd070', stamina: 12, maxDur: 0.7, maxCancel: 0.45 },
  high: { label: 'HIGH IMPACT', color: '#ff80c0', stamina: 25, minDur: 0.6, superArmor: true },
};

// stamina a skill costs (its own value, else its tier's default, else 0)
export function staminaCost(skill) {
  if (!skill) return 0;
  if (skill.stamina !== undefined) return skill.stamina;
  const t = SKILL_TIERS[skill.tier];
  return t ? t.stamina : 0;
}

// pure: does an action (what cast() returned) respect its skill's tier? -> list of problems ([] = ok)
export function tierProblems(skill, action) {
  const t = SKILL_TIERS[skill.tier], out = [];
  if (!t) return [`unknown tier "${skill.tier}"`];
  if (!action) return out; // hold skills (a guard) have no action timeline
  if (t.maxDur && action.dur > t.maxDur) out.push(`dur ${action.dur} > ${t.maxDur}`);
  if (t.maxCancel !== undefined && (action.cancelAt ?? 0) > t.maxCancel) out.push(`cancelAt ${action.cancelAt} > ${t.maxCancel}`);
  if (t.minDur && action.dur < t.minDur) out.push(`dur ${action.dur} < ${t.minDur}`);
  if (t.superArmor && !action.superArmor) out.push('needs superArmor');
  return out;
}
