// ITEM DEFINITIONS (pure) — fills the standard item fields and checks item data. No game, no DOM.
// Every item ends up with: id, name, type, rarity, description, tags, allowedClasses, modifiers, effects
// (+ the older display fields cat / desc / icon / color / slot that the UI and equipment still read).
import { CLASS_TREE } from '../data/classTree.js';
import { STATUSES } from '../data/statuses.js';
import { GEAR_TYPES, RARITIES, UNIQUE_RARITIES, ANY_CLASS, LINE_PREFIX, MODIFIER_TYPES, TRIGGERS, CONDITIONS, EFFECT_TYPES, PERSISTENCE } from '../data/items/rules.js';

// older gear (written before the item system) -> its type, from its slot. Accessories name their own type.
const TYPE_FROM_SLOT = { weapon: 'weapon_core', armor: 'armor_core' };
// type -> inventory category tab (Inventory window). Which loadout slot an item takes = its type (rules GEAR_SLOTS).
const CAT_OF_TYPE = { weapon_core: 'Weapon', armor_core: 'Armor', relic: 'Armor', charm: 'Armor', rune: 'Armor' };

export const isGearType = (type) => GEAR_TYPES.includes(type);
export const isGear = (def) => !!def && isGearType(def.type);

// fills missing standard fields IN PLACE (the item tables are built once at load) and returns the item
export function normalizeItem(id, def) {
  def.id = id;
  if (!def.type && def.slot) def.type = TYPE_FROM_SLOT[def.slot] || null;
  if (!def.type) def.type = (def.cat || 'misc').toLowerCase().replace(/ /g, '_'); // consumable / material / quest_item
  if (!def.cat) def.cat = CAT_OF_TYPE[def.type] || 'Material';
  if (def.description == null) def.description = def.desc || '';
  if (def.desc == null) def.desc = def.description;
  if (!def.tags) def.tags = [];
  if (!def.allowedClasses) def.allowedClasses = [ANY_CLASS];
  if (!def.modifiers) def.modifiers = [];
  if (!def.effects) def.effects = [];
  if (def.dropSource == null) def.dropSource = null;
  if (def.levelRequirement == null) def.levelRequirement = 0; // character level needed to equip (0 = none)
  if (def.setId == null) def.setId = null; // item set (data/items/sets.js)
  if (!def.persistence) def.persistence = isGear(def) || def.type === 'quest_item' ? PERSISTENCE.PERMANENT : PERSISTENCE.NORMAL;
  return def;
}

// soul-like death rule (future dungeons): only DUNGEON LOOT may be lost; equipment never
export const lostOnDeath = (def) => !!def && def.persistence === PERSISTENCE.DUNGEON;

// may this class equip it? (the core never names a class: it only compares ids from the data)
// tier-1 class a class grows from (classTree parent chain; itself for a tier-1 class)
export function classLine(classId) {
  let id = classId;
  for (let i = 0; i < 8 && CLASS_TREE[id] && CLASS_TREE[id].parent; i++) id = CLASS_TREE[id].parent;
  return id;
}
export const canClassUse = (def, classId) => !!def && (def.allowedClasses.includes(ANY_CLASS) || def.allowedClasses.includes(classId)
  || def.allowedClasses.includes(LINE_PREFIX + classLine(classId)));
// is the character level high enough?
export const meetsLevel = (def, level) => !!def && (level || 0) >= (def.levelRequirement || 0);

// one item / set-bonus effect -> list of problems (shared by items and data/items/sets.js)
export function effectProblems(e) {
  const out = [];
  if (!TRIGGERS.includes(e.trigger)) out.push(`trigger "${e.trigger}"`);
  if (e.condition && !CONDITIONS.includes(e.condition.type)) out.push(`condition "${e.condition.type}"`);
  if (!e.effect || !EFFECT_TYPES.includes(e.effect.type)) out.push(`effect "${e.effect && e.effect.type}"`);
  if (!(e.cooldown > 0) && !(e.duration > 0)) out.push(`effect ${e.effect && e.effect.type} needs a cooldown or duration (no endless trigger)`);
  if (!e.text) out.push('effect without text (tooltip)');
  if (e.effect && e.effect.type === 'applyStatus' && !STATUSES[e.effect.status]) out.push(`unknown status "${e.effect.status}"`);
  return out;
}

// data check -> list of problems ([] = fine). classIds: known class ids (optional; skipped when not given).
export function itemProblems(def, classIds = null) {
  const out = [], where = def.id || '?';
  const bad = (m) => out.push(`${where}: ${m}`);
  if (!def.name) bad('no name');
  if (!isGear(def)) return out; // stack items (potions, materials, quest items) only need a name
  if (!RARITIES.includes(def.rarity)) bad(`rarity "${def.rarity}"`);
  if (!def.description) bad('no description');
  if (!Array.isArray(def.tags)) bad('tags must be a list');
  if (!Array.isArray(def.allowedClasses) || !def.allowedClasses.length) bad('allowedClasses empty');
  else if (classIds) for (const c of def.allowedClasses) if (c !== ANY_CLASS && !classIds.includes(c.startsWith(LINE_PREFIX) ? c.slice(LINE_PREFIX.length) : c)) bad(`unknown class "${c}"`);
  if (def.levelRequirement != null && (!Number.isInteger(def.levelRequirement) || def.levelRequirement < 0)) bad(`levelRequirement ${def.levelRequirement}`);
  for (const m of def.modifiers) {
    const rule = MODIFIER_TYPES[m.type];
    if (!rule) { bad(`modifier "${m.type}"`); continue; }
    if (!Number.isFinite(m.value)) bad(`modifier ${m.type} value`);
    else if (m.value < rule.min || m.value > rule.max) bad(`modifier ${m.type} ${m.value} outside ${rule.min}..${rule.max}`);
  }
  for (const e of def.effects) for (const m of effectProblems(e)) bad(m);
  // older gear keeps its unique effect in `mods` / `skillModifiers` until it is converted
  if (UNIQUE_RARITIES.includes(def.rarity) && !def.effects.length && !def.mods && !def.skillModifiers) bad(`${def.rarity} needs a unique effect`);
  if (def.type === 'charm' && def.effects.length) bad('charms carry modifiers only');
  return out;
}
