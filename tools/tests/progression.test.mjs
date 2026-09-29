// Unit tests for class progression: requirements, class records, trials, unlocks, secret nodes.
// Run:  node tools/tests/progression.test.mjs
import { evaluate, allMet, matches } from '../../src/progression/requirements.js';
import { Progression } from '../../src/progression/progression.js';
import { CLASS_TREE, CLASS_COUNTERS, TRIALS } from '../../src/data/classTree.js';
import { CLASSES, STARTING_CLASSES } from '../../src/skills/classes.js';
import { EventBus } from '../../src/core/events.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

// minimal game the Progression reads (no DOM)
function fakeGame(classId = 'astral_weaver', level = 30) { // Class 2 needs LV 30 (Level rework L1)
  const g = {
    events: new EventBus(), save: { dirty: false },
    player: { id: 1, level, cls: { id: classId } },
    quests: { completed: {} }, world: { state: { flags: {} }, map: { secretsFound: new Set() } },
    inventory: { count: () => 0 },
  };
  g.progression = new Progression(g);
  return g;
}

console.log('requirements');
test('every type evaluates from a plain context', () => {
  const ctx = { level: 13, classId: 'umbral_sword', questsDone: new Set(['whispers']), flags: { cave: true }, items: (id) => (id === 'ore' ? 3 : 0), secrets: 2, records: { kills: 9 }, trialsPassed: new Set(['t1']) };
  ok(evaluate({ type: 'level', min: 13 }, ctx).met && !evaluate({ type: 'level', min: 14 }, ctx).met, 'level');
  ok(evaluate({ type: 'quest', id: 'whispers' }, ctx).met && !evaluate({ type: 'quest', id: 'x' }, ctx).met, 'quest');
  ok(evaluate({ type: 'flag', flag: 'cave' }, ctx).met, 'flag');
  const c = evaluate({ type: 'counter', counter: 'kills', min: 10 }, ctx);
  ok(!c.met && c.have === 9 && c.need === 10, 'counter progress');
  ok(evaluate({ type: 'item', item: 'ore', count: 3 }, ctx).met, 'item');
  ok(evaluate({ type: 'secrets', min: 2 }, ctx).met, 'secrets');
  ok(evaluate({ type: 'trial', trial: 't1' }, ctx).met, 'trial');
  ok(evaluate({ type: 'class', id: 'umbral_sword' }, ctx).met, 'class');
  ok(evaluate({ type: 'any', of: [{ type: 'level', min: 99 }, { type: 'flag', flag: 'cave' }] }, ctx).met, 'any');
  ok(!evaluate({ type: 'all', of: [{ type: 'level', min: 99 }, { type: 'flag', flag: 'cave' }] }, ctx).met, 'all');
  ok(!evaluate({ type: 'all', of: [] }, ctx).met, 'empty all never passes');
});
test('unknown types never pass; hidden conditions hide their text until met', () => {
  ok(!evaluate({ type: 'nope' }, {}).met && !evaluate(null, {}).met, 'unknown');
  const h = evaluate({ type: 'flag', flag: 'secret', label: 'Read the black tablet', hidden: true }, { flags: {} });
  ok(!h.met && h.hidden && !h.label.includes('tablet'), 'hidden text');
  ok(evaluate({ type: 'flag', flag: 'secret', label: 'Read the black tablet', hidden: true }, { flags: { secret: 1 } }).label.includes('tablet'), 'revealed when met');
  ok(!allMet([{ type: 'level', min: 1 }, { type: 'bogus' }], { level: 5 }), 'a typo blocks the unlock');
});
test('event matching: $player, dotted paths, mismatch', () => {
  const pl = { id: 1 };
  ok(matches({ source: '$player', markId: 'star_mark' }, { source: pl, markId: 'star_mark' }, pl), 'match');
  ok(!matches({ source: '$player' }, { source: { id: 2 } }, pl), 'other source');
  ok(matches({ 'skill.ultimate': true }, { skill: { ultimate: true } }, pl) && !matches({ 'skill.ultimate': true }, { skill: {} }, pl), 'dotted');
});

console.log('class tree data');
test('tree: parents exist, trials exist, counters exist, starting classes are playable', () => {
  for (const n of Object.values(CLASS_TREE)) {
    if (n.parent) ok(CLASS_TREE[n.parent], `${n.id}: parent ${n.parent}`);
    if (n.trial) { ok(TRIALS[n.trial], `${n.id}: trial ${n.trial}`); for (const o of TRIALS[n.trial].objectives) ok(CLASS_COUNTERS[o.counter], `${n.trial}: counter ${o.counter}`); }
    for (const r of n.requirements || []) if (r.type === 'counter') ok(CLASS_COUNTERS[r.counter], `${n.id}: counter ${r.counter}`);
    if (n.playable) ok(CLASSES[n.id], `${n.id} is playable but has no class data`);
  }
  for (const id of Object.keys(CLASSES)) ok(CLASS_TREE[id] && CLASS_TREE[id].playable, `${id} missing from the tree (or not playable)`);
  for (const id of STARTING_CLASSES) ok(CLASS_TREE[id].tier === 1, `${id}: starting classes are tier 1`);
  ok(CLASS_TREE.nightfall_reaper.playable && CLASSES.nightfall_reaper, 'Nightfall Reaper is the first playable Class 2');
  ok(Object.values(CLASS_TREE).filter((n) => n.tier === 2).length === 9, '9 Class 2 paths (spec)');
});

console.log('progression');
test('class records: counted from bus events, per class, only when matching', () => {
  const g = fakeGame();
  g.events.emit('markTriggered', { markId: 'star_mark', source: g.player });
  g.events.emit('markTriggered', { markId: 'star_mark', source: { id: 99 } });
  g.events.emit('markTriggered', { markId: 'shadow_mark', source: g.player });
  g.events.emit('shieldAbsorbed', { target: g.player, amount: 25 });
  g.events.emit('shieldAbsorbed', { target: g.player, amount: NaN });
  ok(g.progression.record('astral_weaver', 'constellation_breaks') === 1, 'constellation +1 only for the player star mark');
  ok(g.progression.record('astral_weaver', 'shield_absorbed') === 25, 'sum field, NaN ignored');
  ok(g.progression.record('umbral_sword', 'constellation_breaks') === 0, 'records are per class');
});
test('paths: only children of the current class, requirements with progress', () => {
  const g = fakeGame('aegis_guardian');
  const ids = g.progression.paths().map((x) => x.node.id).sort();
  ok(JSON.stringify(ids) === JSON.stringify(['bulwark_sentinel', 'oathbreaker', 'warden_of_dawn']), ids.join());
  ok(g.progression.paths().every((x) => !x.ready && x.reqs.some((r) => !r.met)), 'not ready at level 10');
});
test('trial flow: blocked -> start -> progress since start -> pass -> unlock (+events)', () => {
  const g = fakeGame('umbral_sword', 13);
  const seen = []; ['trialStarted', 'trialPassed', 'classUnlocked'].forEach((n) => g.events.on(n, () => seen.push(n)));
  ok(g.progression.startTrial('duskrunner').reason === 'requirements', 'blocked without requirements');
  g.player.level = 30; // Class 2 base requirement = LV 30 (Level rework L1)
  for (let i = 0; i < 15; i++) g.events.emit('perfectDodge', {});
  ok(g.progression.paths().find((x) => x.node.id === 'duskrunner').ready, 'ready after 15 perfect dodges');
  ok(g.progression.startTrial('duskrunner').ok, 'start');
  ok(g.progression.startTrial('nightfall_reaper').ok === false, 'one trial at a time');
  const need = TRIALS.trial_duskrunner.objectives[0].count;
  ok(g.progression.trialView('trial_duskrunner').objectives[0].have === 0, 'progress counts from the start of the trial');
  for (let i = 0; i < need; i++) g.events.emit('perfectDodge', {});
  ok(g.progression.trials.trial_duskrunner.state === 'passed' && g.progression.unlocked.includes('duskrunner'), 'passed + unlocked');
  ok(seen.join() === 'trialStarted,trialPassed,classUnlocked', seen.join());
  ok(g.progression.tracker().length === 0, 'tracker empty after the trial');
});
test('save / load round-trip; unknown class ids in a save are dropped', () => {
  const g = fakeGame('umbral_sword', 13);
  g.progression.records.umbral_sword = { kills: 7 }; g.progression.unlocked = ['duskrunner'];
  const d = JSON.parse(JSON.stringify(g.progression.serialize()));
  d.unlocked.push('not_a_class');
  const g2 = fakeGame('umbral_sword'); g2.progression.load(d);
  ok(g2.progression.record('umbral_sword', 'kills') === 7 && JSON.stringify(g2.progression.unlocked) === '["duskrunner"]', 'restored');
});
test('SECRET CLASS by data registration: invisible until revealed, then a normal path', () => {
  CLASS_TREE.mock_secret = { id: 'mock_secret', name: 'Mock Secret', tier: 4, parent: 'astral_weaver', hidden: true,
    reveal: [{ type: 'flag', flag: 'saw_the_black_star' }], requirements: [{ type: 'level', min: 1 }], playable: false };
  try {
    const g = fakeGame('astral_weaver');
    ok(!g.progression.paths().some((x) => x.node.id === 'mock_secret'), 'hidden before the reveal');
    g.world.state.flags.saw_the_black_star = true;
    const x = g.progression.paths().find((y) => y.node.id === 'mock_secret');
    ok(x && x.ready, 'revealed and ready');
  } finally { delete CLASS_TREE.mock_secret; }
});

test('lineage (tree view): root + children with states; hidden nodes left out until revealed', () => {
  const g = fakeGame('umbral_sword', 13);
  g.progression.startingClass = 'umbral_sword';
  g.player.level = 30; // Class 2 base requirement = LV 30 (Level rework L1)
  for (let i = 0; i < 15; i++) g.events.emit('perfectDodge', {});
  g.progression.unlock('nightfall_reaper');
  const st = Object.fromEntries(g.progression.lineage().map((t) => [t.node.id, t.state]));
  ok(st.umbral_sword === 'current', 'root is current');
  ok(st.nightfall_reaper === 'owned', 'unlocked + playable -> owned: ' + st.nightfall_reaper);
  CLASS_TREE.nightfall_reaper.playable = false;
  try { ok(g.progression.lineage().find((t) => t.node.id === 'nightfall_reaper').state === 'unlocked', 'unlocked but not playable -> unlocked'); } finally { CLASS_TREE.nightfall_reaper.playable = true; }
  ok(st.duskrunner === 'ready', 'requirements met -> trial ready: ' + st.duskrunner);
  ok(st.blade_of_echoes === 'locked', 'locked');
  ok(!('astral_weaver' in st), 'other lineages are not part of this tree');
  CLASS_TREE.mock_secret2 = { id: 'mock_secret2', name: 'X', tier: 3, parent: 'duskrunner', hidden: true, reveal: [{ type: 'flag', flag: 'x' }], requirements: [] };
  try {
    ok(!g.progression.lineage().some((t) => t.node.id === 'mock_secret2'), 'hidden grandchild invisible');
    g.world.state.flags.x = true;
    const t = g.progression.lineage().find((y) => y.node.id === 'mock_secret2');
    ok(t && t.depth === 2 && t.state === 'future', 'revealed as a deeper (future) node');
  } finally { delete CLASS_TREE.mock_secret2; }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
