// Unit tests for the data-driven Quest System. Run:  node tools/tests/quest.test.mjs
import { Quests } from '../../src/quests/quests.js';
import { QUESTS } from '../../src/data/quests.js';
import { EventBus } from '../../src/core/events.js';
import { ITEMS } from '../../src/items/items.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

const DATA = {
  first: {
    id: 'first', name: 'FIRST', giver: 'guide', ordered: true, rewards: { exp: 10, gold: 5 },
    objectives: [
      { id: 'talk', type: 'talk', npc: 'guide', text: 'Talk' },
      { id: 'exit', type: 'reach', zone: 2, text: 'Exit' },
      { id: 'hunt', type: 'kill', target: 'any', count: 2, text: 'Hunt' },
      { id: 'return', type: 'talk', npc: 'guide', text: 'Return' },
    ],
  },
  mats: { id: 'mats', name: 'MATS', giver: 'smith', objectives: [{ id: 'c', type: 'collect', item: 'wolf_fang', count: 3, text: 'Fangs' }], rewards: {} },
  boss: {
    id: 'boss', name: 'BOSS', giver: 'elder', objectives: [
      { id: 'a', type: 'flag', flag: 'x', text: 'A' },
      { id: 'b', type: 'boss', boss: 'guardian', finalizes: true, text: 'B' },
      { id: 'r', type: 'talk', npc: 'elder', text: 'R' },
    ], rewards: {},
  },
  locked: { id: 'locked', name: 'L', giver: 'guide', requirements: [{ type: 'quest', id: 'first' }], objectives: [{ id: 'a', type: 'flag', flag: 'y' }], rewards: {} },
};
const make = () => {
  const events = new EventBus(), seen = [], inv = {};
  const g = { events, save: { dirty: false }, world: { state: { flags: {} }, currentZone: 1 },
    inventory: { count: (id) => inv[id] || 0 }, player: { cls: { id: 'x' } } };
  ['questAccepted', 'questUpdated', 'questCompleted'].forEach((n) => events.on(n, (e) => seen.push([n, e])));
  const q = new Quests(g, DATA);
  return { g, q, seen, inv, emit: (n, e) => events.emit(n, e) };
};

console.log('quest system');
test('real quest data is valid (types, npc/zone/item fields, rewards)', () => {
  const types = new Set(['kill', 'collect', 'talk', 'reach', 'boss', 'flag']);
  for (const [id, q] of Object.entries(QUESTS)) {
    eq(q.id, id); ok(q.name && q.description, id + ' text');
    for (const o of q.objectives) ok(types.has(o.type) && o.id && o.text, `${id}.${o.id}`);
    for (const it of Object.keys((q.rewards || {}).items || {})) ok(ITEMS[it], `${id} reward ${it}`);
  }
  ok(QUESTS.beyond_lumina.autoStart && QUESTS.beyond_lumina.objectives.at(-1).type === 'talk', 'first quest = auto + turn-in');
});
test('ordered quest: talk -> exit -> kill 2 -> return, one step per event, rewards once', () => {
  const { q, seen, emit } = make();
  ok(q.accept('first'), 'accepted');
  emit('enemyDefeated', { type: 'wolf' }); eq(q.active.first.progress.hunt, undefined, 'kills before unlock do not count');
  emit('npcTalked', { id: 'guide' });
  ok(q.active.first.done.talk && !q.active.first.done.return, 'talk ticks only the first talk objective');
  emit('zoneEnter', 2); emit('enemyDefeated', { type: 'wolf' }); emit('enemyDefeated', { type: 'goblin', summoned: true });
  eq(q.active.first.progress.hunt, 1, 'summoned kills ignored'); emit('enemyDefeated', { type: 'goblin' });
  ok(q.active.first.done.hunt, 'hunt done');
  emit('npcTalked', { id: 'guide' });
  ok(q.isDone('first') && !q.isActive('first'), 'completed');
  eq(seen.filter(([n]) => n === 'questCompleted').length, 1);
  emit('npcTalked', { id: 'guide' }); ok(!q.accept('first'), 'cannot accept / complete twice');
  eq(seen.filter(([n]) => n === 'questCompleted').length, 1, 'still one completion');
  eq(seen.find(([n]) => n === 'questCompleted')[1].reward.gold, 5);
});
test('accepting from the giver counts as its first talk objective', () => {
  const { q } = make();
  q.accept('first', { npc: 'guide' }); ok(q.active.first.done.talk, 'talk done');
});
test('collect objective follows the inventory count', () => {
  const { q, inv, emit } = make();
  inv.wolf_fang = 1; q.accept('mats'); eq(q.active.mats.progress.c, 1);
  inv.wolf_fang = 4; emit('itemCollected', { id: 'wolf_fang' }); ok(q.isDone('mats'), 'done at 3+');
});
test('boss objective finalizes earlier ones but the report is still needed', () => {
  const { q, emit } = make();
  q.accept('boss'); emit('bossDefeated', { type: 'guardian' });
  ok(q.active.boss.done.a && q.active.boss.done.b && !q.active.boss.done.r, 'finalized, report pending');
  ok(q.npcHasNews('elder'), 'elder shows the turn-in marker');
  eq(q.target().npc, 'guide', 'no objective markers -> point at a giver with a main quest');
  emit('npcTalked', { id: 'elder' }); ok(q.isDone('boss'), 'reported');
});
test('requirements gate acceptance; load drops unknown quests', () => {
  const { q } = make();
  ok(!q.canAccept('locked') && !q.accept('locked'), 'locked'); ok(q.npcHasNews('guide'), 'guide still has "first"');
  q.completed.first = true; ok(q.canAccept('locked'), 'unlocked after first');
  q.load({ active: { ghost: { progress: {}, done: {} }, mats: { progress: {}, done: {} } }, completed: { gone: true } });
  ok(!q.active.ghost && q.active.mats && !q.completed.gone, 'cleaned');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
