// Unit tests for the save format + storage + backup. Run:  node tools/tests/save.test.mjs
import { parseSave, SAVE_VERSION } from '../../src/save/saveData.js';
import { MemoryAdapter } from '../../src/save/storage.js';
import { SaveSystem } from '../../src/save/save.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

const KEY = 'eclipse_online_save_v1';
const good = (over = {}) => ({ v: SAVE_VERSION, savedAt: 1, playTime: 5, player: { classId: 'umbral_sword', level: 4, exp: 20, gold: 50, hp: 100, map: 'a1', x: 100, y: 200 }, world: { flags: { a: true } }, ...over });
// fake game: only what SaveSystem.snapshot / save need
const fakeGame = (state) => ({
  player: { dead: false, cls: { id: 'umbral_sword' }, level: state.level, exp: 0, gold: state.gold, hp: 10, shadow: 0, x: 1, y: 2,
    resources: { serialize: () => ({}) }, loadout: { serialize: () => ({}) } },
  world: { bossActive: false, inBossFight() { return this.bossActive; }, mapId: 'lumina', serialize: () => ({ flags: {} }) },
  worldProgress: { serialize: () => ({}) },
  inventory: { serialize: () => ({}) }, equipment: { serialize: () => ({}) }, quests: { serialize: () => ({}) },
  progression: { serialize: () => ({}) }, knowledge: { serialize: () => ({}) }, stats: {}, playTime: 0,
});

console.log('save format');
test('v2 -> v3 (W2): Guardian = boss_a1, old A1/A2 bosses = minis, A2/A3 -> A1, City 2 -> Valehaven, route_a restarts', () => {
  const v2 = { ...good(), v: 2, player: { ...good().player, map: 'a3' },
    world: { flags: {}, maps: { lumina: true, a1: true, a2: true, a3: true, city2: true }, hidden: {} },
    worldProgress: { defeatedBosses: { boss_a1: { time: 1 }, boss_a2: { time: 2 }, boss_a3: { time: 3 } }, unlockedMaps: { a2: true, a3: true, city2: true }, triggeredEvents: {} },
    quests: { active: { route_a: { progress: {}, done: { a1_boss: true, a2: true } } }, completed: {} } };
  const r = parseSave(JSON.stringify(v2)); ok(r.ok, r.error);
  const d = r.data;
  eq(d.v, SAVE_VERSION); eq(d.player.map, 'a1');
  ok(d.worldProgress.defeatedBosses.boss_a1.time === 3 && d.worldProgress.defeatedBosses.mini_hollow_fang && d.worldProgress.defeatedBosses.mini_grukk, 'bosses');
  ok(!d.worldProgress.defeatedBosses.boss_a3 && !d.worldProgress.defeatedBosses.boss_a2, 'old ids gone');
  ok(d.world.maps.valehaven && d.world.maps.a1 && !d.world.maps.city2 && !d.world.maps.a3, 'visited maps');
  ok(Object.keys(d.quests.active.route_a.done).length === 0, 'route_a restarts');
  const town = parseSave(JSON.stringify({ ...v2, player: { ...v2.player, map: 'city2' } })).data;
  eq(town.player.map, 'valehaven');
  const w1 = parseSave(JSON.stringify({ ...v2, player: { ...v2.player, map: 'ashen' } })).data;
  eq(w1.player.map, 'a2');
});
test('current save parses unchanged', () => { const r = parseSave(JSON.stringify(good())); ok(r.ok, r.error); eq(r.data.player.map, 'a1'); eq(r.data.world.flags.a, true); });
test('v1 save is migrated (no map / hidden state yet)', () => {
  const v1 = good({ v: 1 }); delete v1.player.map;
  const r = parseSave(JSON.stringify(v1)); ok(r.ok, r.error); eq(r.data.v, SAVE_VERSION); eq(r.data.player.map, null); ok(r.data.world.hidden, 'hidden');
});
test('corrupt / incomplete / future saves are rejected, never throw', () => {
  eq(parseSave('{bad json').ok, false); eq(parseSave('').ok, false); eq(parseSave('[]').ok, false);
  eq(parseSave(JSON.stringify({ v: 2, player: { level: 3 } })).ok, false, 'no class / position');
  eq(parseSave(JSON.stringify(good({ v: 99 }))).ok, false, 'newer version');
});
test('bad numbers are repaired (no negative gold / EXP)', () => {
  const r = parseSave(JSON.stringify(good({ player: { classId: 'x', level: -5, exp: -10, gold: -99, x: 1, y: 1 } })));
  ok(r.ok, r.error); eq(r.data.player.gold, 0); eq(r.data.player.exp, 0); eq(r.data.player.level, 1);
});

console.log('save system');
test('save -> load round trip through the adapter', () => {
  const store = new MemoryAdapter(), s = new SaveSystem(fakeGame({ level: 7, gold: 321 }), store);
  ok(s.save(), s.lastError); const d = s.load(); ok(d, s.lastError); eq(d.player.level, 7); eq(d.player.gold, 321); eq(d.player.map, 'lumina');
});
test('no saving while dead or in a boss fight (reason reported)', () => {
  const g = fakeGame({ level: 1, gold: 0 }), s = new SaveSystem(g, new MemoryAdapter());
  g.world.bossActive = true; ok(!s.save() && /boss/.test(s.lastError), 'boss');
  g.world.bossActive = false; g.player.dead = true; ok(!s.save() && /defeated/.test(s.lastError), 'dead');
});
test('damaged main save falls back to the previous good save', () => {
  const store = new MemoryAdapter(), g = fakeGame({ level: 3, gold: 10 }), s = new SaveSystem(g, store);
  s.save(); g.player.level = 5; s.save();            // backup = level 3, main = level 5
  store.write(KEY, '{"v":2,"player":'); // crash mid-write / tampering
  const d = s.load(); ok(d && s.usedBackup, 'used backup'); eq(d.player.level, 3); ok(/backup/.test(s.lastError), s.lastError);
  s.reset(); eq(s.load(), null); eq(s.exists(), false);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
