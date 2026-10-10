// BUILD PRESETS (Character Build B5) — up to PRESET_RULES.count saved builds PER CLASS: skill loadout (keys 1-4) + gear
// (item id per gear slot). Stored in classProgress (classes[id].presets), so each class keeps its own. Evolutions are a
// permanent choice, not part of a preset. Applying one is only allowed out of combat in a safe map (city).
// Pure helpers here; Player.savePreset / applyPreset do the game side.
import { GEAR_SLOTS, MODIFIER_TYPES } from '../data/items/rules.js';
import { ITEMS } from '../items/items.js';
import { archetypeSummary, buildName } from '../items/archetypeSystem.js';

export const PRESET_RULES = { count: 3, nameMax: 16, safeOnly: true };

// a clean preset from loose data (save files, UI) or null
export function cleanPreset(d) {
  if (!d || typeof d !== 'object') return null;
  const gear = {};
  for (const s of GEAR_SLOTS) { const id = d.gear && d.gear[s.id]; if (typeof id === 'string' && ITEMS[id]) gear[s.id] = id; }
  return {
    name: String(d.name || '').slice(0, PRESET_RULES.nameMax),
    loadout: Array.isArray(d.loadout) ? d.loadout.slice(0, 4).map((x) => (typeof x === 'string' ? x : null)) : null,
    gear,
  };
}
export const cleanPresets = (list) => Array.from({ length: PRESET_RULES.count }, (_, i) => cleanPreset(Array.isArray(list) ? list[i] : null));

// snapshot of the current build
export function capturePreset(name, loadoutSlots, eqSlots) {
  const gear = {};
  for (const s of GEAR_SLOTS) if (eqSlots[s.id]) gear[s.id] = eqSlots[s.id];
  return cleanPreset({ name, loadout: loadoutSlots, gear });
}

// SUMMARY of a build: name, archetype rows, strengths (tier bonuses that are on) and weaknesses (minus modifiers + rule
// texts). points = Equipment.archetypePoints(); itemIds = worn ids.
export function buildSummary(points, itemIds) {
  const rows = archetypeSummary(points);
  const strengths = rows.flatMap((r) => r.tiers.filter((t) => t.on).map((t) => ({ text: t.text, color: r.color, from: r.name })));
  const weaknesses = [];
  const minus = {};
  for (const id of itemIds) {
    const d = ITEMS[id];
    if (!d) continue;
    for (const m of d.modifiers || []) if (m.value < 0 && !(m.type === 'resourceCost')) minus[m.type] = (minus[m.type] || 0) + m.value;
    if (d.ruleText) weaknesses.push({ text: d.ruleText, from: d.name, rule: true });
  }
  for (const [type, v] of Object.entries(minus)) {
    const mt = MODIFIER_TYPES[type];
    weaknesses.push({ label: mt && mt.label ? mt.label : type, pct: Math.round(v * 100), from: 'items' });
  }
  return { name: buildName(points), archetypes: rows, strengths, weaknesses };
}
