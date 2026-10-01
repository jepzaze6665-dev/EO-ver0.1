// GEAR ITEM REGISTRY — every gear data file is listed here once. A new item = a new entry in one of these files
// (or a new file added to this list); items/items.js merges them into ITEMS. No system needs editing.
import { WEAPON_CORES } from './weaponCores.js';
import { ARMOR_CORES } from './armorCores.js';
import { RELICS } from './relics.js';
import { CHARMS } from './charms.js';
import { RUNES } from './runes.js';
import { UMBRAL_ITEMS } from './umbralItems.js';
import { ASTRAL_ITEMS } from './astralItems.js';
import { UNIVERSAL_ITEMS } from './universalItems.js';
import { BOSS_ITEMS } from './bossItems.js';

export const GEAR_SOURCES = { WEAPON_CORES, ARMOR_CORES, RELICS, CHARMS, RUNES, UMBRAL_ITEMS, ASTRAL_ITEMS, UNIVERSAL_ITEMS, BOSS_ITEMS };
export const GEAR_ITEMS = Object.assign({}, ...Object.values(GEAR_SOURCES));
