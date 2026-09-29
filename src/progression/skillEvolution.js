// SKILL EVOLUTION (Skill System S4) — a skill can take ONE of 0-3 evolution branches that change HOW it plays.
// Pure: no DOM, no game loop. The choice is stored in classProgress (per class, per skill: `evolution`), so it
// survives class changes and saves; the original skill data is never modified.
//
// Skill data:
//   evolutions: [{
//     id, name,
//     desc: 'what the skill now DOES (gameplay, not numbers)',
//     changes: { damage, utility, resource, cooldown, behavior },  // short texts for the Evolution panel
//     requirements: { skillLevel, masteryLevel, charLevel?, flag?, item? },
//     power?, area?, cooldown?, cost?,   // × on top of the skill level (core-applied like skill levels)
//     flags?, values?,                   // read by class code (p.skillEvolution(id) / p.skillFlag / p.skillValue)
//   }]
export const EVOLUTION_RULES = {
  maxOptions: 3,
  // spec §7: reverting is only possible if a respec system allows it. Off for now (data switch, S5+ may enable).
  respec: { allowed: false, gold: 0 },
};

export function evolutionsOf(skill) { return (skill && Array.isArray(skill.evolutions) ? skill.evolutions : []).slice(0, EVOLUTION_RULES.maxOptions); }
export function evolutionById(skill, id) { return evolutionsOf(skill).find((e) => e.id === id) || null; }

// ctx: { skillLevel, masteryLevel, charLevel, current (chosen id|null), hasFlag(f), hasItem(id) }
// -> { ok, reason?, missing: [text] }
export function evolutionCheck(skill, evoId, ctx) {
  const evo = evolutionById(skill, evoId);
  if (!evo) return { ok: false, reason: 'unknown', missing: [] };
  if (ctx.current) return { ok: false, reason: ctx.current === evoId ? 'chosen' : 'other_chosen', missing: [] };
  const r = evo.requirements || {}, missing = [];
  if (r.skillLevel && ctx.skillLevel < r.skillLevel) missing.push(`Skill Lv ${r.skillLevel}`);
  if (r.masteryLevel && ctx.masteryLevel < r.masteryLevel) missing.push(`Mastery ${['—', 'I', 'II', 'III', 'IV'][r.masteryLevel] || r.masteryLevel}`);
  if (r.charLevel && ctx.charLevel < r.charLevel) missing.push(`Character LV ${r.charLevel}`);
  if (r.flag && !(ctx.hasFlag && ctx.hasFlag(r.flag))) missing.push(r.flagLabel || `Event: ${r.flag}`);
  if (r.item && !(ctx.hasItem && ctx.hasItem(r.item))) missing.push(r.itemLabel || `Item: ${r.item}`);
  return missing.length ? { ok: false, reason: 'requirements', missing } : { ok: true, missing };
}

// merges an evolution into skill-level mods (numbers multiply, flags / values are added)
export function withEvolution(mods, evo) {
  if (!evo) return mods;
  return {
    ...mods,
    power: mods.power * (evo.power ?? 1), area: mods.area * (evo.area ?? 1),
    cooldown: mods.cooldown * (evo.cooldown ?? 1), cost: mods.cost * (evo.cost ?? 1), charges: (mods.charges || 0) + (evo.charges || 0),
    flags: { ...mods.flags, ...(evo.flags || {}) }, values: { ...mods.values, ...(evo.values || {}) },
    evolution: evo.id,
  };
}
