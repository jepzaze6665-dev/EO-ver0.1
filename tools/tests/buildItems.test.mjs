// Character Build B4: build-making legendaries + the generic effects they use (detonateStatus, spreadStatus, aftershock,
// nova, executeTarget) and trigger onPerfectDodge. Run:  node tools/tests/buildItems.test.mjs
import { ITEMS } from '../../src/items/items.js';
import { BUILD_ITEMS } from '../../src/data/items/buildItems.js';
import { ARCHETYPES } from '../../src/data/archetypes.js';
import { itemArchetypes } from '../../src/items/archetypeSystem.js';
import { EFFECT_HANDLERS } from '../../src/items/effectSystem.js';
import { EFFECT_TYPES, TRIGGERS } from '../../src/data/items/rules.js';
import { TRIGGER_EVENTS } from '../../src/data/items/triggers.js';
import { TH_ITEMS } from '../../src/i18n/th/items.js';
import { LOOT_TABLES } from '../../src/data/lootTables.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const eq = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-6) throw new Error(`${msg} expected ${b}, got ${a}`); };

// tiny world: foes with a status map
function foe(x, y, hp = 100) {
  const map = new Map();
  return { x, y, hp, maxHp: 100, team: 2, dead: false, status: {
    get: (id) => map.get(id), has: (id) => map.has(id), remove: (id) => map.delete(id),
    add: (id, t, d) => map.set(id, { id, t, stacks: d.stacks || 1, damage: d.damage }) } };
}
function world(foes) {
  const hits = [], timers = [];
  const g = { world: { hostiles: () => foes.filter((f) => !f.dead) }, vfx: { ring() {}, text() {}, bolt() {} },
    combat: { dealDamage: (src, t, o) => { hits.push([t, o.power]); t.hp -= o.power; if (t.hp <= 0) t.dead = true; } },
    after: (s, fn) => timers.push(fn) };
  return { g, hits, run: () => timers.splice(0).forEach((f) => f()) };
}
const P = { x: 0, y: 0, maxHp: 300, stats: { atk: 20 }, team: 1 };

console.log('B4 build items');
test('data: registered, each effect type / trigger known, Thai, drops somewhere', () => {
  const pool = JSON.stringify(LOOT_TABLES);
  for (const id of Object.keys(BUILD_ITEMS)) {
    ok(ITEMS[id], id);
    for (const e of ITEMS[id].effects) { ok(EFFECT_TYPES.includes(e.effect.type), id + ' effect ' + e.effect.type); ok(TRIGGERS.includes(e.trigger) && TRIGGER_EVENTS[e.trigger], id + ' trigger'); }
    ok(TH_ITEMS[id] && TH_ITEMS[id].description, id + ' Thai');
    eq((TH_ITEMS[id].effects || []).length, ITEMS[id].effects.length, id + ' Thai effects');
    ok(pool.includes(`'${id}'`) || pool.includes(`"${id}"`), id + ' drops nowhere');
  }
});
test('every archetype has a build-making legendary', () => {
  const leg = Object.keys(BUILD_ITEMS).filter((id) => BUILD_ITEMS[id].rarity === 'legendary');
  for (const a of Object.keys(ARCHETYPES)) ok(leg.some((id) => itemArchetypes(ITEMS[id]).includes(a)), a);
});
test('every archetype now has 4+ items', () => {
  for (const a of Object.keys(ARCHETYPES)) {
    const n = Object.values(ITEMS).filter((d) => d && d.tags && itemArchetypes(d).includes(a)).length;
    ok(n >= 4, `${a}: ${n}`);
  }
});
test('detonateStatus bursts the stacks and removes the status', () => {
  const f = foe(10, 0); f.status.add('bleed', 4, { stacks: 3, damage: 5 });
  const { g, hits } = world([f]);
  ok(EFFECT_HANDLERS.detonateStatus({ status: 'bleed', value: 4 }, P, { target: f }, g), 'fired');
  eq(hits[0][1], 60, '3 stacks × 5 × 4'); ok(!f.status.has('bleed'), 'removed');
});
test('spreadStatus jumps to nearby foes only', () => {
  const a = foe(0, 0), b = foe(50, 0), c = foe(500, 0); a.status.add('burn', 3, { stacks: 2, damage: 4 });
  const { g } = world([a, b, c]);
  ok(EFFECT_HANDLERS.spreadStatus({ status: 'burn', radius: 130 }, P, { target: a }, g), 'fired');
  ok(b.status.has('burn') && b.status.get('burn').stacks === 2, 'near caught'); ok(!c.status.has('burn'), 'far safe');
});
test('aftershock hits again later for a share', () => {
  const f = foe(10, 0); const { g, hits, run } = world([f]);
  EFFECT_HANDLERS.aftershock({ value: 0.45 }, P, { target: f, amount: 100 }, g);
  eq(hits.length, 0, 'not yet'); run(); eq(hits[0][1], 45);
});
test('nova hits every foe in the radius (ATK × power, capped)', () => {
  const a = foe(30, 0), b = foe(300, 0); const { g, hits } = world([a, b]);
  EFFECT_HANDLERS.nova({ power: 9, radius: 100 }, P, {}, g);
  eq(hits.length, 1); eq(hits[0][1], 60, 'power capped at 3 × 20');
});
test('executeTarget: low HP normal foe dies, bosses / elites / healthy never', () => {
  const low = foe(0, 0, 10), boss = Object.assign(foe(0, 0, 5), { isBoss: true }), elite = Object.assign(foe(0, 0, 5), { elite: true }), hi = foe(0, 0, 50);
  const { g } = world([low]);
  ok(EFFECT_HANDLERS.executeTarget({ below: 0.12 }, P, { target: low }, g) && low.dead, 'low dies');
  ok(!EFFECT_HANDLERS.executeTarget({ below: 0.12 }, P, { target: boss }, g), 'boss');
  ok(!EFFECT_HANDLERS.executeTarget({ below: 0.12 }, P, { target: elite }, g), 'elite');
  ok(!EFFECT_HANDLERS.executeTarget({ below: 0.12 }, P, { target: hi }, g), 'healthy');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
