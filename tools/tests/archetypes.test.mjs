// Character Build B1: build archetypes (data/archetypes.js + items/archetypeSystem.js) — points from worn items (tags) and
// chosen evolutions, tier modifiers join the item modifier set, tier effects run through the item effect system.
// Run:  node tools/tests/archetypes.test.mjs
import { EventBus } from '../../src/core/events.js';
import { Inventory } from '../../src/inventory/inventory.js';
import { Equipment } from '../../src/equipment/equipment.js';
import { ItemEffectSystem } from '../../src/items/effectSystem.js';
import { ITEMS } from '../../src/items/items.js';
import { ARCHETYPES, ARCHETYPE_RULES } from '../../src/data/archetypes.js';
import { itemArchetypes, archetypePoints, activeArchetypeBonuses, archetypeSummary, buildName, archetypeProblems } from '../../src/items/archetypeSystem.js';
import { CLASSES } from '../../src/skills/classes.js';
import { evolutionsOf } from '../../src/progression/skillEvolution.js';
import { TH_ARCHETYPES } from '../../src/i18n/th/archetypes.js';
import { applySkillMods } from '../../src/combat/combat.js';
import { installSkillTraits } from '../../src/progression/skillTraits.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

function game(evos = {}) {
  const g = { time: 0, events: new EventBus(), audio: { sfx() {} }, vfx: { text() {} } };
  g.combat = { inCombat: true, dealDamage() {} };
  g.inventory = new Inventory(g); g.equipment = new Equipment(g);
  const skills = CLASSES.umbral_sword.skills.filter(Boolean);
  const p = { team: 'player', hp: 300, maxHp: 300, dead: false, level: 30, x: 0, y: 0, cls: { id: 'umbral_sword' }, recomputeStats() {},
    gearMod: (t) => g.equipment.getModifierValue(t), stats: { atk: 20 },
    skillSys: { skills: Object.fromEntries(skills.map((s) => [s.id, s])), cooldowns: { remaining: () => 0 } },
    skillEvolution: (id) => evos[id] || null };
  g.player = p;
  g.fx = new ItemEffectSystem(g);
  const wear = (...ids) => { for (const id of ids) { g.inventory.add(id); ok(g.equipment.equip(id), 'equip ' + id + ' ' + g.equipment.lastError); } };
  return { g, p, wear };
}

console.log('Build archetypes');
test('data is valid', () => { const pr = archetypeProblems(); ok(!pr.length, pr.join('\n')); });
test('every archetype has Thai (name, description, tiers, effects)', () => {
  for (const [id, a] of Object.entries(ARCHETYPES)) {
    const th = TH_ARCHETYPES[id]; ok(th && th.name && th.description, id);
    eq((th.tiers || []).length, a.tiers.length, id + ' tiers');
    eq((th.effects || []).length, a.tiers.reduce((n, t) => n + (t.effects || []).length, 0), id + ' effects');
  }
});
test('items are read from their tags', () => {
  const a = itemArchetypes(ITEMS.relic_bloodletter);
  ok(a.includes('bleed'), 'bloodletter = bleed: ' + a);
  ok(itemArchetypes({ tags: ['bleed'], archetypes: ['burn'] }).join() === 'burn', 'explicit list wins');
});
test('points: items once each, evolutions count ARCHETYPE_RULES.evolutionPoints', () => {
  const pts = archetypePoints(['relic_bloodletter', 'rune_red_thirst', 'relic_bloodletter'], ['bleed']);
  eq(pts.bleed.points, 2 + ARCHETYPE_RULES.evolutionPoints, 'bleed');
  eq(pts.bleed.items, 2); eq(pts.bleed.evolutions, 1);
});
test('tiers turn on at their points', () => {
  eq(activeArchetypeBonuses({ critical: { points: 2 } }).length, 0);
  eq(activeArchetypeBonuses({ critical: { points: 3 } }).length, 1);
  eq(activeArchetypeBonuses({ critical: { points: 5 } }).length, 2);
});
test('summary + build name', () => {
  const s = archetypeSummary({ critical: { points: 4, items: 4, evolutions: 0 }, bleed: { points: 1, items: 1, evolutions: 0 } });
  eq(s[0].id, 'critical'); eq(s[0].next, 5); ok(s[0].focus, 'focus'); ok(!s[1].focus, 'bleed not in focus');
  eq(buildName({ critical: { points: 4 } }), 'Critical');
});
test('every Umbral Sword evolution names a real archetype', () => {
  for (const s of CLASSES.umbral_sword.skills.filter(Boolean)) for (const e of evolutionsOf(s)) ok(ARCHETYPES[e.archetype], `${s.id}/${e.id}`);
});
test('worn items: tier modifier joins the item modifier set', () => {
  const { g, wear } = game();
  const before = g.equipment.getModifierValue('critChance');
  wear('core_shadow_fang', 'charm_assassin', 'rune_full_moon');
  const pts = g.equipment.archetypePoints();
  ok(pts.critical && pts.critical.points >= 3, 'critical points ' + JSON.stringify(pts.critical));
  const items = ['core_shadow_fang', 'charm_assassin', 'rune_full_moon'].reduce((n, id) => n + ITEMS[id].modifiers.filter((m) => m.type === 'critChance').reduce((a, m) => a + m.value, 0), 0);
  ok(Math.abs(g.equipment.getModifierValue('critChance') - before - items - 0.05) < 1e-9, 'tier 3 = +5% crit');
});
test('chosen evolution adds points + effects get indexed', () => {
  const { g, wear } = game({ shade_step: 'shade_reaper', shadow_slash: 'shadow_fang' });
  wear('core_nightglass'); // tags burst -> execute +1
  const pts = g.equipment.archetypePoints();
  eq(pts.execute.points, 1 + 2 * ARCHETYPE_RULES.evolutionPoints, 'execute');
  const idx = g.fx.index();
  ok((idx.onKill || []).some((e) => e.archetype === 'execute'), 'execute tier 5 effect indexed');
});
test('evolution change rebuilds the modifiers (build key)', () => {
  const evos = {};
  const { g } = game(evos);
  const k1 = g.equipment.buildKey();
  evos.shade_step = 'twin_shade';
  ok(g.equipment.buildKey() !== k1, 'key changes');
  eq(g.equipment.archetypePoints().momentum.points, ARCHETYPE_RULES.evolutionPoints);
});

console.log('B2: Umbral evolutions + build traits');
test('every Umbral Sword active skill has 2+ evolutions on 2+ different archetypes', () => {
  for (const s of CLASSES.umbral_sword.skills.filter((x) => x && x.type === 'active')) {
    const evs = evolutionsOf(s);
    ok(evs.length >= 2, `${s.id}: ${evs.length}`);
    ok(new Set(evs.map((e) => e.archetype)).size >= 2, `${s.id}: one archetype only`);
  }
});
test('EVERY class: each active skill has 2+ evolutions on 2+ archetypes, all real, ids unique', () => {
  for (const c of Object.values(CLASSES)) for (const s of c.skills.filter((x) => x && x.type === 'active')) {
    const evs = evolutionsOf(s);
    ok(evs.length >= 2, `${c.id}/${s.id}: ${evs.length}`);
    ok(evs.every((e) => ARCHETYPES[e.archetype]), `${c.id}/${s.id}: ${evs.map((e) => e.id + ':' + e.archetype)}`);
    ok(new Set(evs.map((e) => e.archetype)).size >= 2, `${c.id}/${s.id}: one archetype`);
    ok(new Set(evs.map((e) => e.id)).size === evs.length, `${c.id}/${s.id}: duplicate ids`);
  }
});
test('Umbral evolutions cover 7+ archetypes', () => {
  const a = new Set(CLASSES.umbral_sword.skills.filter(Boolean).flatMap((s) => evolutionsOf(s).map((e) => e.archetype)));
  ok(a.size >= 7, [...a].join());
});
test('execute + keen: applySkillMods scales power on low-HP foes and adds crit', () => {
  const owner = { castMods: { skillId: 'x', power: 1, area: 1, flags: {}, values: { executeBelow: 0.35, executeMult: 1.7, critBonus: 0.25 } } };
  const o = applySkillMods({ owner, power: 2 }, ['r']);
  eq(o.powerFor({ hp: 10, maxHp: 100 }), 3.4, 'wounded');
  eq(o.powerFor({ hp: 90, maxHp: 100 }), 2, 'healthy');
  eq(o.critBonus, 0.25, 'crit');
});
test('inflict / marking / ward / reflex run from the skill events', () => {
  const ev = new EventBus(), mods = { flags: { inflict: true, marking: true, ward: true, reflex: true }, values: {} };
  const statuses = [], cd = { s1: 5 };
  const p = { maxHp: 200, stats: { atk: 20 }, markId: 'shadow', marks: 0, addMark(n) { this.marks += n; }, heal() {}, gainResource() {},
    status: { add: (id, t, d) => statuses.push(['self', id, d.amount]) },
    skillSys: { get: () => ({ id: 's1' }), skills: { s1: { id: 's1' } }, cooldowns: { remaining: (id) => cd[id], reduce: (id, s) => { cd[id] = Math.max(0, cd[id] - s); } } },
    skillMods: () => mods };
  const g = { events: ev, player: p, time: 10 };
  installSkillTraits(g);
  const foe = { status: { add: (id, t, d) => statuses.push(['foe', id, d.damage]) } };
  ev.emit('skillUsed', { caster: p, skillId: 's1' });
  ev.emit('skillHit', { source: p, target: foe, amount: 30, skillId: 's1', opts: {} });
  ev.emit('skillHit', { source: p, target: foe, amount: 30, skillId: 's1', opts: {} }); // same moment: no second mark
  ev.emit('perfectDodge', {});
  ok(statuses.some((s) => s[0] === 'self' && s[1] === 'shield' && s[2] === 16), 'ward shield 8% of 200: ' + JSON.stringify(statuses));
  eq(statuses.filter((s) => s[0] === 'foe' && s[1] === 'bleed').length, 2, 'bleed per hit');
  eq(p.marks, 1, 'one mark per markGap');
  eq(cd.s1, 0, 'reflex reset');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
