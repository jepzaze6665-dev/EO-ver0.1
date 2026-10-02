// Audio data + manifest (src/data/sounds.js, tools/build-audio.js). Run:  node tools/tests/audio.test.mjs
import { readFileSync, existsSync } from 'fs';
import { BOSS_MUSIC, BOSS_MUSIC_FALLBACK, ZONE_MUSIC, ZONE_AMBIENCE, AUDIO_BUSES, SFX, bossTrack, spatial, SOUND_RULES } from '../../src/data/sounds.js';
import { BOSSES } from '../../src/data/bosses.js';
import { ZONE_INFO } from '../../src/core/constants.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ROOT = new URL('../../', import.meta.url);

console.log('audio');
test('every boss has a music track', () => { for (const id of Object.keys(BOSSES)) ok(BOSS_MUSIC[id], 'no track for ' + id); });
test('every zone with info has music + ambience entries', () => {
  for (const z of Object.keys(ZONE_INFO)) { ok(ZONE_MUSIC[z], 'zone ' + z + ' no music'); ok(ZONE_AMBIENCE[z], 'zone ' + z + ' no ambience'); }
});
test('boss track picks the phase file, else lower phase, base, shared, null', () => {
  const has = (set) => (n) => set.includes(n);
  ok(bossTrack('boss_b3', 3, has(['boss_crystal_warden_p1', 'boss_crystal_warden_p3'])) === 'boss_crystal_warden_p3', 'exact');
  ok(bossTrack('boss_b3', 2, has(['boss_crystal_warden_p1', 'boss_crystal_warden_p3'])) === 'boss_crystal_warden_p1', 'lower');
  ok(bossTrack('boss_b3', 2, has(['boss_crystal_warden'])) === 'boss_crystal_warden', 'base');
  ok(bossTrack('boss_b3', 2, has([BOSS_MUSIC_FALLBACK + '_p2'])) === BOSS_MUSIC_FALLBACK + '_p2', 'shared');
  ok(bossTrack('boss_b3', 2, has([])) === null, 'none -> synth');
});
test('spatial: near = loud + centred, far = silent, side = panned', () => {
  ok(spatial(0, 0, 0, 0).gain === 1 && spatial(0, 0, 0, 0).pan === 0, 'near');
  ok(spatial(SOUND_RULES.hearRange + 1, 0, 0, 0).gain === 0, 'far');
  ok(spatial(300, 0, 0, 0).pan > 0 && spatial(-300, 0, 0, 0).pan < 0, 'pan');
});
test('SFX buses exist', () => { for (const [n, d] of Object.entries(SFX)) if (d.bus) ok(AUDIO_BUSES[d.bus], n + ' bus ' + d.bus); });
test('manifest files exist', () => {
  const p = new URL('assets/audio/audio.json', ROOT);
  if (!existsSync(p)) return;
  const m = JSON.parse(readFileSync(p));
  for (const kind of ['sfx', 'music', 'amb']) for (const [n, files] of Object.entries(m[kind] || {}))
    for (const f of files) ok(existsSync(new URL('assets/audio/' + f, ROOT)), `${kind} ${n}: missing ${f}`);
});
console.log(`  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
