// ITEM RULES (data only) — the vocabulary every gear item is written in. Item files (weaponCores.js, relics.js, ...)
// only use names from here; items/itemDefs.js validates them. Adding a new modifier / trigger / condition / effect =
// add its name here first, then the system that runs it (G2 modifiers, G3 effects + conditions).
//
// Item = DEFINITION (this data, shared, never changes) + INSTANCE (one copy a player owns: items/itemInstance.js).
// Items NEVER change the character's sprite: the class owns body, outfit, signature weapon look, animations, VFX.

// gear types (the combat loadout, G2) — other kinds (consumable, material, quest item) stay plain stack items
export const ITEM_TYPE = {
  WEAPON_CORE: 'weapon_core',
  ARMOR_CORE: 'armor_core',
  RELIC: 'relic',
  CHARM: 'charm',
  RUNE: 'rune',
};
export const GEAR_TYPES = Object.values(ITEM_TYPE);
export const TYPE_LABEL = { weapon_core: 'Weapon Core', armor_core: 'Armor Core', relic: 'Relic', charm: 'Charm', rune: 'Rune' };

// PERSISTENCE (soul-like death rule, foundation only — no death item loss is built yet):
//  permanent : never lost on death (all gear: weapon / armor cores, relics, charms, runes; quest items)
//  normal    : ordinary stacks (potions, materials) — kept, as today
//  dungeon   : DUNGEON LOOT, may be dropped on death by the future dungeon system (no item uses it yet)
export const PERSISTENCE = { PERMANENT: 'permanent', NORMAL: 'normal', DUNGEON: 'dungeon' };

// rarity = how rare, NOT "bigger numbers": a legendary / mythic carries a unique effect (validated: they need effects)
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const UNIQUE_RARITIES = ['legendary', 'mythic'];

// allowedClasses: ['all'], class ids (src/skills/classes.js) and/or 'line:<tier-1 class id>' = that class and every class
// that grows from it (data/classTree.js parent chain), e.g. 'line:umbral_sword' = Umbral, Reaper, Duskrunner, Echoes.
// The core never names a class.
export const ANY_CLASS = 'all';
export const LINE_PREFIX = 'line:';

// MODIFIERS — stat changes while the item is equipped. items/modifierSystem.js sums them per type (stacking rule),
// caps the total, then builds the FINAL stats from a copy of the base stats (base stats are never edited).
//  stat      : the player stat it changes (player.stats key); null = read by a system through getModifierValue
//  apply     : 'mult' = stat × (1 + total) (scales with the level) | 'add' = stat + total (stats that already are shares)
//  stacking  : 'additive' (total = sum) | 'multiplicative' (total = (1 + a)(1 + b)... - 1: many small items add up slower)
//  min / max : cap on the TOTAL of all items (no infinite defense / negative cooldowns / 100% damage reduction)
//  label     : name shown in the UI
//  unit      : 'pct' (default: the value is a share, shown +15%) | 'flat' (points, shown +20 — resourceMax)
// Damage per type = stat '<type>Dmg' read by combat/damageSystem.js (physicalDmg, shadowDmg, magicDmg ...): Astral skills
// are 'magic' hits, so ASTRAL damage = magicDamage (also covers shadow / light / void ... — see MAGIC_DAMAGE_TYPES).
export const MODIFIER_TYPES = {
  maxHP:              { stat: 'hp',           apply: 'mult', stacking: 'additive',       min: -0.5, max: 1,   label: 'Max HP' },
  defense:            { stat: 'def',          apply: 'mult', stacking: 'additive',       min: -0.6, max: 1,   label: 'Defense' },
  attack:             { stat: 'atk',          apply: 'mult', stacking: 'additive',       min: -0.5, max: 1,   label: 'Attack' },
  magicDamage:        { stat: null,                          stacking: 'additive',       min: -0.5, max: 1,   label: 'Magic Damage' },
  movementSpeed:      { stat: 'speed',        apply: 'mult', stacking: 'multiplicative', min: -0.4, max: 0.4, label: 'Movement Speed' },
  cooldownReduction:  { stat: 'cdr',          apply: 'add',  stacking: 'additive',       min: -0.3, max: 0.3, label: 'Cooldown Reduction' },
  resourceGeneration: { stat: null,                          stacking: 'additive',       min: -0.5, max: 1,   label: 'Resource Generation' },
  resourceCost:       { stat: null,                          stacking: 'additive',       min: -0.4, max: 1,   label: 'Resource Cost' },
  barrierStrength:    { stat: 'barrierPower', apply: 'add',  stacking: 'additive',       min: -0.5, max: 1,   label: 'Barrier Strength' },
  guardGeneration:    { stat: null,                          stacking: 'additive',       min: -0.5, max: 1.5, label: 'Guard Generation' },
  counterDamage:      { stat: null,                          stacking: 'additive',       min: -0.5, max: 1,   label: 'Counter Damage' },
  aggro:              { stat: null,                          stacking: 'additive',       min: -0.9, max: 2,   label: 'Aggro' },
  tauntPower:         { stat: null,                          stacking: 'additive',       min: -0.5, max: 1,   label: 'Taunt Power' },
  damageReduction:    { stat: null,                          stacking: 'additive',       min: -0.5, max: 0.4, label: 'Damage Reduction' },
  // offense / utility (I1) — all stats the combat code already reads
  critChance:         { stat: 'crit',         apply: 'add',  stacking: 'additive',       min: -0.2, max: 0.3, label: 'Critical Chance' },
  critDamage:         { stat: 'critDmg',      apply: 'add',  stacking: 'additive',       min: -0.5, max: 0.8, label: 'Critical Damage' },
  physicalDamage:     { stat: 'physicalDmg',  apply: 'add',  stacking: 'additive',       min: -0.5, max: 0.6, label: 'Physical Damage' },
  shadowDamage:       { stat: 'shadowDmg',    apply: 'add',  stacking: 'additive',       min: -0.5, max: 0.6, label: 'Shadow Damage' },
  attackSpeed:        { stat: 'attackSpeed',  apply: 'add',  stacking: 'additive',       min: -0.3, max: 0.4, label: 'Attack Speed' },
  healingPower:       { stat: 'healPower',    apply: 'add',  stacking: 'additive',       min: -0.5, max: 0.6, label: 'Healing Power' },
  statusResistance:   { stat: 'tenacity',     apply: 'add',  stacking: 'additive',       min: -0.3, max: 0.4, label: 'Status Resistance' },
  // + points on the class resource's maximum (Player.syncGearResources -> ResourcePool 'maxAdd'; stamina never)
  resourceMax:        { stat: null,           unit: 'flat',  stacking: 'additive',       min: -30,  max: 40,  label: 'Resource Max' },
};

// damage types that count as MAGIC for the magicDamage modifier (physical never does)
export const MAGIC_DAMAGE_TYPES = ['magic', 'holy', 'light', 'shadow', 'lightning', 'void', 'astral', 'fire', 'ice'];
// COUNTER hits for the counterDamage modifier: a hit flagged `counter` (the strike that answers a Perfect Guard) or any
// hit on a foe inside a Counter Window (combat/counterSystem.js status 'counter_window')
export const COUNTER_STATUS = 'counter_window';

// GEAR LOADOUT — the 7 slots (G2). Slot ids 'weapon' / 'armor' are kept from the old 3-slot equipment (saves).
// Every slot may be EMPTY (the class sprite draws its own weapon; signature weapons are not items).
// `fixed` (no slot uses it now) = never empty: unequip refused, swap instead. A slot takes exactly its `type`.
export const GEAR_SLOTS = [
  { id: 'weapon', type: 'weapon_core', label: 'Weapon Core' },
  { id: 'armor', type: 'armor_core', label: 'Armor Core' },
  { id: 'relic', type: 'relic', label: 'Relic' },
  { id: 'charm', type: 'charm', label: 'Charm' },
  { id: 'rune1', type: 'rune', label: 'Rune 1' },
  { id: 'rune2', type: 'rune', label: 'Rune 2' },
  { id: 'rune3', type: 'rune', label: 'Rune 3' },
];
export const LOADOUT_RULES = {
  duplicates: false, // the same item id in two slots (two copies of one rune) — off: every slot must be a different item
};
// why an equip was refused -> text for the player
export const EQUIP_FAIL = {
  unknown: 'Unknown item', notGear: 'This item cannot be equipped', notOwned: 'You do not have this item',
  wrongSlot: 'It does not fit that slot', class: 'Your class cannot use this item', duplicate: 'Already equipped in another slot',
  fixed: 'This slot cannot be empty', bagFull: 'Your bag is full', level: 'Your level is too low for this item',
};

// TRIGGERS — when an item effect may fire (G3 maps each one to a game event). onLowHP fires once per dip below the line.
export const TRIGGERS = [
  'onAttack', 'onHit', 'onDamageTaken', 'onBlock', 'onPerfectGuard', 'onSkillCast', 'onSkillHit', 'onKill',
  'onDodge', 'onDash', 'onTaunt', 'onBarrierCreated', 'onResourceGain', 'onResourceSpend', 'onLowHP',
  // I1
  'onCrit', 'onFullResource', 'onStatusApplied', 'onBossPhase',
  // I3
  'onMarksFull', 'onMarkTriggered',
];

// CONDITIONS — extra checks on an effect: { type, value } (G3: items/conditionSystem.js, one function per type)
export const CONDITIONS = ['hpBelow', 'hpAbove', 'resourceAbove', 'resourceBelow', 'targetHasMark', 'perfectGuard', 'inCombat',
  'targetHasStatus', 'statusIs', 'marksAtLeast', 'skillIs'];

// EFFECTS — what an effect does (G3: items/effectSystem.js, one handler per type). Every effect needs a cooldown or
// a duration so nothing can chain forever; `maxPerSecond` in G3 is the last safety net.
export const EFFECT_TYPES = ['modifyStat', 'gainResource', 'reflectDamage', 'reduceCooldown', 'heal', 'barrier', 'nextHitBonus',
  'applyStatus', 'addMark'];
