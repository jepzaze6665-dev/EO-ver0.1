// GEAR RULES (Character Build B3) — the handlers of data/items/gearRules.js. Pure helpers read by the Player hooks
// (gearHitMult / gearDamageTakenMult / skillMods / tryDodge) + one listener (blood_pact). No class names.
import { GEAR_RULES, GEAR_RULE_LIMITS } from '../data/items/gearRules.js';
import { ITEMS } from './items.js';

// worn item ids -> { type: params (defaults filled) } — the first item naming a rule wins
export function rulesOf(itemIds, items = ITEMS) {
  const out = {};
  for (const id of itemIds) for (const r of (items[id] && items[id].rules) || []) {
    const def = GEAR_RULES[r.type];
    if (def && !out[r.type]) out[r.type] = { ...def.defaults, ...r };
  }
  return out;
}
export const hasRules = (def) => !!(def && Array.isArray(def.rules) && def.rules.length);

// outgoing damage multiplier of the rules (player -> foe)
export function ruleHitMult(rules, p) {
  let m = 1;
  if (rules.reckless) m *= rules.reckless.dealt;
  if (rules.stillness) m *= (p.idleT || 0) >= rules.stillness.still ? rules.stillness.stillMult : rules.stillness.moveMult;
  if (rules.desperation) {
    const share = p.maxHp > 0 ? p.hp / p.maxHp : 1, d = rules.desperation;
    if (share < d.below) m *= d.lowMult; else if (share > d.above) m *= d.highMult;
  }
  return m;
}
export const ruleTakenMult = (rules) => (rules.reckless ? rules.reckless.taken : 1);

// skill mods (cost / cooldown) after every other modifier
export function ruleSkillMods(rules, m) {
  if (!rules.overclock) return m;
  return { ...m, cost: m.cost * rules.overclock.cost, cooldown: Math.max(GEAR_RULE_LIMITS.minCooldownMult, m.cooldown * rules.overclock.cooldown) };
}

// HP a dodge costs under blood_dodge (0 = normal stamina dodge)
export const ruleDodgeHp = (rules, p) => (rules.blood_dodge ? Math.round(p.maxHp * rules.blood_dodge.hp) : 0);

export function ruleProblems(items = ITEMS) {
  const out = [];
  for (const d of Object.values(items)) for (const r of (d && d.rules) || []) if (!GEAR_RULES[r.type]) out.push(`${d.id}: unknown rule ${r.type}`);
  return out;
}

// listeners (game.events is new per session)
export function installGearRules(game) {
  game.events.on('damageDealt', (e) => {
    const p = game.player;
    if (!p || e.source !== p || !(e.amount > 0) || !e.target || e.target.team === p.team || p.dead) return;
    const r = p.gearRules && p.gearRules().blood_pact;
    if (r && p.heal) p.heal(Math.min(e.amount * r.share, p.maxHp * r.capPerHit), 'bloodPact');
  });
}
