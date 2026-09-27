import { LUMINA_VILLAGE } from './luminaVillage.js';
import { FIELD_A1 } from './fieldA1.js';
import { FIELD_A2 } from './fieldA2.js';
import { FIELD_A3 } from './fieldA3.js';
import { MAJOR_BOSS_ARENA } from './majorBossArena.js';
import { ANCIENT_VALLEY } from './ancientValley.js';

// Every playable map (V2.1 Route A). Order = region priority when a world tile could match two maps.
//   Lumina Village -> A1 -> A2 -> A3 -> Major Boss Arena   (+ Ancient Valley after the boss)
export const MAPS = [LUMINA_VILLAGE, FIELD_A1, FIELD_A2, FIELD_A3, MAJOR_BOSS_ARENA, ANCIENT_VALLEY];
export const START_MAP = 'lumina';
