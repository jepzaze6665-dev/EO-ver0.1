// Item database. Equipment stats/mods are applied by /equipment.
// icon: small procedural glyph drawn by the UI (see ui/icons.js)
// GEAR items from data/items/*.js (cores, relics, charms, runes) are merged in below; every item is then normalised
// (items/itemDefs.js: id, type, description, tags, allowedClasses, modifiers, effects). Older gear keeps `stats` /
// `mods` / `skillModifiers` until it is converted to item modifiers + effects.
import { GEAR_ITEMS } from '../data/items/index.js';
import { normalizeItem } from './itemDefs.js';

export const ITEMS = {
  // ---- weapons (class signature weapons / armours are NOT items: data/classKits.js)
  duskfang_blade: {
    name: 'Duskfang Blade', cat: 'Weapon', slot: 'weapon', rarity: 'epic', icon: 'sword', color: '#e0a040',
    stats: { atk: 4, crit: 0.15 }, mods: { twinFangTriple: true },
    desc: 'Serrated with wolf fangs.', modText: 'Twin Fang strikes 3 times.', price: 0,
  },
  crystalbreaker: {
    name: 'Crystalbreaker Edge', cat: 'Weapon', slot: 'weapon', rarity: 'epic', icon: 'sword', color: '#5af0ff',
    stats: { atk: 9, armorBreak: 2.2 }, desc: 'Heavy crystal-edged blade.', modText: 'Shatters crystal armour 2.2× faster.',
  },
  // ---- armor
  shadeweave: {
    name: 'Shadeweave Mantle', cat: 'Armor', slot: 'armor', rarity: 'epic', icon: 'cloak', color: '#c080ff',
    stats: { def: 3, hp: 30, cdr: 0.15 }, mods: { shadeBomb: true },
    desc: 'Recovered from the Sealed Archive.', modText: 'Cooldowns -15%. Shade Step leaves an afterimage that explodes.',
  },
  // ---- accessories
  eclipse_sigil: {
    type: 'relic', name: 'Eclipse Sigil', cat: 'Armor', slot: 'accessory', rarity: 'legendary', icon: 'sigil', color: '#ff80ff',
    stats: { shadowDmg: 0.1 }, mods: { sigil: true, perfectWindow: 0.06 },
    desc: 'A black medallion found in the Hidden Cave.', modText: 'Shadow Break +40% and releases a second wave. Perfect Dodge window +60ms.',
  },
  // SKILL MODIFIER gear (Skill System S6, progression/skillModifiers.js): changes skills through data
  hunger_rune: {
    type: 'rune', name: 'Rune of Hunger', cat: 'Armor', slot: 'accessory', rarity: 'rare', icon: 'sigil', color: '#c080ff',
    stats: {}, skillModifiers: [
      { skillId: 'shadow_slash', stat: 'damage', operation: 'MULTIPLY', value: 1.1 },
      { skillId: 'shadow_slash', stat: 'resourceGain', operation: 'ADD', value: 5 },
    ],
    desc: 'A rune that drinks from every cut.', modText: 'Shadow Slash +10% damage and +5 Shadow when it hits.', price: 320,
  },
  shade_charm: {
    type: 'charm', name: 'Shade Charm', cat: 'Armor', slot: 'accessory', rarity: 'rare', icon: 'charm', color: '#8a70ff',
    stats: {}, skillModifiers: [{ skillId: 'shade_step', stat: 'charges', operation: 'ADD', value: 1 }],
    desc: 'Two shadows follow its wearer.', modText: 'Shade Step gains 1 extra charge (2 / 2).', price: 360,
  },
  eclipse_relic: {
    type: 'relic', name: 'Eclipse Relic', cat: 'Armor', slot: 'accessory', rarity: 'epic', icon: 'heart', color: '#e0a0ff',
    stats: {}, skillModifiers: [
      { skillId: 'eclipse_sever', stat: 'cooldown', operation: 'MULTIPLY', value: 0.9 },
      { tag: 'shadow', stat: 'damage', operation: 'MULTIPLY', value: 1.03 },
    ],
    desc: 'A shard of the first eclipse.', modText: 'Eclipse Sever -10% cooldown · shadow skills +3% damage.', price: 520,
  },
  hunters_charm: {
    type: 'charm', name: "Hunter's Charm", cat: 'Armor', slot: 'accessory', rarity: 'rare', icon: 'charm', color: '#80d080',
    stats: { crit: 0.08, shadowGain: 0.25 }, desc: 'A charm of braided fang and silver.', modText: 'Shadow gain +25%.', price: 260,
  },
  guardian_heart: {
    type: 'relic', name: 'Heart of the Guardian', cat: 'Armor', slot: 'accessory', rarity: 'legendary', icon: 'heart', color: '#5af0ff',
    stats: { hp: 60, def: 3 }, mods: { perfectHeal: true },
    desc: 'The Guardian’s crystal heart, now calm.', modText: 'Perfect Dodge restores 5% HP.',
  },
  veil_stillness: {
    type: 'relic', name: 'Veil of Stillness', cat: 'Armor', slot: 'accessory', rarity: 'epic', icon: 'charm', color: '#9af8ff',
    stats: { crit: 0.04 }, mods: { perfectBonus: true },
    desc: 'A silver veil found behind Silverfall.', modText: 'Perfect Dodge grants +1 extra Shadow Mark and +15 SHADOW.',
  },
  umbral_band: {
    type: 'charm', name: 'Umbral Band', cat: 'Armor', slot: 'accessory', rarity: 'epic', icon: 'sigil', color: '#b070ff',
    stats: { atk: 2 }, mods: { breakDmg: 1.3 },
    desc: 'A ring of blackened iron that drinks shadow.', modText: 'Shadow Break damage +30%.',
  },
  // ---- consumables
  hp_potion: { name: 'Healing Draught', cat: 'Consumable', rarity: 'common', icon: 'potion', color: '#e05060', desc: 'Restores 40% HP. [R]', price: 30, use: 'heal' },
  shadow_tonic: { name: 'Shadow Tonic', cat: 'Consumable', rarity: 'common', icon: 'potion', color: '#a060ff', desc: 'Restores 50 class resource (SHADOW / ASTRAL). [F]', price: 40, use: 'shadow' },
  // ---- materials
  asterian_crest: { name: 'Asterian Crest', cat: 'Material', rarity: 'rare', icon: 'sigil', color: '#9ad8ff', desc: 'The crest of the last Warden of Asteria. It still hums with runes.', sell: 200 },
  rune_crystal: { name: 'Rune Crystal', cat: 'Material', rarity: 'uncommon', icon: 'shard', color: '#8ab8ff', desc: 'A chest crystal of a Citadel golem, still humming.', sell: 36 },
  bronze_plate: { name: 'Bronze Plate', cat: 'Material', rarity: 'uncommon', icon: 'shield', color: '#d0a060', desc: 'A dented plate from a Bronze Hoplite\'s armour.', sell: 34 },
  magma_heart: { name: 'Magma Heart', cat: 'Material', rarity: 'rare', icon: 'heart', color: '#ff7a30', desc: 'Still warm. Trophy of the Magma Beast of the Ancient Valley.', sell: 120 },
  ember_core: { name: 'Ember Core', cat: 'Material', rarity: 'uncommon', icon: 'shard', color: '#ff9a40', desc: 'A cooling ember from the Magma Rift.', sell: 40 },
  stone_scute: { name: 'Stone Scute', cat: 'Material', rarity: 'common', icon: 'ore', color: '#b09a78', desc: 'A plate of an Ancient Valley armadillo\'s shell.', sell: 16 },
  crag_horn: { name: 'Crag Horn', cat: 'Material', rarity: 'uncommon', icon: 'fang', color: '#d8c8a0', desc: 'The stone horn of a Crag Rhino.', sell: 30 },
  hare_pelt: { name: 'Hare Pelt', cat: 'Material', rarity: 'common', icon: 'cloak', color: '#e8dcc8', desc: 'Soft pelt of a Whisper Hare.', sell: 4 },
  warden_crest: { name: 'Crest of the Crystal Warden', cat: 'Material', rarity: 'legendary', icon: 'rune', color: '#bfe6ff', desc: 'Trophy of the Crystal Warden, B3 Major Boss. The summit is quiet.', sell: 200 },
  amethyst_core: { name: 'Amethyst Core', cat: 'Material', rarity: 'epic', icon: 'shard', color: '#c89aff', desc: 'Trophy of the Amethyst Colossus, B2 boss. It still hums.', sell: 140 },
  frost_heart: { name: 'Heart of the Winter Alpha', cat: 'Material', rarity: 'epic', icon: 'shard', color: '#bfe6ff', desc: 'Trophy of Hoarfang, B1 boss. Cold enough to burn.', sell: 120 },
  frost_pelt: { name: 'Frost Pelt', cat: 'Material', rarity: 'uncommon', icon: 'cloak', color: '#cfe4ff', desc: 'Thick white fur from the Frostwind Plains. Never quite thaws.', sell: 16 },
  wolf_fang: { name: 'Wolf Fang', cat: 'Material', rarity: 'common', icon: 'fang', color: '#d8d0c0', desc: 'Dropped by Forest Wolves.', sell: 8 },
  goblin_iron: { name: 'Ironbark Splinter', cat: 'Material', rarity: 'common', icon: 'ore', color: '#8a7a60', desc: 'Bark hard as iron, shed by the forest spirits.', sell: 12 },
  crystal_shard: { name: 'Crystal Shard', cat: 'Material', rarity: 'uncommon', icon: 'shard', color: '#5af0ff', desc: 'Humming shard of forest crystal.', sell: 18 },
  moon_crystal: { name: 'Moonlit Crystal', cat: 'Material', rarity: 'rare', icon: 'shard', color: '#d0a0ff', desc: 'Rare crystal grown in darkness.', sell: 60 },
  guardian_heartwood: { name: 'Guardian Heartwood', cat: 'Material', rarity: 'legendary', icon: 'ore', color: '#7af0c0', desc: 'Living wood from the Guardian. A smith in the Valley may know its use.', sell: 200 },
  // ---- quest
  // boss trophies (data/bosses.js rewards.items) — lore materials for later crafting
  hollow_fang_pelt: { name: 'Hollow Fang Pelt', cat: 'Material', rarity: 'rare', icon: 'fang', color: '#ffb070', desc: 'Trophy of Hollow Fang, the alpha that denned by the River Crossing.', sell: 60 },
  warchief_totem: { name: 'Thornbound Totem', cat: 'Material', rarity: 'epic', icon: 'rune', color: '#b060ff', desc: 'Trophy of the Thornbound Elder. Its thorns still twitch toward the ruins.', sell: 120 },
  heart_of_varkharon: { name: 'Heart of Varkharon', cat: 'Material', rarity: 'legendary', icon: 'heart', color: '#ff5a20', maxStack: 1, desc: 'It still beats, slow and furious. The fire of a sealed king — something may be born from it one day.' },
  cinder_shard: { name: 'Cinder Shard', cat: 'Quest Item', rarity: 'quest', maxStack: 3, icon: 'rune', color: '#ff7a30', desc: 'A splinter of black stone, warm as a coal. The Ashen Pilgrim said there are three.' },
  // KEY ITEM (owner): red MYTHIC grade, its only use = the key to the Dragon Door (kept after the door opens; no stats, no sale)
  varkharon_seal: { name: "Varkharon's Seal", cat: 'Quest Item', rarity: 'mythic', key: true, bound: true, maxStack: 1, icon: 'sigil', color: '#ff3030', desc: 'Three cinder shards fused into a dragon-headed seal. It opens the Dragon Door in the Quiet Hollow, and nothing else.' },
  seal_fragment: { name: 'Ancient Seal Fragment', cat: 'Quest Item', rarity: 'quest', icon: 'rune', color: '#5af0ff', desc: 'Resonates with the sealed Guardian Gate.' },
};
for (const [id, def] of Object.entries(GEAR_ITEMS)) {
  if (ITEMS[id]) throw new Error(`item id "${id}" is defined twice`);
  ITEMS[id] = def;
}
for (const [id, def] of Object.entries(ITEMS)) normalizeItem(id, def);

// Max stack per category (an item may override with its own `maxStack`). Inventory never holds more.
export const MAX_STACK = { Weapon: 9, Armor: 9, Consumable: 20, Material: 99, 'Quest Item': 1 };
export const maxStackOf = (id) => (ITEMS[id] ? ITEMS[id].maxStack || MAX_STACK[ITEMS[id].cat] || 99 : 0);

export const RARITY_COLOR = { common: '#c8c8d0', uncommon: '#7ad8a0', rare: '#6aa8ff', epic: '#c080ff', legendary: '#ffb040', mythic: '#ff3030', quest: '#5af0ff' };

export const CATEGORIES = ['All', 'Weapon', 'Armor', 'Material', 'Consumable', 'Quest Item'];

export const RECIPES = [
  { out: 'duskfang_blade', mats: { wolf_fang: 4, goblin_iron: 1 }, gold: 120 },
  { out: 'crystalbreaker', mats: { crystal_shard: 4, goblin_iron: 2 }, gold: 180 },
];

// shops per NPC (dialogue action 'shop' opens the shop of the NPC you talk to)
export const SHOPS = {
  merchant: { title: "Lysa's Goods", stock: ['hp_potion', 'shadow_tonic', 'hunters_charm', 'hunger_rune', 'shade_charm'] },
  a_merchant: { title: 'Asterian Bazaar', stock: ['hp_potion', 'shadow_tonic', 'hunters_charm', 'hunger_rune', 'shade_charm', 'eclipse_relic'] },
};
export const SHOP = SHOPS.merchant.stock;
