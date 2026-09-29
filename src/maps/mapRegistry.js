import { LUMINA_VILLAGE } from './luminaVillage.js';
import { FIELD_A1 } from './fieldA1.js';
import { MAJOR_BOSS_ARENA } from './majorBossArena.js';
import { VALEHAVEN } from './valehaven.js';
import { FIELD_A2 } from './fieldA2.js';
import { MAGMA_RIFT } from './magmaRift.js';
import { FIELD_A3 } from './fieldA3.js';
import { SANCTUM } from './sanctum.js';
import { CITY2 } from './city2.js';
import { FIELD_B1 } from './fieldB1.js';
import { FROST_ARENA_MAP } from './frostArena.js';
import { FIELD_B2 } from './fieldB2.js';
import { CRYSTAL_HEART } from './crystalHeart.js';
import { FIELD_B3 } from './fieldB3.js';
import { SUMMIT } from './summit.js';

// Every playable map. Order = region priority when a tile of one grid could match two maps.
//   City 1 Lumina Village -> A1 Whispering Forest (+ arena) -> A2 Ancient Valley (+ Magma Rift) -> A3 Rune Citadel (+ Sanctum) -> City 2 Asteria City
//   Valehaven = secret city inside A1's grid (not a route step). Route B (B1 -> B2 -> B3) is data only for now
//   (data/routes.js): its maps are added here when they are built.
// Map fields:
//   grid       : the grid (world/levels) the map lives on — one grid is loaded at a time
//   id, name, short, sub, type ('city' | 'field' | 'boss_arena'), route ('A' | 'B'), nextMap, bossId, parent (arena -> field),
//   secret     : hidden from the world map until visited
//   requires   : entry requirements (progression/requirements.js) — the Boss Gate rule. A map with none is open.
//   gates      : collision gates { id, rect, requires, color, label } (world/gateSystem.js) — solid until met
//   hiddenAreas: data/hidden.js ids that live here (route panel "secrets found"; content = data/hidden.js)
//   corruptedMonsters (true | { minTy, maxTy }) / monsterMods [{ zones, mod }]: how hard spawns are, by part of the map
//   exits / spawn / region / content: see maps/luminaVillage.js
export const MAPS = [LUMINA_VILLAGE, FIELD_A1, MAJOR_BOSS_ARENA, VALEHAVEN, FIELD_A2, MAGMA_RIFT, FIELD_A3, SANCTUM, CITY2, FIELD_B1, FROST_ARENA_MAP, FIELD_B2, CRYSTAL_HEART, FIELD_B3, SUMMIT];
export const START_MAP = 'lumina';
