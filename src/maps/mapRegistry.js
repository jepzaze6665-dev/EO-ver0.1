import { LUMINA_VILLAGE } from './luminaVillage.js';
import { FIELD_A1 } from './fieldA1.js';
import { FIELD_A2 } from './fieldA2.js';
import { FIELD_A3 } from './fieldA3.js';
import { MAJOR_BOSS_ARENA } from './majorBossArena.js';
import { CITY_2 } from './city2.js';
import { FIELD_ASHEN } from './fieldAshen.js';

// Every playable map. Order = region priority when a world tile could match two maps.
//   City 1 Lumina Village -> A1 -> A2 -> A3 (+ Major Boss Arena) -> City 2 Valehaven     (Route A, data/routes.js)
//   Route B (B1 -> B2 -> B3) is data only for now: its maps are added here when they are built.
// Map fields (V2.2 world progression):
//   grid       : the grid (world/levels) the map lives on — one grid is loaded at a time
//   id, name, short, sub, type ('city' | 'field' | 'boss_arena'), route ('A' | 'B'), nextMap, bossId,
//   requires   : entry requirements (progression/requirements.js) — the Boss Gate rule. A map with none is open.
//   gates      : collision gates { id, rect, requires, color, label } (world/gateSystem.js) — solid until met
//   hiddenAreas: data/hidden.js ids that live here (route panel "secrets found"; content = data/hidden.js)
//   exits / spawn / region / content: see maps/luminaVillage.js
export const MAPS = [LUMINA_VILLAGE, FIELD_A1, FIELD_A2, FIELD_A3, MAJOR_BOSS_ARENA, CITY_2, FIELD_ASHEN];
export const START_MAP = 'lumina';
