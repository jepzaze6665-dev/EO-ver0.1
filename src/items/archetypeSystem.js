// BUILD ARCHETYPE SYSTEM (pure, Character Build B1) — how many points a build has in each archetype (data/archetypes.js)
// and which tier bonuses that turns on. No game, no DOM.
//   itemArchetypes(def)                    -> archetype ids one item counts for
//   archetypePoints(itemIds, evoArchetypes) -> { id: { points, items, evolutions } }
//   activeArchetypeBonuses(points)         -> [{ id, arch, points, tier, key }]
//   archetypeSummary(points)               -> UI rows sorted by points
//   archetypeProblems()                    -> data check
// Equipment adds the active modifiers to its ModifierSet; ItemEffectSystem indexes the active effects (like set bonuses).
import { ITEMS } from './items.js';
import { ARCHETYPES, ARCHETYPE_RULES } from '../data/archetypes.js';
import { MODIFIER_TYPES } from '../data/items/rules.js';
import { effectProblems } from './itemDefs.js';

export function itemArchetypes(def, archetypes = ARCHETYPES) {
  if (!def) return [];
  if (Array.isArray(def.archetypes)) return def.archetypes.filter((id) => archetypes[id]);
  const tags = def.tags || [];
  return Object.entries(archetypes).filter(([, a]) => a.tags.some((t) => tags.includes(t))).map(([id]) => id);
}

// itemIds: worn item ids (each id counts once) · evoArchetypes: archetype ids of the chosen evolutions (repeats count)
export function archetypePoints(itemIds = [], evoArchetypes = [], items = ITEMS, archetypes = ARCHETYPES) {
  const out = {};
  const row = (id) => (out[id] ||= { points: 0, items: 0, evolutions: 0 });
  for (const id of new Set(itemIds.filter(Boolean))) {
    for (const a of itemArchetypes(items[id], archetypes)) { const r = row(a); r.points += 1; r.items += 1; }
  }
  for (const a of evoArchetypes) {
    if (!archetypes[a]) continue;
    const r = row(a); r.points += ARCHETYPE_RULES.evolutionPoints; r.evolutions += 1;
  }
  return out;
}

export function activeArchetypeBonuses(points, archetypes = ARCHETYPES) {
  const out = [];
  for (const [id, r] of Object.entries(points)) {
    const arch = archetypes[id];
    if (!arch) continue;
    for (const tier of arch.tiers) if (r.points >= tier.points) out.push({ id, arch, points: r.points, tier, key: `arch:${id}:${tier.points}` });
  }
  return out;
}

// [{ id, name, color, points, items, evolutions, focus, next (points of the next tier | null), tiers: [{ points, text, on }] }]
export function archetypeSummary(points, archetypes = ARCHETYPES) {
  return Object.entries(points).filter(([id, r]) => archetypes[id] && r.points > 0).map(([id, r]) => {
    const a = archetypes[id], nextTier = a.tiers.find((t) => r.points < t.points);
    return { id, name: a.name, color: a.color, points: r.points, items: r.items, evolutions: r.evolutions,
      focus: r.points >= ARCHETYPE_RULES.focusAt, next: nextTier ? nextTier.points : null,
      tiers: a.tiers.map((t) => ({ points: t.points, text: t.text, on: r.points >= t.points })) };
  }).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

// short build name for the UI: the top archetype(s) in focus, e.g. "Bleed / Critical"
export function buildName(points, archetypes = ARCHETYPES) {
  const s = archetypeSummary(points, archetypes).filter((r) => r.focus);
  return s.length ? s.slice(0, 2).map((r) => r.name).join(' · ') : null;
}

export function archetypeProblems(archetypes = ARCHETYPES) {
  const out = [];
  for (const [id, a] of Object.entries(archetypes)) {
    const bad = (m) => out.push(`archetype ${id}: ${m}`);
    if (!a.name) bad('no name');
    if (!Array.isArray(a.tags) || !a.tags.length) bad('no tags');
    if (!Array.isArray(a.tiers) || !a.tiers.length) { bad('no tiers'); continue; }
    let last = 0;
    for (const t of a.tiers) {
      if (!Number.isInteger(t.points) || t.points <= last) bad(`tier points ${t.points} (must rise)`);
      last = t.points;
      if (!t.text) bad('tier without text');
      if (!(t.modifiers || []).length && !(t.effects || []).length) bad(`tier ${t.points} does nothing`);
      for (const m of t.modifiers || []) if (!MODIFIER_TYPES[m.type] || !Number.isFinite(m.value)) bad(`modifier ${m.type}`);
      for (const e of t.effects || []) out.push(...effectProblems(e).map((m) => `archetype ${id}: ${m}`));
    }
  }
  return out;
}
