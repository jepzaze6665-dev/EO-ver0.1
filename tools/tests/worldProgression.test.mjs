// Unit tests for V2.2 World Progression + Boss Gate + Boss foundation (pure parts + data validation).
// Run:  node tools/tests/worldProgression.test.mjs
import { BOSSES, liveBosses } from '../../src/data/bosses.js';
import { ROUTES } from '../../src/data/routes.js';
import { WORLD_TRIGGERS } from '../../src/data/worldTriggers.js';
import { MAPS } from '../../src/maps/mapRegistry.js';
import { QUESTS } from '../../src/data/quests.js';
import { LOOT_TABLES } from '../../src/data/lootTables.js';
import { ITEMS } from '../../src/items/items.js';
import { MONSTERS } from '../../src/monsters/monsterTypes.js';
import { LORE } from '../../src/world/narrative.js';
import { BOSS_STATE as S, nextBossState } from '../../src/boss/bossState.js';
import { evaluate, allMet } from '../../src/progression/requirements.js';
import { WorldProgression } from '../../src/world/worldProgression.js';
import { WorldTriggerSystem, TRIGGER_ACTIONS, parseAction } from '../../src/world/worldTriggerSystem.js';
import { SaveSystem } from '../../src/save/save.js';
import { EventBus } from '../../src/core/events.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

const mapIds = new Set(MAPS.map((m) => m.id));
const MOVE_KINDS = ['combo', 'strike', 'dash', 'leap', 'volley', 'pattern', 'nova', 'summon']; // boss/areaBoss.js KINDS

console.log('boss data');
test('every live boss: its map exists, arena, phases, moves, rewards are valid', () => {
  for (const b of liveBosses()) {
    ok(mapIds.has(b.map), `${b.id}: map ${b.map}`);
    ok(['area', 'major', 'mini'].includes(b.type), `${b.id}: type`);
    if (b.type === 'mini') ok(!(b.unlocks || []).length, `${b.id}: a mini-boss gates nothing`);
    ok(b.arena && b.arena.center && b.arena.radius > 0 && b.arena.trigger < b.arena.radius, `${b.id}: arena`);
    ok(b.phases.length >= 1 && b.phases[0].hpBelow === 1, `${b.id}: first phase starts at 100%`);
    for (let i = 1; i < b.phases.length; i++) ok(b.phases[i].hpBelow < b.phases[i - 1].hpBelow, `${b.id}: phases in HP order`);
    if (b.impl === 'area') {
      ok(b.stats && b.stats.hp > 0, `${b.id}: stats`);
      for (const ph of b.phases) for (const m of ph.moves) ok(b.moves[m], `${b.id}: move ${m} missing`);
      for (const [id, m] of Object.entries(b.moves)) {
        ok(MOVE_KINDS.includes(m.kind), `${b.id}.${id}: kind ${m.kind}`);
        if (m.kind === 'summon') ok(MONSTERS[m.monster], `${b.id}.${id}: monster ${m.monster}`);
        else ok(m.power > 0, `${b.id}.${id}: power`);
      }
    }
    const r = b.rewards || {};
    if (r.loot) ok(LOOT_TABLES[r.loot], `${b.id}: loot table ${r.loot}`);
    for (const it of Object.keys(r.items || {})) ok(ITEMS[it], `${b.id}: item ${it}`);
    if (r.lore) ok(LORE[r.lore], `${b.id}: lore ${r.lore}`);
    for (const u of b.unlocks || []) ok(mapIds.has(u) || Object.values(ROUTES).some((rt) => rt.steps.some((s) => s.map === u) || (rt.cityPlanned && rt.to === u)), `${b.id}: unlocks ${u}`);
  }
});
test('Route A (W2): A1 boss = the Guardian; A2 / A3 bosses planned; A3 is the major boss; A1 mini-bosses optional', () => {
  const [a1, a2, a3] = ROUTES.A.steps.map((s) => BOSSES[s.boss]);
  ok(a1.impl === 'guardian' && a1.type === 'area' && a1.map === 'arena' && a1.unlocks.includes('a2'), 'A1 boss');
  ok(!a2.planned && a2.map === 'rift' && MAPS.find((m) => m.id === 'rift').parent === 'a2' && a2.phases.length === 2 && a2.level > a1.level, 'A2 boss live, in its own arena map (rift, part of A2)');
  ok(!a3.planned && a3.type === 'major' && a3.map === 'sanctum' && a3.phases.length === 3 && a3.level > a2.level, 'A3 major boss live, 3 phases, in its own arena');
  const minis = liveBosses().filter((b) => b.type === 'mini');
  ok(minis.length === 2 && minis.every((b) => b.map === 'a1' && b.level < a1.level), 'minis in A1, weaker than its boss');
});

console.log('maps / routes / gates');
test('routes: playable steps name real maps + bosses; planned ones name planned bosses', () => {
  for (const r of Object.values(ROUTES)) {
    ok(mapIds.has(r.from) && (mapIds.has(r.to) || r.cityPlanned), `${r.id}: cities`);
    for (const s of r.steps) {
      ok(BOSSES[s.boss], `${r.id}: boss ${s.boss}`);
      // a playable route: every built step names its boss on the map; steps without a map have a planned boss
      if (r.playable && mapIds.has(s.map)) ok(MAPS.find((m) => m.id === s.map).bossId === s.boss, `${r.id}: ${s.map} bossId`);
      else ok(BOSSES[s.boss].planned, `${r.id}: ${s.boss} should be planned`);
    }
  }
});
test('map requirements / gates / exits use known requirement types and real maps', () => {
  for (const m of MAPS) {
    for (const r of m.requires || []) ok(!evaluate(r, {}).unknown, `${m.id}: requires ${r.type}`);
    for (const gt of m.gates || []) {
      ok(gt.rect.length === 4 && gt.requires.length, `${m.id}.${gt.id}: gate data`);
      for (const r of gt.requires) ok(!evaluate(r, {}).unknown, `${m.id}.${gt.id}: ${r.type}`);
    }
    for (const e of m.exits) ok(mapIds.has(e.to), `${m.id}.${e.id} -> ${e.to}`);
    if (m.type === 'field') ok(m.route && m.bossId && BOSSES[m.bossId], `${m.id}: field needs route + bossId`);
  }
});
test('boss gate chain (W2): A2 needs the A1 boss (not the mini-bosses); the secret city opens with it too', () => {
  const need = (id, ctx) => allMet(MAPS.find((m) => m.id === id).requires, ctx);
  const bosses = (...b) => ({ bosses: new Set(b) });
  ok(need('a1', bosses()) && !need('a2', bosses()) && need('a2', bosses('boss_a1')), 'A2');
  ok(!need('a2', bosses('mini_hollow_fang', 'mini_grukk')), 'mini-bosses open nothing');
  ok(!need('valehaven', bosses()) && need('valehaven', bosses('boss_a1')) && MAPS.find((m) => m.id === 'valehaven').secret, 'Valehaven');
});

console.log('requirements (world types)');
test('boss_defeated / map_unlocked / map_visited / event; requiredBossId alias; unknown never passes', () => {
  const ctx = { bosses: new Set(['boss_a1']), maps: new Set(['a2']), visited: new Set(['a1']), events: new Set(['e1']) };
  ok(evaluate({ type: 'boss_defeated', boss: 'boss_a1' }, ctx).met && evaluate({ type: 'boss_defeated', requiredBossId: 'boss_a1' }, ctx).met, 'boss');
  ok(!evaluate({ type: 'boss_defeated', boss: 'boss_a2' }, ctx).met, 'boss 2');
  ok(evaluate({ type: 'map_unlocked', map: 'a2' }, ctx).met && !evaluate({ type: 'map_unlocked', map: 'a3' }, ctx).met, 'map');
  ok(evaluate({ type: 'map_visited', map: 'a1' }, ctx).met && evaluate({ type: 'event', id: 'e1' }, ctx).met, 'visited / event');
  ok(!evaluate({ type: 'boss_dead' }, ctx).met, 'typo');
  ok(!evaluate({ type: 'boss_defeated', boss: 'boss_a1' }, {}).met, 'empty context');
});

console.log('boss state machine');
test('HIDDEN -> IDLE -> ENGAGED <-> PHASE_CHANGE -> DEFEATED', () => {
  const base = { alreadyDefeated: false, canAppear: true, playerInTrigger: false, playerAlive: true, entityDead: false, transitioning: false, reset: false };
  eq(nextBossState(S.HIDDEN, { ...base, canAppear: false }), S.HIDDEN);
  eq(nextBossState(S.HIDDEN, base), S.IDLE);
  eq(nextBossState(S.IDLE, base), S.IDLE);
  eq(nextBossState(S.IDLE, { ...base, playerInTrigger: true }), S.ENGAGED);
  eq(nextBossState(S.IDLE, { ...base, playerInTrigger: true, playerAlive: false }), S.IDLE, 'a dead player never engages');
  eq(nextBossState(S.ENGAGED, { ...base, transitioning: true }), S.PHASE_CHANGE);
  eq(nextBossState(S.PHASE_CHANGE, base), S.ENGAGED);
  eq(nextBossState(S.ENGAGED, { ...base, entityDead: true }), S.DEFEATED);
  eq(nextBossState(S.DEFEATED, { ...base, playerInTrigger: true }), S.DEFEATED, 'final');
});
test('RESET -> IDLE; a saved kill skips straight to DEFEATED (never mid-fight)', () => {
  const base = { alreadyDefeated: false, canAppear: true, playerInTrigger: false, playerAlive: true, entityDead: false, transitioning: false, reset: false };
  eq(nextBossState(S.ENGAGED, { ...base, reset: true }), S.RESET);
  eq(nextBossState(S.RESET, base), S.IDLE);
  eq(nextBossState(S.HIDDEN, { ...base, alreadyDefeated: true }), S.DEFEATED);
  eq(nextBossState(S.ENGAGED, { ...base, alreadyDefeated: true }), S.ENGAGED);
});

// a tiny fake game: only what WorldProgression / WorldTriggerSystem read
const fakeGame = () => {
  const events = new EventBus(), seen = [];
  const g = {
    events, playTime: 12, save: { dirty: false },
    world: { state: { maps: {}, hidden: {}, flags: {}, lore: {} }, setFlag(f) { this.state.flags[f] = true; events.emit('flag', f); } },
    quests: { completed: {}, accepted: [], accept(id) { this.accepted.push(id); return true; } },
    ui: { banner: (...a) => seen.push(['banner', ...a]), notify: (...a) => seen.push(['notify', ...a]), callout: () => {}, bossTitle: () => {} },
    camera: { lookAt: () => {} }, after: () => {}, player: { x: 0, y: 0 },
  };
  g.worldProgress = new WorldProgression(g);
  return { g, seen };
};

console.log('world progression');
test('new game: maps without requirements are unlocked; a boss kill unlocks the next map (event)', () => {
  const { g } = fakeGame(), wp = g.worldProgress, unlocked = [];
  g.events.on('mapUnlocked', (e) => unlocked.push(e.id));
  wp.refreshUnlocks('start');
  ok(wp.isMapUnlocked('lumina') && wp.isMapUnlocked('a1') && !wp.isMapUnlocked('a2'), 'start');
  eq(wp.defeatBoss('boss_a1'), true, 'first kill');
  eq(wp.defeatBoss('boss_a1'), false, 'second kill is not "first"');
  ok(wp.isMapUnlocked('a2') && unlocked.includes('a2'), 'A2');
  const { g: g2 } = fakeGame(); g2.worldProgress.refreshUnlocks('start');
  ok(g2.worldProgress.lockReason('a2').includes('Guardian'), 'lock reason comes from data');
});
test('flag requirement (Guardian Gate) unlocks the arena; the A1 boss opens A2 + Valehaven', () => {
  const { g } = fakeGame(), wp = g.worldProgress;
  wp.refreshUnlocks('start');
  ok(!wp.isMapUnlocked('arena'), 'sealed');
  g.world.setFlag('gateOpened');
  ok(wp.isMapUnlocked('arena'), 'flag event refreshes');
  wp.defeatBoss('boss_a1');
  ok(wp.isMapUnlocked('a2') && wp.isMapUnlocked('valehaven'), 'A2 + secret city');
});
test('save / load roundtrip + snapshot shape; unknown ids dropped', () => {
  const { g } = fakeGame(), wp = g.worldProgress;
  wp.refreshUnlocks('start'); wp.defeatBoss('boss_a1'); wp.markEvent('x'); wp.currentRoute = 'A';
  const d = JSON.parse(JSON.stringify(wp.serialize()));
  d.defeatedBosses.boss_gone = { time: 1 }; d.unlockedMaps.old_map = true;
  const { g: g2 } = fakeGame();
  g2.worldProgress.load(d);
  const w2 = g2.worldProgress;
  ok(w2.isBossDefeated('boss_a1') && w2.isMapUnlocked('a2') && w2.hasEvent('x') && w2.currentRoute === 'A', 'restored');
  ok(!w2.isBossDefeated('boss_gone') && !w2.isMapUnlocked('old_map'), 'unknown dropped');
  const s = w2.snapshot();
  for (const k of ['defeatedBosses', 'completedQuests', 'unlockedMaps', 'triggeredEvents', 'discoveredSecrets']) ok(Array.isArray(s[k]), k);
});
test('old save (before V2.2): bosses rebuilt from visited maps / guardian flag — nobody gets locked out', () => {
  const { g } = fakeGame();
  g.worldProgress.load(undefined, { flags: { guardianDefeated: true }, maps: { lumina: true, a1: true, a2: true, a3: true }, killed: { guardian: true } });
  const wp = g.worldProgress;
  ok(wp.isBossDefeated('boss_a1'), 'the Guardian (A1 boss) from the guardian kill');
  ok(wp.isMapUnlocked('a2') && wp.isMapUnlocked('valehaven'), 'maps');
  const { g: g2 } = fakeGame();
  g2.worldProgress.load(undefined, { flags: {}, maps: { lumina: true, a1: true } });
  ok(!g2.worldProgress.isBossDefeated('boss_a1') && !g2.worldProgress.isMapUnlocked('a2'), 'fresh A1 save stays gated');
});
test('route status: steps, current boss, completion', () => {
  const { g } = fakeGame(), wp = g.worldProgress;
  wp.refreshUnlocks('start');
  let st = wp.routeStatus('A');
  eq(st.steps.length, 3); ok(!st.complete && st.city && st.city.id === 'city2' && !st.city.unlocked, 'fresh: City 2 (Asteria) built but locked');
  ok(st.steps[0].id === 'a1' && !st.steps[0].planned && st.steps[1].id === 'a2' && st.steps[2].id === 'a3' && !st.steps[2].planned, 'A1 / A2 / A3 built');
  wp.defeatBoss('boss_a1');
  st = wp.routeStatus('A');
  ok(st.steps[0].bossDefeated && st.steps[1].unlocked && !st.complete, 'A1 done, A2 open');
  const sb = wp.routeStatus('B').steps; ok(!sb[0].planned && sb[0].id === 'b1' && sb[1].planned && sb[2].planned, 'route B: B1 built, B2 / B3 planned');
  for (const b of ['boss_a2', 'boss_a3']) wp.defeatBoss(b);
  st = wp.routeStatus('A');
  ok(st.complete && st.city.unlocked, 'Rune Knight down: Route A complete, City 2 open');
});

console.log('world triggers');
test('data: every trigger has actions of known types that name real maps / quests', () => {
  const ids = new Set();
  for (const t of WORLD_TRIGGERS) {
    ok(!ids.has(t.id), `duplicate ${t.id}`); ids.add(t.id);
    ok(t.on && t.actions && t.actions.length, `${t.id}: on/actions`);
    for (const raw of t.actions) {
      const a = parseAction(raw);
      ok(TRIGGER_ACTIONS[a.type], `${t.id}: action ${a.type}`);
      if (a.type === 'unlock_map') ok(mapIds.has(a.map || a.value), `${t.id}: map ${a.value}`);
      if (a.type === 'accept_quest') ok(QUESTS[a.quest || a.value], `${t.id}: quest ${a.value}`);
    }
  }
});
test('parseAction: short and object forms', () => {
  const a = parseAction('unlock_map:a2');
  ok(a.type === 'unlock_map' && a.value === 'a2', 'short');
  eq(parseAction({ type: 'banner', title: 'X' }).title, 'X');
  eq(parseAction('cutscene').type, 'cutscene');
});
test('a trigger fires once on its matching event, records it, runs actions in order', () => {
  const { g, seen } = fakeGame();
  g.worldProgress.refreshUnlocks('start');
  const sys = new WorldTriggerSystem(g, [
    { id: 't1', on: 'bossDefeated', match: { bossId: 'boss_a1' }, actions: ['unlock_map:a2', { type: 'banner', title: 'OPEN' }, 'accept_quest:route_a'] },
    { id: 'every', on: 'bossDefeated', once: false, actions: [{ type: 'notify', title: 'N' }] },
    { id: 'gated', on: 'bossDefeated', requires: [{ type: 'boss_defeated', boss: 'boss_a2' }], actions: [{ type: 'notify', title: 'NEVER' }] },
  ]);
  g.events.emit('bossDefeated', { bossId: 'boss_x' });
  ok(!g.worldProgress.hasEvent('t1') && !g.worldProgress.isMapUnlocked('a2'), 'no match');
  g.events.emit('bossDefeated', { bossId: 'boss_a1' });
  g.events.emit('bossDefeated', { bossId: 'boss_a1' });
  ok(g.worldProgress.isMapUnlocked('a2') && g.worldProgress.hasEvent('t1'), 'unlocked + recorded');
  eq(seen.filter((s) => s[0] === 'banner').length, 1, 'once');
  eq(seen.filter((s) => s[1] === 'N').length, 3, 'once:false fires every time');
  ok(!seen.some((s) => s[1] === 'NEVER'), 'requirements respected');
  eq(g.quests.accepted[0], 'route_a');
  ok(sys, 'constructed');
});

console.log('save backend');
test('SaveSystem writes through a swappable backend (LocalStorage today, server later)', () => {
  const store = {};
  const backend = { read: (k) => store[k] ?? null, write: (k, v) => { store[k] = v; }, remove: (k) => { delete store[k]; } };
  const fake = { player: { dead: false }, world: { inBossFight: () => false } };
  const s = new SaveSystem(fake, backend);
  s.snapshot = () => ({ v: 2, hello: 'world', player: { classId: 'umbral_sword', level: 1, x: 1, y: 1 } });
  ok(!s.exists(), 'empty');
  ok(s.save() && s.exists() && s.load().hello === 'world', 'roundtrip');
  fake.world.inBossFight = () => true;
  ok(!s.save(), 'never saves mid boss fight');
  s.reset(); ok(!s.exists(), 'reset');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
