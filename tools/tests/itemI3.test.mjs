// Item system I3: Umbral / Astral / universal items — class-line restriction, tradeoffs, every item obtainable, and the new
// effects / triggers / conditions they use (applyStatus bleed, addMark, onMarksFull, onMarkTriggered, marksAtLeast, skillIs).
// Run:  node tools/tests/itemI3.test.mjs
import { EventBus } from '../../src/core/events.js';
import { Inventory } from '../../src/inventory/inventory.js';
import { Equipment } from '../../src/equipment/equipment.js';
import { ItemEffectSystem } from '../../src/items/effectSystem.js';
import { checkCondition } from '../../src/items/conditionSystem.js';
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { Cooldowns } from '../../src/combat/cooldownSystem.js';
import { RESOURCES } from '../../src/data/resources.js';
import { STATUSES } from '../../src/data/statuses.js';
import { ITEMS } from '../../src/items/items.js';
import { canClassUse, classLine, itemProblems } from '../../src/items/itemDefs.js';
import { UMBRAL_ITEMS } from '../../src/data/items/umbralItems.js';
import { ASTRAL_ITEMS } from '../../src/data/items/astralItems.js';
import { UNIVERSAL_ITEMS } from '../../src/data/items/universalItems.js';
import { itemSources } from '../../src/loot/lootSystem.js';
import { BOSSES } from '../../src/data/bosses.js';
import { CLASSES } from '../../src/skills/classes.js';
import { classLabel } from '../../src/ui/itemTooltip.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const I3 = { ...UMBRAL_ITEMS, ...ASTRAL_ITEMS, ...UNIVERSAL_ITEMS };

// a small game (real bus / inventory / equipment / resources), class picked per test
function game(classId = 'umbral_sword', { mark = null, enemyMark = null, resource = 'shadow_gauge', skills = {} } = {}) {
  const g = { time: 0, events: new EventBus(), audio: { sfx() {} }, vfx: { text() {} }, applied: [] };
  g.combat = { inCombat: true, dealDamage() {} };
  g.marks = { get: () => 0, list: () => [], apply: (t, id, o) => { g.applied.push({ t, id, o }); return { added: 1 }; } };
  g.inventory = new Inventory(g); g.equipment = new Equipment(g);
  const p = {
    team: 'player', hp: 200, maxHp: 300, dead: false, level: 30, x: 0, y: 0, primaryResource: resource, stats: { atk: 40 },
    cls: { id: classId, enemyMark }, markId: mark, marks: 0,
    addMark(n) { this.marks = Math.min(3, this.marks + n); },
    resources: new ResourcePool([resource, 'stamina'], RESOURCES, { stats: () => ({}), onChange: (e) => g.events.emit('resourceChanged', { entity: p, ...e }) }),
    skillSys: { skills, cooldowns: new Cooldowns() },
    status: { added: [], add(id, d, o) { this.added.push({ id, d, o }); return {}; } },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    recomputeStats() {}, gearMod: (t) => g.equipment.getModifierValue(t),
  };
  g.player = p; g.fx = new ItemEffectSystem(g);
  const wear = (...ids) => { for (const id of ids) { g.inventory.add(id); ok(g.equipment.equip(id), 'equip ' + id + ' ' + g.equipment.lastError); } };
  const foe = () => ({ team: 'enemy', dead: false, status: { added: [], has(id) { return this.added.some((x) => x.id === id); }, add(id, d, o) { this.added.push({ id, d, o }); return {}; } } });
  return { g, p, wear, foe };
}

console.log('data');
test('20 new items: 9 Umbral line, 8 Astral line, 6 universal; all pass the data check', () => {
  eq(Object.keys(UMBRAL_ITEMS).length, 9); eq(Object.keys(ASTRAL_ITEMS).length, 8); eq(Object.keys(UNIVERSAL_ITEMS).length, 6);
  for (const id of Object.keys(I3)) eq(itemProblems(ITEMS[id], Object.keys(CLASSES)).join(' '), '', id);
});
test('TRADEOFF: every non-rune item has a minus modifier (runes pay with a condition / cooldown)', () => {
  for (const [id, d] of Object.entries(I3)) {
    if (d.type === 'rune') { ok(d.effects.every((e) => e.condition || e.cooldown >= 1 || /full|detonat/i.test(e.text)), id + ' rune limit'); continue; }
    ok(d.modifiers.some((m) => (m.type === 'resourceCost' ? m.value > 0 : m.value < 0)) || /less/.test(d.modText || ''), id + ' has no tradeoff');
  }
});
test('every new item can be found: a loot table or boss reward gives it', () => {
  for (const id of Object.keys(I3)) ok(itemSources(id).length > 0, id + ' has no source');
});
test('A2+ mini-bosses pay a relic from the mini_relic table', () => {
  const minis = Object.values(BOSSES).filter((b) => b.rewards && b.rewards.loot === 'mini_relic');
  eq(minis.length, 5);
});
test('bleed is a damage-over-time status (physical, stacks to 5)', () => {
  const b = STATUSES.bleed; eq(b.category, 'dot'); eq(b.dot.type, 'physical'); eq(b.maxStacks, 5);
});

console.log('class line');
test("'line:umbral_sword' = Umbral + its 3 Class 2; not Aegis / Astral", () => {
  const d = ITEMS.core_shadow_fang;
  for (const c of ['umbral_sword', 'nightfall_reaper', 'duskrunner', 'blade_of_echoes']) ok(canClassUse(d, c), c);
  for (const c of ['aegis_guardian', 'astral_weaver', 'stormcaller']) ok(!canClassUse(d, c), c);
  eq(classLine('lumen_oracle'), 'astral_weaver'); eq(classLine('umbral_sword'), 'umbral_sword');
  eq(classLabel('line:umbral_sword'), 'Umbral Sword line');
});
test('Fallen Constellation is Astral Weaver only (it changes Starfall); equip refused for Aegis with reason "class"', () => {
  ok(canClassUse(ITEMS.core_fallen_constellation, 'astral_weaver') && !canClassUse(ITEMS.core_fallen_constellation, 'stormcaller'), 'weaver only');
  const { g, wear } = game('aegis_guardian'); g.inventory.add('core_fallen_constellation');
  ok(!g.equipment.equip('core_fallen_constellation'), 'refused'); eq(g.equipment.lastError, 'class');
  const a = game('astral_weaver', { resource: 'astral_charge' }); a.wear('core_fallen_constellation');
  const mods = {}; a.g.equipment.applyTo({}, mods);
  ok(mods.skillModifiers.some((m) => m.skillId === 'starfall_fate' && m.stat === 'cost' && m.value === 0.7), 'starfall cost modifier');
});

console.log('effects');
test("Bloodletter's Hook: a hit puts BLEED on the foe, 15% ATK per tick", () => {
  const { g, p, wear, foe } = game(); wear('relic_bloodletter');
  const f = foe(); g.events.emit('damageDealt', { source: p, target: f, amount: 10, opts: {} });
  eq(f.status.added.length, 1); eq(f.status.added[0].id, 'bleed'); eq(f.status.added[0].o.damage, 6); eq(f.status.added[0].o.source, p);
  g.events.emit('damageDealt', { source: p, target: f, amount: 10, opts: { dot: true } }); eq(f.status.added.length, 1, 'DoT ticks never re-apply');
});
test('Red Thirst: hitting a bleeding foe heals 2%, a clean foe does not', () => {
  const { g, p, wear, foe } = game(); wear('rune_red_thirst');
  g.events.emit('damageDealt', { source: p, target: foe(), amount: 10, opts: {} }); eq(p.hp, 200, 'no bleed');
  const f = foe(); f.status.added.push({ id: 'bleed' });
  g.events.emit('damageDealt', { source: p, target: f, amount: 10, opts: {} }); eq(p.hp, 206, '2% of 300');
});
test('Full Moon: marks full -> +15% crit for 4 s', () => {
  const { g, p, wear } = game(); wear('rune_full_moon');
  g.events.emit('marksFull', { player: p, mark: 'shadow_mark' }); eq(g.equipment.getModifierValue('critChance'), 0.15);
  g.time = 4.1; g.fx.update(); eq(g.equipment.getModifierValue('critChance'), 0, 'ended');
});
test('Shadow Hunger: only skills tagged consumes-marks give +15', () => {
  const skills = { shadow_break: { id: 'shadow_break', tags: ['burst', 'consumes-marks'] }, shadow_slash: { id: 'shadow_slash', tags: ['melee'] } };
  const { g, p, wear } = game('umbral_sword', { skills }); wear('rune_shadow_hunger');
  const r0 = p.resources.get('shadow_gauge'); // the gauge has a starting value
  g.events.emit('skillUsed', { caster: p, skillId: 'shadow_slash', skill: skills.shadow_slash }); eq(p.resources.get('shadow_gauge'), r0);
  g.events.emit('skillUsed', { caster: p, skillId: 'shadow_break', skill: skills.shadow_break }); eq(p.resources.get('shadow_gauge'), r0 + 15);
});
test('Shattered Orrery: your mark detonating on a foe gives +12; someone else\'s does not', () => {
  const { g, p, wear, foe } = game('astral_weaver', { resource: 'astral_charge', enemyMark: 'star_mark' }); wear('relic_orrery');
  g.events.emit('markTriggered', { source: { team: 'player' }, target: foe(), markId: 'star_mark' }); eq(p.resources.get('astral_charge'), 0);
  g.events.emit('markTriggered', { source: p, target: foe(), markId: 'star_mark' }); eq(p.resources.get('astral_charge'), 12);
});
test("Weaver's Spindle: a thread skill hit slows the foe; other skills do not", () => {
  const skills = { astral_thread: { id: 'astral_thread', tags: ['thread', 'control'] }, star_needle: { id: 'star_needle', tags: ['ranged'] } };
  const { g, p, wear, foe } = game('astral_weaver', { resource: 'astral_charge', skills }); wear('relic_spindle');
  const a = foe(), b = foe();
  g.events.emit('skillHit', { source: p, target: a, amount: 5, skillId: 'star_needle' }); eq(a.status.added.length, 0);
  g.events.emit('skillHit', { source: p, target: b, amount: 5, skillId: 'astral_thread' }); eq(b.status.added[0].id, 'slow');
});
test("Hunter's Sigil: crit adds a self mark (Umbral) or the class mark on the foe (Astral)", () => {
  const u = game('umbral_sword', { mark: 'shadow_mark' }); u.wear('rune_hunters_sigil');
  u.g.events.emit('damageDealt', { source: u.p, target: u.foe(), amount: 10, crit: true, opts: {} }); eq(u.p.marks, 1);
  const a = game('astral_weaver', { resource: 'astral_charge', enemyMark: 'star_mark' }); a.wear('rune_hunters_sigil');
  const f = a.foe(); a.g.events.emit('damageDealt', { source: a.p, target: f, amount: 10, crit: true, opts: {} });
  eq(a.g.applied.length, 1); eq(a.g.applied[0].id, 'star_mark'); eq(a.g.applied[0].t, f);
  const n = game('aegis_guardian', { resource: 'guard_gauge' }); n.wear('rune_hunters_sigil');
  n.g.events.emit('damageDealt', { source: n.p, target: n.foe(), amount: 10, crit: true, opts: {} }); eq(n.g.applied.length, 0, 'no mark class = nothing');
});
test('conditions: marksAtLeast + skillIs by id', () => {
  ok(checkCondition({ type: 'marksAtLeast', value: 2 }, { marks: 2 }) && !checkCondition({ type: 'marksAtLeast', value: 2 }, { marks: 1 }), 'marks');
  ok(checkCondition({ type: 'skillIs', skill: 'x' }, {}, { skillId: 'x' }) && !checkCondition({ type: 'skillIs', skill: 'x' }, {}, { skillId: 'y' }), 'id');
});

console.log('sets');
test('ECLIPSE 3 pieces: marks full -> shadow skills recover 1.5 s', () => {
  const skills = { shadow_slash: { id: 'shadow_slash', tags: ['shadow'] }, shade_step: { id: 'shade_step', tags: ['dash'] } };
  const { g, p, wear } = game('umbral_sword', { skills });
  p.skillSys.cooldowns.start('shadow_slash', 5); p.skillSys.cooldowns.start('shade_step', 5);
  wear('core_shadow_fang', 'relic_heart_eclipse', 'charm_assassin');
  g.events.emit('marksFull', { player: p, mark: 'shadow_mark' });
  eq(p.skillSys.cooldowns.remaining('shadow_slash'), 3.5); eq(p.skillSys.cooldowns.remaining('shade_step'), 5);
});
test('CONSTELLATION 3 pieces: a detonating mark gives a 6% barrier', () => {
  const { g, p, wear, foe } = game('astral_weaver', { resource: 'astral_charge', enemyMark: 'star_mark' });
  wear('core_star_loom', 'armor_starveil', 'rune_supernova');
  g.events.emit('markTriggered', { source: p, target: foe(), markId: 'star_mark' });
  const sh = p.status.added.find((x) => x.id === 'shield'); ok(sh && sh.o.amount === 18, 'barrier 6% of 300');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
