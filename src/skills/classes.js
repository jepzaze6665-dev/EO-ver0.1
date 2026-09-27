import { UmbralSword } from './umbralSword.js';
import { AstralWeaver } from './astralWeaver.js';
import { AegisGuardian } from './aegisGuardian.js';

// CLASS REGISTRY — adding a class (Class 2, Awakening, Secret Class) = add its data file here.
// Nothing else in the core changes: Player / SkillSystem / HUD read the class data.
export const CLASSES = {
  umbral_sword: UmbralSword,
  astral_weaver: AstralWeaver,
  aegis_guardian: AegisGuardian,
};
export const STARTING_CLASSES = ['astral_weaver', 'umbral_sword', 'aegis_guardian'];
export const DEFAULT_CLASS = 'umbral_sword';
