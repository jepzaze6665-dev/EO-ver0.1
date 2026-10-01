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

// rarity = how rare, NOT "bigger numbers": a legendary carries a unique effect (validated: legendary gear needs effects)
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// allowedClasses: ['all'] or class ids (src/skills/classes.js). The core never names a class.
export const ANY_CLASS = 'all';

// MODIFIERS — stat changes while the item is equipped (applied in G2 through one modifier layer, base stats untouched).
//  stat      : the player stat it changes (player.stats key); null = read by a system through getModifierValue (G2)
//  unit      : 'percent' (0.1 = +10%) — every item modifier is a share, so items scale with the level
//  stacking  : 'additive' (sum, then × (1 + sum)) | 'multiplicative' (× (1 + v) per item)
//  min / max : cap on the SUMMED value of all items (no infinite defense / negative cooldowns)
export const MODIFIER_TYPES = {
  maxHP:              { stat: 'hp',           unit: 'percent', stacking: 'additive',       min: -0.5, max: 1 },
  defense:            { stat: 'def',          unit: 'percent', stacking: 'additive',       min: -0.6, max: 1 },
  attack:             { stat: 'atk',          unit: 'percent', stacking: 'additive',       min: -0.5, max: 1 },
  magicDamage:        { stat: null,           unit: 'percent', stacking: 'additive',       min: -0.5, max: 1 },
  movementSpeed:      { stat: 'speed',        unit: 'percent', stacking: 'multiplicative', min: -0.4, max: 0.4 },
  cooldownReduction:  { stat: 'cdr',          unit: 'percent', stacking: 'additive',       min: -0.3, max: 0.3 },
  resourceGeneration: { stat: null,           unit: 'percent', stacking: 'additive',       min: -0.5, max: 1 },
  resourceCost:       { stat: null,           unit: 'percent', stacking: 'additive',       min: -0.4, max: 1 },
  barrierStrength:    { stat: 'barrierPower', unit: 'percent', stacking: 'additive',       min: -0.5, max: 1 },
  guardGeneration:    { stat: null,           unit: 'percent', stacking: 'additive',       min: -0.5, max: 1.5 },
  counterDamage:      { stat: null,           unit: 'percent', stacking: 'additive',       min: -0.5, max: 1 },
  aggro:              { stat: null,           unit: 'percent', stacking: 'additive',       min: -0.9, max: 2 },
  tauntPower:         { stat: null,           unit: 'percent', stacking: 'additive',       min: -0.5, max: 1 },
  damageReduction:    { stat: null,           unit: 'percent', stacking: 'additive',       min: -0.5, max: 0.4 },
};

// TRIGGERS — when an item effect may fire (G3 maps each one to a game event). onLowHP fires once per dip below the line.
export const TRIGGERS = [
  'onAttack', 'onHit', 'onDamageTaken', 'onBlock', 'onPerfectGuard', 'onSkillCast', 'onSkillHit', 'onKill',
  'onDodge', 'onDash', 'onTaunt', 'onBarrierCreated', 'onResourceGain', 'onResourceSpend', 'onLowHP',
];

// CONDITIONS — extra checks on an effect: { type, value } (G3: items/conditionSystem.js, one function per type)
export const CONDITIONS = ['hpBelow', 'hpAbove', 'resourceAbove', 'resourceBelow', 'targetHasMark', 'perfectGuard', 'inCombat'];

// EFFECTS — what an effect does (G3: items/effectSystem.js, one handler per type). Every effect needs a cooldown or
// a duration so nothing can chain forever; `maxPerSecond` in G3 is the last safety net.
export const EFFECT_TYPES = ['modifyStat', 'gainResource', 'reflectDamage', 'reduceCooldown', 'heal', 'barrier', 'nextHitBonus'];
