// Item database (15 items). Equipment stats/mods are applied by /equipment.
// icon: small procedural glyph drawn by the UI (see ui/icons.js)
export const ITEMS = {
  // ---- weapons
  umbral_sword: {
    name: 'Umbral Sword', cat: 'Weapon', slot: 'weapon', rarity: 'rare', icon: 'sword', color: '#a060ff',
    stats: { atk: 0 }, desc: 'A blade forged from a sliver of eclipse. Balanced and reliable.',
  },
  duskfang_blade: {
    name: 'Duskfang Blade', cat: 'Weapon', slot: 'weapon', rarity: 'epic', icon: 'sword', color: '#e0a040',
    stats: { atk: 4, crit: 0.15 }, mods: { twinFangTriple: true },
    desc: 'Serrated with wolf fangs.', modText: 'Twin Fang strikes 3 times.', price: 0,
  },
  crystalbreaker: {
    name: 'Crystalbreaker Edge', cat: 'Weapon', slot: 'weapon', rarity: 'epic', icon: 'sword', color: '#5af0ff',
    stats: { atk: 9, armorBreak: 2.2 }, desc: 'Heavy crystal-edged blade.', modText: 'Shatters crystal armour 2.2× faster.',
  },
  celestial_loom: {
    name: 'Celestial Loom', cat: 'Weapon', slot: 'weapon', rarity: 'rare', icon: 'staff', color: '#8ad8ff',
    stats: { atk: 0 }, desc: 'A gilded staff that spins starlight into thread. Signature weapon of the Astral Weaver.',
  },
  reaper_scythe: {
    name: 'Reaper Scythe', cat: 'Weapon', slot: 'weapon', rarity: 'epic', icon: 'scythe', color: '#9a5cff',
    stats: { atk: 2 }, desc: 'A shadow scythe that hungers for marked souls. Signature weapon of the Nightfall Reaper.',
  },
  aegis_shield: {
    name: 'Aegis Shield & Blade', cat: 'Weapon', slot: 'weapon', rarity: 'rare', icon: 'shield', color: '#ffd070',
    stats: { atk: 0 }, desc: 'A knight longsword and the gilded Aegis shield. Signature weapon of the Aegis Guardian.',
  },
  // ---- armor
  umbral_cloak: {
    name: 'Umbral Cloak', cat: 'Armor', slot: 'armor', rarity: 'rare', icon: 'cloak', color: '#7a50c0',
    stats: { def: 0, hp: 0 }, desc: 'Black cloak woven with shadow thread.',
  },
  shadeweave: {
    name: 'Shadeweave Mantle', cat: 'Armor', slot: 'armor', rarity: 'epic', icon: 'cloak', color: '#c080ff',
    stats: { def: 3, hp: 30, cdr: 0.15 }, mods: { shadeBomb: true },
    desc: 'Recovered from the Sealed Archive.', modText: 'Cooldowns -15%. Shade Step leaves an afterimage that explodes.',
  },
  astral_robe: {
    name: 'Astral Robe', cat: 'Armor', slot: 'armor', rarity: 'rare', icon: 'cloak', color: '#5a7ad8',
    stats: { def: 0, hp: 0 }, desc: 'Night-blue robe embroidered with gold constellations.',
  },
  reaper_shroud: {
    name: 'Reaper Shroud', cat: 'Armor', slot: 'armor', rarity: 'epic', icon: 'cloak', color: '#5a2aa0',
    stats: { def: 1, hp: 10 }, desc: 'Tattered night given form. Worn by those who walk the Long Night.',
  },
  aegis_plate: {
    name: 'Aegis Plate', cat: 'Armor', slot: 'armor', rarity: 'rare', icon: 'cloak', color: '#c8d0e0',
    stats: { def: 0, hp: 0 }, desc: 'Polished silver plate under a midnight-blue mantle.',
  },
  // ---- accessories
  eclipse_sigil: {
    name: 'Eclipse Sigil', cat: 'Armor', slot: 'accessory', rarity: 'legendary', icon: 'sigil', color: '#ff80ff',
    stats: { shadowDmg: 0.1 }, mods: { sigil: true, perfectWindow: 0.06 },
    desc: 'A black medallion found in the Hidden Cave.', modText: 'Shadow Break +40% and releases a second wave. Perfect Dodge window +60ms.',
  },
  hunters_charm: {
    name: "Hunter's Charm", cat: 'Armor', slot: 'accessory', rarity: 'rare', icon: 'charm', color: '#80d080',
    stats: { crit: 0.08, shadowGain: 0.25 }, desc: 'A charm of braided fang and silver.', modText: 'Shadow gain +25%.', price: 260,
  },
  guardian_heart: {
    name: 'Heart of the Guardian', cat: 'Armor', slot: 'accessory', rarity: 'legendary', icon: 'heart', color: '#5af0ff',
    stats: { hp: 60, def: 3 }, mods: { perfectHeal: true },
    desc: 'The Guardian’s crystal heart, now calm.', modText: 'Perfect Dodge restores 5% HP.',
  },
  veil_stillness: {
    name: 'Veil of Stillness', cat: 'Armor', slot: 'accessory', rarity: 'epic', icon: 'charm', color: '#9af8ff',
    stats: { crit: 0.04 }, mods: { perfectBonus: true },
    desc: 'A silver veil found behind Silverfall.', modText: 'Perfect Dodge grants +1 extra Shadow Mark and +15 SHADOW.',
  },
  umbral_band: {
    name: 'Umbral Band', cat: 'Armor', slot: 'accessory', rarity: 'epic', icon: 'sigil', color: '#b070ff',
    stats: { atk: 2 }, mods: { breakDmg: 1.3 },
    desc: 'A ring of blackened iron that drinks shadow.', modText: 'Shadow Break damage +30%.',
  },
  // ---- consumables
  hp_potion: { name: 'Healing Draught', cat: 'Consumable', rarity: 'common', icon: 'potion', color: '#e05060', desc: 'Restores 40% HP. [R]', price: 30, use: 'heal' },
  shadow_tonic: { name: 'Shadow Tonic', cat: 'Consumable', rarity: 'common', icon: 'potion', color: '#a060ff', desc: 'Restores 50 class resource (SHADOW / ASTRAL). [F]', price: 40, use: 'shadow' },
  // ---- materials
  hare_pelt: { name: 'Hare Pelt', cat: 'Material', rarity: 'common', icon: 'cloak', color: '#e8dcc8', desc: 'Soft pelt of a Whisper Hare.', sell: 4 },
  wolf_fang: { name: 'Wolf Fang', cat: 'Material', rarity: 'common', icon: 'fang', color: '#d8d0c0', desc: 'Dropped by Forest Wolves.', sell: 8 },
  goblin_iron: { name: 'Goblin Iron', cat: 'Material', rarity: 'common', icon: 'ore', color: '#8a8a90', desc: 'Crude iron scraps.', sell: 12 },
  crystal_shard: { name: 'Crystal Shard', cat: 'Material', rarity: 'uncommon', icon: 'shard', color: '#5af0ff', desc: 'Humming shard of forest crystal.', sell: 18 },
  moon_crystal: { name: 'Moonlit Crystal', cat: 'Material', rarity: 'rare', icon: 'shard', color: '#d0a0ff', desc: 'Rare crystal grown in darkness.', sell: 60 },
  guardian_heartwood: { name: 'Guardian Heartwood', cat: 'Material', rarity: 'legendary', icon: 'ore', color: '#7af0c0', desc: 'Living wood from the Guardian. A smith in the Valley may know its use.', sell: 200 },
  // ---- quest
  // boss trophies (data/bosses.js rewards.items) — lore materials for later crafting
  hollow_fang_pelt: { name: 'Hollow Fang Pelt', cat: 'Material', rarity: 'rare', icon: 'fang', color: '#ffb070', desc: 'Trophy of Hollow Fang, the alpha that denned by the River Crossing.', sell: 60 },
  warchief_totem: { name: "Warchief's Thorn Totem", cat: 'Material', rarity: 'epic', icon: 'rune', color: '#b060ff', desc: 'Trophy of the A2 boss. Its thorns still twitch toward the ruins.', sell: 120 },
  seal_fragment: { name: 'Ancient Seal Fragment', cat: 'Quest Item', rarity: 'quest', icon: 'rune', color: '#5af0ff', desc: 'Resonates with the sealed Guardian Gate.' },
};

// Max stack per category (an item may override with its own `maxStack`). Inventory never holds more.
export const MAX_STACK = { Weapon: 9, Armor: 9, Consumable: 20, Material: 99, 'Quest Item': 1 };
export const maxStackOf = (id) => (ITEMS[id] ? ITEMS[id].maxStack || MAX_STACK[ITEMS[id].cat] || 99 : 0);

export const RARITY_COLOR = { common: '#c8c8d0', uncommon: '#7ad8a0', rare: '#6aa8ff', epic: '#c080ff', legendary: '#ffb040', quest: '#5af0ff' };

export const CATEGORIES = ['All', 'Weapon', 'Armor', 'Material', 'Consumable', 'Quest Item'];

export const RECIPES = [
  { out: 'duskfang_blade', mats: { wolf_fang: 4, goblin_iron: 1 }, gold: 120 },
  { out: 'crystalbreaker', mats: { crystal_shard: 4, goblin_iron: 2 }, gold: 180 },
];

export const SHOP = ['hp_potion', 'shadow_tonic', 'hunters_charm'];
