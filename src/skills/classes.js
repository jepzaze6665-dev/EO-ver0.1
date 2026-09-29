import { UmbralSword } from './umbralSword.js';
import { AstralWeaver } from './astralWeaver.js';
import { AegisGuardian } from './aegisGuardian.js';
import { NightfallReaper } from './nightfallReaper.js';
import { Duskrunner } from './duskrunner.js';
import { BladeOfEchoes } from './bladeOfEchoes.js';
import { WardenOfDawn } from './wardenOfDawn.js';
import { BulwarkSentinel } from './bulwarkSentinel.js';
import { Oathbreaker } from './oathbreaker.js';

// CLASS REGISTRY — adding a class (Class 2, Awakening, Secret Class) = add its data file here.
// Nothing else in the core changes: Player / SkillSystem / HUD read the class data.
export const CLASSES = {
  umbral_sword: UmbralSword,
  astral_weaver: AstralWeaver,
  aegis_guardian: AegisGuardian,
  // Class 2 (unlocked through progression, never picked at New Game)
  nightfall_reaper: NightfallReaper,
  duskrunner: Duskrunner,
  blade_of_echoes: BladeOfEchoes,
  warden_of_dawn: WardenOfDawn,
  bulwark_sentinel: BulwarkSentinel,
  oathbreaker: Oathbreaker,
};
export const STARTING_CLASSES = ['astral_weaver', 'umbral_sword', 'aegis_guardian'];
export const DEFAULT_CLASS = 'umbral_sword';
