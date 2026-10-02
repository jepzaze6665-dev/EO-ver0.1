// AUDIO DATA (owner 2026-10-03: AI-made sound files, Hollow Knight style, boss music per phase).
// Files come from tools/build-audio.js -> assets/audio/audio.json. A name without a file keeps its old
// synthesised sound (src/audio/audio.js) — exactly like sprites fall back to the drawn placeholders.
// File naming in desgin/SOUND/ (see docs/audio/AUDIO_PROMPTS.md):
//   sfx/<name>.mp3 or sfx/<name>_1.mp3, _2 ... (variants, one is picked at random)
//   music/<track>.mp3        amb/<ambience>.mp3        (.ogg / .wav also accepted)
import { Z } from '../core/constants.js';

// Mixer buses (0..1 defaults; the player's own values are kept in localStorage).
export const AUDIO_BUSES = {
  master: { label: 'Master', def: 0.5 },
  music: { label: 'Music', def: 0.5 },
  sfx: { label: 'Effects', def: 0.8 },
  amb: { label: 'Ambience', def: 0.6 },
  ui: { label: 'Interface', def: 0.7 },
};
export const AUDIO_STORAGE_KEY = 'eclipse_audio_v1';

export const SOUND_RULES = {
  maxVoices: 4, // the same sfx name playing at once (a pack of 10 wolves hit together = 4 sounds)
  minGap: 0.03, // s between two starts of one name
  pitch: [0.94, 1.06], // random pitch per play (repeated hits do not sound copied)
  hearRange: 900, // px: positional sounds fade to silence at this distance from the listener
  panWidth: 600, // px: full left / right at this horizontal offset
  musicFade: 1.6, // s crossfade between tracks
  phaseFade: 2.2, // s crossfade between boss phases (same key / tempo -> a smooth swell)
  ambFade: 2.5,
};

// Per-name tuning (all optional): vol, bus, pitch [a, b], maxVoices.
export const SFX = {
  ui: { bus: 'ui', vol: 0.6, pitch: [1, 1] },
  deny: { bus: 'ui', vol: 0.7 },
  equip: { bus: 'ui' },
  quest: { bus: 'ui' }, quest_done: { bus: 'ui' }, levelup: { bus: 'ui', pitch: [1, 1] },
  step: { vol: 0.35, maxVoices: 2 },
  hit: { maxVoices: 5 }, kill: { maxVoices: 3 },
  ult_slash: { pitch: [0.98, 1.02] }, victory: { pitch: [1, 1] }, death: { pitch: [1, 1] },
};

// Field / city music per zone (files named after the track). Missing file -> the zone's old synth theme.
export const ZONE_MUSIC = {
  [Z.VILLAGE]: 'lumina', [Z.FOREST]: 'whispering_forest', [Z.RUINS]: 'whispering_forest', [Z.GATE]: 'whispering_forest',
  [Z.ARENA]: 'boss_arena_calm', [Z.VALLEY]: 'valehaven', [Z.CAVE]: 'hidden_cave', [Z.ANCIENT]: 'ancient_valley',
  [Z.RIFT]: 'boss_arena_calm', [Z.CITADEL]: 'rune_citadel', [Z.SANCTUM]: 'boss_arena_calm', [Z.ASTERIA]: 'asteria',
  [Z.FROSTWIND]: 'frostwind', [Z.FROST_ARENA]: 'boss_arena_calm', [Z.CAVERNS]: 'crystal_caverns',
  [Z.CAVERN_HEART]: 'boss_arena_calm', [Z.FROSTPEAK]: 'frostpeak', [Z.PEAK_SUMMIT]: 'boss_arena_calm',
  [Z.EMBER]: 'quiet_hollow', [Z.CINDER]: 'boss_arena_calm',
};
// Ambience loops per zone (optional files).
export const ZONE_AMBIENCE = {
  [Z.VILLAGE]: 'amb_village', [Z.FOREST]: 'amb_forest', [Z.RUINS]: 'amb_forest', [Z.GATE]: 'amb_forest', [Z.ARENA]: 'amb_forest',
  [Z.VALLEY]: 'amb_village', [Z.CAVE]: 'amb_cave', [Z.ANCIENT]: 'amb_valley', [Z.RIFT]: 'amb_lava', [Z.CITADEL]: 'amb_ruins',
  [Z.SANCTUM]: 'amb_ruins', [Z.ASTERIA]: 'amb_city', [Z.FROSTWIND]: 'amb_wind', [Z.FROST_ARENA]: 'amb_wind',
  [Z.CAVERNS]: 'amb_cave', [Z.CAVERN_HEART]: 'amb_cave', [Z.FROSTPEAK]: 'amb_wind', [Z.PEAK_SUMMIT]: 'amb_wind',
  [Z.EMBER]: 'amb_lava', [Z.CINDER]: 'amb_lava',
};

// Boss music: track '<base>_p<phase>' (phase 1..n). A missing phase file plays the highest phase below it,
// then '<base>', then the shared boss track, then the old synth 'boss' theme.
export const BOSS_MUSIC = {
  mini_hollow_fang: 'boss_mini', mini_grukk: 'boss_mini', mini_sunken_horn: 'boss_mini', mini_archive_warden: 'boss_mini',
  mini_old_scarclaw: 'boss_mini', mini_broodmother: 'boss_mini', mini_icebound_king: 'boss_mini',
  boss_a1: 'boss_guardian', boss_a2: 'boss_magma_beast', boss_a3: 'boss_rune_knight',
  boss_b1: 'boss_hoarfang', boss_b2: 'boss_colossus', boss_b3: 'boss_crystal_warden', boss_varkharon: 'boss_varkharon',
};
export const BOSS_MUSIC_FALLBACK = 'boss_common';

// Pure: which track to play for a boss phase, given the set of tracks that have files.
export function bossTrack(bossId, phase, has) {
  const base = BOSS_MUSIC[bossId] || BOSS_MUSIC_FALLBACK;
  for (let p = Math.max(1, phase | 0); p >= 1; p--) if (has(base + '_p' + p)) return base + '_p' + p;
  if (has(base)) return base;
  for (let p = Math.max(1, phase | 0); p >= 1; p--) if (has(BOSS_MUSIC_FALLBACK + '_p' + p)) return BOSS_MUSIC_FALLBACK + '_p' + p;
  if (has(BOSS_MUSIC_FALLBACK)) return BOSS_MUSIC_FALLBACK;
  return null; // -> synth 'boss'
}

// Pure: positional gain / pan for a sound at (x, y) heard from (lx, ly).
export function spatial(x, y, lx, ly, R = SOUND_RULES) {
  const dx = x - lx, dy = y - ly, d = Math.hypot(dx, dy);
  if (d >= R.hearRange) return { gain: 0, pan: 0 };
  const k = 1 - d / R.hearRange;
  return { gain: k * k, pan: Math.max(-1, Math.min(1, dx / R.panWidth)) };
}
