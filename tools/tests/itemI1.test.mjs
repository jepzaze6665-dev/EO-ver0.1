// Item system I1: offense / utility modifiers, resource max, new triggers (crit, full resource, status, boss phase),
// new conditions (targetHasStatus, statusIs), level requirement, mythic rarity, swap preview passive changes.
// Run:  node tools/tests/itemI1.test.mjs
import { EventBus } from '../../src/core/events.js';
import { Inventory } from '../../src/inventory/inventory.js';
import { Equipment } from '../../src/equipment/equipment.js';
import { ItemEffectSystem } from '../../src/items/effectSystem.js';
import { checkCondition } from '../../src/items/conditionSystem.js';
import { ModifierSet } from '../../src/items/modifierSystem.js';
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { Cooldowns } from '../../src/combat/cooldownSystem.js';
import { RESOURCES } from '../../src/data/resources.js';
import { ITEMS } from '../../src/items/items.js';
import { normalizeItem, itemProblems, meetsLevel } from '../../src/items/itemDefs.js';
import { MODIFIER_TYPES, RARITIES } from '../../src/data/items/rules.js';
import { swapPreview, itemTooltipHTML, modifierText } from '../../src/ui/itemTooltip.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const near = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };

// test-only items (added to the real table, normalised like every item)
const T = {
  t_crit_core: { name: 'Test Crit Core', type: 'weapon_core', rarity: 'rare', description: 'd', modifiers: [{ type: 'critChance', value: 0.1 }, { type: 'critDamage', value: 0.3 }, { type: 'defense', value: -0.1 }] },
  t_crit_core2: { name: 'Test Crit Core 2', type: 'weapon_core', rarity: 'epic', description: 'd', modifiers: [{ type: 'critChance', value: 0.25 }] },
  t_high_relic: { name: 'High Relic', type: 'relic', rarity: 'rare', description: 'd', levelRequirement: 20, modifiers: [{ type: 'attack', value: 0.05 }] },
  t_well_charm: { name: 'Deep Well', type: 'charm', rarity: 'uncommon', description: 'd', modifiers: [{ type: 'resourceMax', value: 20 }, { type: 'resourceGeneration', value: -0.1 }] },
  t_crit_rune: { name: 'Crit Rune', type: 'rune', rarity: 'rare', description: 'd', effects: [{ trigger: 'onCrit', effect: { type: 'gainResource', value: 5 }, cooldown: 1, text: 'Crit: +5.' }] },
  t_full_rune: { name: 'Full Rune', type: 'rune', rarity: 'rare', description: 'd', effects: [{ trigger: 'onFullResource', effect: { type: 'heal', value: 0.1 }, cooldown: 2, text: 'Full: heal 10%.' }] },
  t_status_rune: { name: 'Status Rune', type: 'rune', rarity: 'rare', description: 'd', effects: [{ trigger: 'onStatusApplied', condition: { type: 'statusIs', status: 'bleed' }, effect: { type: 'gainResource', value: 3 }, cooldown: 0.5, text: 'Bleed: +3.' }] },
  t_phase_relic: { name: 'Phase Relic', type: 'relic', rarity: 'mythic', description: 'd', effects: [{ trigger: 'onBossPhase', effect: { type: 'barrier', value: 0.2 }, duration: 6, cooldown: 10, text: 'Boss phase: barrier 20%.' }] },
};
for (const [id, d] of Object.entries(T)) ITEMS[id] = normalizeItem(id, d);

function game() {
  const g = { time: 0, events: new EventBus(), audio: { sfx() {} }, vfx: { text() {} } };
  g.combat = { inCombat: true, dealDamage() {} };
  g.marks = { get: () => 0, list: () => [] };
  g.inventory = new Inventory(g); g.equipment = new Equipment(g);
  const p = {
    team: 'player', hp: 200, maxHp: 300, dead: false, x: 0, y: 0, level: 10, primaryResource: 'guard_gauge', cls: { id: 'aegis_guardian' },
    resources: new ResourcePool(['guard_gauge', 'stamina'], RESOURCES, { stats: () => ({}), onChange: (e) => g.events.emit('resourceChanged', { entity: p, ...e }) }),
    skillSys: { skills: {}, cooldowns: new Cooldowns() },
    status: { added: [], add(id, d, o) { this.added.push({ id, d, o }); } },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    gearMod(t) { return g.equipment.getModifierValue(t); },
    recomputeStats() {
      this.stats = g.equipment.finalStats({ def: 10, hp: 300, atk: 20, crit: 0.05, critDmg: 0 });
      // the resourceMax part of Player.syncGearResources
      const add = Math.round(this.gearMod('resourceMax'));
      if (add) this.resources.addModifier({ id: 'gear_max_guard_gauge', resource: 'guard_gauge', kind: 'maxAdd', value: add });
      else this.resources.removeModifier('gear_max_guard_gauge');
    },
  };
  g.player = p;
  g.fx = new ItemEffectSystem(g);
  const wear = (...ids) => { for (const id of ids) { g.inventory.add(id); ok(g.equipment.equip(id), 'equip ' + id + ' ' + g.equipment.lastError); } };
  return { g, p, wear };
}

console.log('modifiers');
test('test items pass the data check; mythic is a rarity and needs a unique effect', () => {
  for (const id of Object.keys(T)) eq(itemProblems(ITEMS[id]).join(' '), '', id);
  ok(RARITIES.includes('mythic'), 'mythic');
  const bare = normalizeItem('x', { name: 'X', type: 'relic', rarity: 'mythic', description: 'd' });
  ok(itemProblems(bare).join(' ').includes('mythic needs a unique effect'), 'mythic check');
});
test('crit / damage / speed / healing / resistance modifiers map onto stats combat already reads', () => {
  const want = { critChance: 'crit', critDamage: 'critDmg', physicalDamage: 'physicalDmg', shadowDamage: 'shadowDmg', attackSpeed: 'attackSpeed', healingPower: 'healPower', statusResistance: 'tenacity' };
  for (const [t, s] of Object.entries(want)) eq(MODIFIER_TYPES[t].stat, s, t);
  const m = new ModifierSet(); m.addModifier('a', { type: 'critChance', value: 0.1 }); m.addModifier('b', { type: 'shadowDamage', value: 0.2 });
  const out = m.calculateStats({ crit: 0.05, atk: 10 });
  near(out.crit, 0.15, 'crit'); near(out.shadowDmg, 0.2, 'shadow'); eq(out.atk, 10, 'atk untouched');
});
test('caps: crit chance from items stops at +30%', () => {
  const m = new ModifierSet(); for (let i = 0; i < 5; i++) m.addModifier('s' + i, { type: 'critChance', value: 0.1 });
  near(m.getModifierValue('critChance'), 0.3);
});
test('equip / unequip = stats recalculated from base (base never edited); tradeoff applied', () => {
  const { g, p, wear } = game();
  p.recomputeStats(); near(p.stats.crit, 0.05);
  wear('t_crit_core');
  near(p.stats.crit, 0.15, 'crit'); near(p.stats.critDmg, 0.3, 'critDmg'); near(p.stats.def, 9, 'defense -10%');
  g.inventory.add('t_crit_core2'); ok(g.equipment.equip('t_crit_core2'), 'replace weapon core');
  near(p.stats.crit, 0.3, 'replaced'); near(p.stats.critDmg || 0, 0, 'old core gone'); near(p.stats.def, 10, 'def back');
  ok(g.inventory.findItem('t_crit_core'), 'old core back in the bag');
});
test('resourceMax: + points on the class resource max, removed on unequip; flat text "+20"', () => {
  const { g, p, wear } = game();
  p.recomputeStats(); eq(p.resources.max('guard_gauge'), 100);
  wear('t_well_charm'); eq(p.resources.max('guard_gauge'), 120); eq(p.resources.max('stamina'), RESOURCES.stamina.max, 'stamina untouched');
  p.resources.gain('guard_gauge', 200, { raw: true }); eq(p.resources.get('guard_gauge'), 120);
  ok(g.equipment.unequip('charm')); eq(p.resources.max('guard_gauge'), 100); eq(p.resources.get('guard_gauge'), 100, 'clamped');
  eq(modifierText({ type: 'resourceMax', value: 20 }), '+20 Resource Max');
});

console.log('level requirement');
test('below the level = refused with reason "level" (no crash); at the level = fine', () => {
  const { g, p } = game();
  g.inventory.add('t_high_relic');
  ok(!g.equipment.equip('t_high_relic'), 'refused'); eq(g.equipment.lastError, 'level');
  ok(g.equipment.lastErrorText().length > 0, 'text');
  p.level = 20; ok(g.equipment.equip('t_high_relic'), 'equipped at 20');
  ok(meetsLevel(ITEMS.t_high_relic, 20) && !meetsLevel(ITEMS.t_high_relic, 19), 'meetsLevel');
  ok(itemTooltipHTML(ITEMS.t_high_relic, { level: 5 }).includes('Requires LV 20'), 'tooltip');
  eq(ITEMS.core_ironheart.levelRequirement, 0, 'default 0');
});

console.log('triggers + conditions');
test('onCrit fires only on a critical hit by the wearer', () => {
  const { g, p, wear } = game(); p.recomputeStats(); wear('t_crit_rune');
  const foe = { team: 'enemy' };
  g.events.emit('damageDealt', { source: p, target: foe, amount: 10, crit: false, opts: {} }); eq(p.resources.get('guard_gauge'), 0, 'no crit');
  g.events.emit('damageDealt', { source: { team: 'player' }, target: foe, amount: 10, crit: true, opts: {} }); eq(p.resources.get('guard_gauge'), 0, 'someone else');
  g.events.emit('damageDealt', { source: p, target: foe, amount: 10, crit: true, opts: {} }); eq(p.resources.get('guard_gauge'), 5, 'crit');
  g.events.emit('damageDealt', { source: p, target: foe, amount: 10, crit: true, opts: { itemEffect: true } }); eq(p.resources.get('guard_gauge'), 5, 'item damage never');
});
test('onFullResource fires once when the resource reaches max, not while it stays full', () => {
  const { g, p, wear } = game(); p.recomputeStats(); wear('t_full_rune');
  p.resources.gain('guard_gauge', 60, { raw: true }); eq(p.hp, 200, 'not full yet');
  p.resources.gain('guard_gauge', 60, { raw: true }); eq(p.hp, 230, 'full -> heal 10%');
  g.time = 10; p.resources.gain('guard_gauge', 5, { raw: true }); eq(p.hp, 230, 'already full: nothing');
  p.resources.spend('guard_gauge', 30); p.resources.gain('guard_gauge', 30, { raw: true }); eq(p.hp, 260, 'refilled');
});
test('onStatusApplied + statusIs: only the named status put on a foe by the wearer', () => {
  const { g, p, wear } = game(); p.recomputeStats(); wear('t_status_rune');
  const foe = { team: 'enemy' };
  g.events.emit('statusApplied', { id: 'slow', source: p, target: foe }); eq(p.resources.get('guard_gauge'), 0, 'other status');
  g.events.emit('statusApplied', { id: 'bleed', source: p, target: p }); eq(p.resources.get('guard_gauge'), 0, 'on self');
  g.events.emit('statusApplied', { id: 'bleed', source: p, target: foe }); eq(p.resources.get('guard_gauge'), 3, 'bleed on foe');
});
test('onBossPhase: the wearer gets the barrier when the boss changes phase (10 s cooldown)', () => {
  const { g, p, wear } = game(); p.recomputeStats(); wear('t_phase_relic');
  g.events.emit('bossPhaseChanged', { bossId: 'boss_a1', phase: 2 });
  eq(p.status.added.length, 1); eq(p.status.added[0].id, 'shield'); eq(p.status.added[0].o.amount, 60);
  g.time = 3; g.events.emit('bossPhaseChanged', { bossId: 'boss_a1', phase: 3 }); eq(p.status.added.length, 1, 'cooldown');
});
test('targetHasStatus reads the target status set', () => {
  const target = { status: { has: (id) => id === 'bleed' } };
  ok(checkCondition({ type: 'targetHasStatus', status: 'bleed' }, {}, { target }), 'bleeding');
  ok(!checkCondition({ type: 'targetHasStatus', status: 'burn' }, {}, { target }), 'not burning');
  ok(!checkCondition({ type: 'targetHasStatus', status: 'bleed' }, {}, {}), 'no target');
});

console.log('swap preview');
test('swap preview lists modifier changes and PASSIVE CHANGES (effects gained / lost)', () => {
  const { g, p, wear } = game(); p.recomputeStats(); wear('t_crit_rune');
  g.inventory.add('t_crit_core2');
  const s = swapPreview(g.equipment, 't_crit_core2');
  ok(s.changes.some((c) => c.type === 'critChance' && Math.abs(c.after - 0.25) < 1e-9), 'crit change');
  g.inventory.add('t_phase_relic');
  const r = swapPreview(g.equipment, 't_phase_relic');
  eq(r.gained.length, 1); eq(r.lost.length, 0);
  ok(itemTooltipHTML(ITEMS.t_phase_relic, { swap: r }).includes('Boss phase: barrier 20%.'), 'tooltip shows gained effect');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
