// Unit tests for the Hidden Content foundation + map hazard data. Run:  node tools/tests/hidden.test.mjs
import { HiddenSystem } from '../../src/world/hiddenSystem.js';
import { HIDDEN } from '../../src/data/hidden.js';
import { EventBus } from '../../src/core/events.js';
import { MAPS } from '../../src/maps/mapRegistry.js';
import { STATUSES } from '../../src/data/statuses.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

const make = (data, rng) => {
  const events = new EventBus(), found = [], flags = {};
  const g = { events, save: { dirty: false }, player: { cls: { id: 'x' }, level: 1 },
    progression: { context: () => ({ level: g.player.level, flags, questsDone: new Set() }) },
    world: { state: { hidden: {}, flags }, setFlag: (f) => { flags[f] = true; } } };
  events.on('hiddenFound', (e) => found.push(e));
  return { g, h: new HiddenSystem(g, data, rng), found, flags, emit: (n, e) => events.emit(n, e) };
};

console.log('hidden content');
test('data: every entry has id/type/trigger/reward, known map', () => {
  const maps = new Set(MAPS.map((m) => m.id));
  for (const [id, h] of Object.entries(HIDDEN)) { eq(h.id, id); ok(h.type && h.trigger && h.trigger.event && h.reward, id); ok(maps.has(h.map), id + ' map'); }
});
test('secret area: revealed by its event only, once, sets flags, pays once', () => {
  const { h, found, flags, emit } = make(HIDDEN);
  emit('secretFound', { id: 99 }); eq(found.length, 0, 'wrong id');
  emit('secretFound', { id: 1 }); emit('secretFound', { id: 1 });
  eq(found.length, 1); eq(found[0].id, 'hidden_cave'); eq(found[0].reward.exp, 60);
  ok(flags.hidden_area_found && h.found('hidden_cave'), 'flags');
});
test('conditions + chance (rare event foundation)', () => {
  const data = {
    rare: { id: 'rare', type: 'rare_event', map: 'a2', trigger: { event: 'enemyDefeated', match: { type: 'wolf' } }, chance: 0.1,
      condition: [{ type: 'level', min: 5 }], reward: { gold: 5 }, once: true, flag: 'saw_rare' },
  };
  let roll = 0.05;
  const { g, found, flags, emit } = make(data, () => roll);
  emit('enemyDefeated', { type: 'wolf' }); eq(found.length, 0, 'level too low');
  g.player.level = 5; roll = 0.5; emit('enemyDefeated', { type: 'wolf' }); eq(found.length, 0, 'failed roll');
  roll = 0.05; emit('enemyDefeated', { type: 'goblin' }); eq(found.length, 0, 'wrong monster');
  emit('enemyDefeated', { type: 'wolf' }); eq(found.length, 1); ok(flags.saw_rare && flags.hidden_rare_event_found, 'flags');
});
test('map hazards: known kinds, statuses exist, inside their map', () => {
  for (const m of MAPS) for (const hz of (m.content && m.content.hazards) || []) {
    ok(['miasma', 'thorns', 'beam'].includes(hz.kind), hz.id);
    for (const s of hz.statuses || []) ok(STATUSES[s.id], `${hz.id}: ${s.id}`);
    ok((hz.kind === 'beam' ? hz.len > 0 : hz.r > 0) && hz.tx >= 0 && hz.ty >= 0, hz.id);
  }
  const a1 = MAPS.find((m) => m.id === 'a1').content.hazards; // W2: Deep Forest + Ruins are parts of A1
  ok(a1.filter((h) => h.kind !== 'beam').length >= 2 && a1.some((h) => h.kind === 'beam'), 'A1 has mire / thorns + rune wards');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
