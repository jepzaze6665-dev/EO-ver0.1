// SKILL MODIFIERS (Skill System S6) — equipment / runes / charms / relics change SKILLS through data, never code.
// Item data (items.js):
//   skillModifiers: [
//     { skillId: 'shadow_slash', stat: 'damage',       operation: 'MULTIPLY', value: 1.10 },
//     { skillId: 'shadow_slash', stat: 'resourceGain', operation: 'ADD',      value: 5 },     // +5 resource per cast that hits
//     { skillId: 'shade_step',   stat: 'charges',      operation: 'ADD',      value: 1 },
//     { skillId: 'eclipse_sever', stat: 'cooldown',    operation: 'MULTIPLY', value: 0.9 },
//     { tag: 'shadow', stat: 'damage', operation: 'MULTIPLY', value: 1.05 },                   // every skill with that tag
//   ]
// Stats: damage (power) · area · cooldown · cost · charges · resourceGain · duration (values.durationMult for class code)
// Collected by Equipment.applyTo into player.mods.skillModifiers; applied in Player.skillMods on top of skill level,
// evolution and mastery. Pure: no DOM, no game.

export const MOD_STATS = {
  damage: 'power', area: 'area', cooldown: 'cooldown', cost: 'cost',
  charges: 'charges', resourceGain: 'resourceGain', duration: 'durationMult',
};
// limits so stacked gear never breaks a skill
export const MOD_LIMITS = { cooldown: 0.4, cost: 0.3, maxExtraCharges: 2 };

export function matches(mod, skill) {
  if (mod.skillId) return mod.skillId === skill.id;
  if (mod.tag) return (skill.tags || []).includes(mod.tag);
  return false;
}

// mods = { power, area, cooldown, cost, ... } from skill level / evolution / mastery -> the same shape + gear
export function applySkillModifiers(mods, list, skill) {
  const out = { ...mods, charges: mods.charges || 0, resourceGain: mods.resourceGain || 0, values: { ...(mods.values || {}) }, gear: [] };
  for (const m of list || []) {
    if (!matches(m, skill) || !MOD_STATS[m.stat]) continue;
    const key = MOD_STATS[m.stat];
    if (key === 'durationMult') {
      const cur = out.values.durationMult ?? 1;
      out.values.durationMult = m.operation === 'ADD' ? cur + m.value : cur * m.value;
    } else if (m.operation === 'ADD') out[key] = (out[key] ?? (key === 'charges' || key === 'resourceGain' ? 0 : 1)) + m.value;
    else out[key] = (out[key] ?? 1) * m.value;
    out.gear.push(m);
  }
  out.cooldown = Math.max(MOD_LIMITS.cooldown, out.cooldown);
  out.cost = Math.max(MOD_LIMITS.cost, out.cost);
  out.charges = Math.min(MOD_LIMITS.maxExtraCharges, out.charges);
  return out;
}

// readable line for tooltips: "Shadow Slash damage ×1.10"
export function describe(mod, nameOf = (id) => id) {
  const who = mod.skillId ? nameOf(mod.skillId) : `${mod.tag} skills`;
  const v = mod.operation === 'MULTIPLY'
    ? `${mod.value >= 1 ? '+' : '-'}${Math.round(Math.abs(mod.value - 1) * 100)}%`
    : `${mod.value >= 0 ? '+' : ''}${mod.value}`;
  const stat = { damage: 'damage', area: 'size', cooldown: 'cooldown', cost: 'cost', charges: 'charge(s)', resourceGain: 'resource on hit', duration: 'duration' }[mod.stat] || mod.stat;
  return `${who}: ${v} ${stat}`;
}
