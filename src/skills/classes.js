import { UmbralSword } from './umbralSword.js';
import { AstralWeaver } from './astralWeaver.js';

// CLASS REGISTRY — adding a class (Class 2, Awakening, Secret Class) = add its data file here.
// Nothing else in the core changes: Player / SkillSystem / HUD read the class data.
export const CLASSES = {
  umbral_sword: UmbralSword,
  astral_weaver: AstralWeaver,
};
export const STARTING_CLASSES = ['astral_weaver', 'umbral_sword'];
export const DEFAULT_CLASS = 'umbral_sword';
