// Item System G1: item data, item instances, gear in the inventory, equipment instances, save v5.
// Run:  node tools/tests/items.test.mjs
import { ITEMS } from '../../src/items/items.js';
import { GEAR_ITEMS, GEAR_SOURCES } from '../../src/data/items/index.js';
import { GEAR_TYPES } from '../../src/data/items/rules.js';
import { itemProblems, isGear, canClassUse } from '../../src/items/itemDefs.js';
import { InstanceIds, createInstance, sanitizeInstance, formatInstanceId } from '../../src/items/itemInstance.js';
import { Inventory } from '../../src/inventory/inventory.js';
import { Equipment } from '../../src/equipment/equipment.js';
import { EventBus } from '../../src/core/events.js';
import { CLASSES } from '../../src/skills/classes.js';
import { parseSave } from '../../src/save/saveData.js';
import { ModifierSet } from '../../src/items/modifierSystem.js';
import { MODIFIER_TYPES, GEAR_SLOTS } from '../../src/data/items/rules.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const game = () => {
  const g = { events: new EventBus(), audio: { sfx() {} }, player: { cls: { id: 'aegis_guardian' }, recomputed: 0, recomputeStats() { this.recomputed++; } } };
  g.inventory = new Inventory(g); g.equipment = new Equipment(g);
  return g;
};
const allIds = (g) => [...g.inventory.gear, ...g.inventory.storageGear, ...Object.values(g.equipment.inst)].map((x) => x.instanceId);

console.log('item data');
test('every item passes the data check (types, rarity, modifiers, triggers, effects, classes)', () => {
  const problems = Object.values(ITEMS).flatMap((d) => itemProblems(d, Object.keys(CLASSES)));
  ok(!problems.length, problems.join(' | '));
});
test('every item has the standard fields', () => {
  for (const [id, d] of Object.entries(ITEMS)) {
    eq(d.id, id); ok(d.name && d.type && typeof d.description === 'string', id);
    ok(Array.isArray(d.tags) && Array.isArray(d.allowedClasses) && Array.isArray(d.modifiers) && Array.isArray(d.effects), id);
  }
});
test('first item set (G1) still there; I3 adds the Umbral / Astral / universal files', () => {
  const n = (t) => Object.values(GEAR_ITEMS).filter((d) => d.type === t).length;
  ok(n('weapon_core') >= 3 && n('armor_core') >= 3 && n('relic') >= 3 && n('charm') >= 3 && n('rune') >= 4, 'every type');
  for (const id of ['core_ironheart', 'core_counter', 'core_vanguard', 'armor_fortress', 'armor_guardian', 'armor_risk',
    'relic_oath_mirror', 'relic_last_bastion', 'relic_dawn_core', 'charm_heavy', 'charm_swift', 'charm_guardian',
    'rune_guarding_soul', 'rune_iron_will', 'rune_retribution', 'rune_provocation']) ok(ITEMS[id] && isGear(ITEMS[id]), id);
  ok(Object.keys(GEAR_SOURCES).length === 9, 'nine data files');
});
test('older gear got a type; stack items are not gear', () => {
  eq(ITEMS.duskfang_blade.type, 'weapon_core'); eq(ITEMS.shadeweave.type, 'armor_core'); eq(ITEMS.eclipse_sigil.type, 'relic');
  for (const id of ['umbral_sword', 'umbral_cloak', 'aegis_plate', 'reaper_scythe']) ok(!ITEMS[id], id + ' is a CLASS KIT piece, not an item (K1)');
  eq(ITEMS.shade_charm.type, 'charm'); eq(ITEMS.hunger_rune.type, 'rune');
  for (const id of ['hp_potion', 'wolf_fang', 'cinder_shard']) ok(!isGear(ITEMS[id]), id);
  for (const d of Object.values(ITEMS)) if (d.slot) ok(GEAR_TYPES.includes(d.type), d.id);
});
test('legendary = unique effect; Oath Mirror comes from boss_a1 and reflects on Perfect Guard', () => {
  const m = ITEMS.relic_oath_mirror;
  eq(m.rarity, 'legendary'); eq(m.dropSource, 'boss_a1'); eq(m.effects[0].trigger, 'onPerfectGuard'); eq(m.effects[0].effect.type, 'reflectDamage');
});
test('the data check catches bad items', () => {
  const bad = { id: 'x', name: 'X', type: 'relic', rarity: 'divine', description: 'd', levelRequirement: -2, tags: [], allowedClasses: ['nobody'],
    modifiers: [{ type: 'defense', value: 50 }, { type: 'luck', value: 1 }], effects: [{ trigger: 'onSneeze', effect: { type: 'heal' } }] };
  const p = itemProblems(bad, Object.keys(CLASSES)).join(' ');
  for (const w of ['rarity', 'levelRequirement', 'nobody', 'outside', 'luck', 'onSneeze', 'cooldown or duration', 'text']) ok(p.includes(w), `missing "${w}" in ${p}`);
});
test('class restriction is data only', () => {
  const d = { allowedClasses: ['aegis_guardian'] };
  ok(canClassUse(d, 'aegis_guardian') && !canClassUse(d, 'umbral_sword'), 'only aegis'); ok(canClassUse(ITEMS.core_ironheart, 'stormcaller'), 'all');
});

console.log('item instance');
test('instances get unique ids item_000001, item_000002, ...; non-gear = no instance', () => {
  const ids = new InstanceIds();
  const a = createInstance('relic_oath_mirror', ids), b = createInstance('relic_oath_mirror', ids);
  eq(a.instanceId, 'item_000001'); eq(b.instanceId, 'item_000002'); eq(a.itemId, 'relic_oath_mirror');
  eq(createInstance('hp_potion', ids), null); eq(createInstance('ghost', ids), null);
});
test('sanitize: unknown items dropped, repeated / broken ids replaced, the counter skips loaded ids', () => {
  const ids = new InstanceIds(), used = new Set();
  ids.seen(formatInstanceId(40));
  eq(sanitizeInstance({ itemId: 'ghost', instanceId: 'item_000001' }, ids, used), null);
  eq(sanitizeInstance({ itemId: 'charm_swift', instanceId: 'item_000040' }, ids, used).instanceId, 'item_000040');
  eq(sanitizeInstance({ itemId: 'charm_swift', instanceId: 'item_000040' }, ids, used).instanceId, 'item_000041');
  eq(sanitizeInstance({ itemId: 'charm_swift', instanceId: 'hack' }, ids, used).instanceId, 'item_000042');
});

console.log('inventory gear');
test('add gear = instances, counts stay in items; remove takes instances out', () => {
  const g = game(), inv = g.inventory;
  eq(inv.add('rune_iron_will', 2), 2); eq(inv.count('rune_iron_will'), 2); eq(inv.instancesOf('rune_iron_will').length, 2);
  ok(inv.has('rune_iron_will', 2), 'has'); ok(inv.remove('rune_iron_will', 1), 'remove'); eq(inv.gear.length, 1); eq(inv.count('rune_iron_will'), 1);
  inv.add('hp_potion', 3); eq(inv.gear.length, 1, 'potions are no instances');
});
test('addItem / removeItem / getItem / hasItem / findItem', () => {
  const g = game(), inv = g.inventory;
  inv.add('relic_dawn_core');
  const x = inv.findItem('relic_dawn_core');
  ok(inv.hasItem(x.instanceId) && inv.getItem(x.instanceId) === x, 'find / get');
  const out = inv.removeItem(x.instanceId);
  eq(out, x); eq(inv.count('relic_dawn_core'), 0); eq(inv.removeItem(x.instanceId), null);
  ok(inv.addItem(out), 'put back'); ok(!inv.addItem(out), 'same instance twice'); eq(inv.count('relic_dawn_core'), 1);
  ok(!inv.addItem({ instanceId: 'item_9', itemId: 'hp_potion' }), 'not gear');
});
test('max stack holds for instances too', () => {
  const g = game(), inv = g.inventory;
  inv.add('charm_heavy', 50);
  eq(inv.count('charm_heavy'), 9); eq(inv.instancesOf('charm_heavy').length, 9); ok(!inv.addItem(inv.newInstance('charm_heavy')), 'full');
});
test('storage keeps the same instances', () => {
  const g = game(), inv = g.inventory;
  inv.add('core_counter'); const id = inv.findItem('core_counter').instanceId;
  inv.deposit('core_counter', 1); eq(inv.count('core_counter'), 0); eq(inv.storage.core_counter, 1); eq(inv.storageGear[0].instanceId, id);
  inv.withdraw('core_counter', 1); eq(inv.findItem('core_counter').instanceId, id); eq(inv.storageGear.length, 0);
});
test('save / load round trip keeps instance ids and the id counter', () => {
  const g = game(), inv = g.inventory;
  inv.add('rune_retribution'); inv.add('armor_risk'); inv.add('wolf_fang', 4); inv.deposit('armor_risk', 1);
  const d = JSON.parse(JSON.stringify(inv.serialize()));
  eq(d.gear.filter((x) => x.itemId === 'rune_retribution').length, 1, 'instance saved');
  const g2 = game(); g2.inventory.load(d);
  eq(g2.inventory.findItem('rune_retribution').instanceId, inv.findItem('rune_retribution').instanceId);
  eq(g2.inventory.count('wolf_fang'), 4); eq(g2.inventory.storage.armor_risk, 1); eq(g2.inventory.storageGear[0].itemId, 'armor_risk');
  ok(g2.inventory.newInstance('charm_swift').instanceId > formatInstanceId(2), 'counter continues');
});
test('older saves (gear as counts) become instances; junk is cleaned', () => {
  const g = game(), inv = g.inventory;
  inv.load({ items: { duskfang_blade: 2, hp_potion: 3, ghost: 1 }, storage: { umbral_band: 1 } }); // pre-v5
  eq(inv.count('duskfang_blade'), 2); eq(inv.instancesOf('duskfang_blade').length, 2); eq(inv.count('hp_potion'), 3);
  eq(inv.storage.umbral_band, 1); eq(inv.storageGear.length, 1);
  const ids = allIds(g); eq(new Set(ids).size, ids.length, 'unique ids');
  // v5: the instances decide; a gear count with no instance behind it is dropped (no free items from an edited save)
  const g2 = game();
  g2.inventory.load({ items: { duskfang_blade: 5, charm_focus: 1 }, gear: [{ itemId: 'ghost', instanceId: 'item_000001' },
    { itemId: 'charm_focus', instanceId: 'item_000005' }, { itemId: 'charm_focus', instanceId: 'item_000005' }] });
  eq(g2.inventory.count('duskfang_blade'), 0); eq(g2.inventory.count('charm_focus'), 2);
  const ids2 = allIds(g2); eq(new Set(ids2).size, ids2.length, 'unique ids (v5)');
});

console.log('equipment instances');
test('equip moves the instance from the bag to the slot; the old item goes back as its own instance', () => {
  const g = game(), inv = g.inventory, eqp = g.equipment;
  eq(eqp.slots.weapon, null, 'a new game starts with every slot empty (K1)');
  inv.add('core_counter'); inv.add('duskfang_blade'); const id = inv.findItem('core_counter').instanceId;
  ok(eqp.equip('core_counter'), 'equip');
  eq(eqp.slots.weapon, 'core_counter'); eq(eqp.inst.weapon.instanceId, id); eq(inv.count('core_counter'), 0);
  ok(eqp.equip('duskfang_blade'), 'replace');
  eq(inv.findItem('core_counter').instanceId, id, 'the replaced core is back as the same instance'); ok(g.player.recomputed > 0, 'stats recomputed');
});
test('unequip puts the instance back; every slot (weapon core too) may be empty (K1)', () => {
  const g = game(), inv = g.inventory, eqp = g.equipment;
  inv.add('umbral_band'); ok(eqp.equip('umbral_band'), 'equip charm'); const id = eqp.inst.charm.instanceId;
  ok(eqp.unequip('charm'), 'unequip'); eq(eqp.slots.charm, null); eq(inv.findItem('umbral_band').instanceId, id);
  inv.add('core_counter'); ok(eqp.equip('core_counter'), 'weapon core'); ok(eqp.unequip('weapon'), 'weapon core can be taken off'); eq(eqp.slots.weapon, null);
  ok(!eqp.equip('shade_charm'), 'not owned'); eq(eqp.lastError, 'notOwned');
});
test('equipment save / load keeps ids; bad slots repaired; an old accessory moves to its type slot', () => {
  const g = game(); g.inventory.add('umbral_band'); g.equipment.equip('umbral_band');
  const inv = JSON.parse(JSON.stringify(g.inventory.serialize())), e = JSON.parse(JSON.stringify(g.equipment.serialize()));
  const g2 = game(); g2.inventory.load(inv); g2.equipment.load(e);
  eq(g2.equipment.slots.charm, 'umbral_band'); eq(g2.equipment.instanceFor('charm').instanceId, g.equipment.inst.charm.instanceId);
  const g3 = game(); g3.equipment.load({ weapon: 'ghost', armor: 'hp_potion', relic: 'umbral_sword' });
  eq(g3.equipment.slots.weapon, null); eq(g3.equipment.slots.armor, null); eq(g3.equipment.slots.relic, null);
  // a pre-K1 save names the old class kit items: they no longer exist, so the slots stay empty (the kit is the class's own)
  const g4 = game(); g4.equipment.load({ weapon: 'umbral_sword', armor: 'umbral_cloak', accessory: 'eclipse_sigil' });
  eq(g4.equipment.slots.weapon, null, 'old kit weapon dropped'); eq(g4.equipment.slots.armor, null, 'old kit armor dropped');
  ok(g4.equipment.instanceFor('relic').instanceId.startsWith('item_'), 'made on demand'); eq(g4.equipment.slots.relic, 'eclipse_sigil');
  const g5 = game(); g5.equipment.load({ accessory: 'hunger_rune' }); eq(g5.equipment.slots.rune1, 'hunger_rune');
  const g6 = game(); g6.equipment.load({ rune1: 'rune_iron_will', rune2: 'rune_iron_will' }); eq(g6.equipment.slots.rune2, null, 'edited duplicate');
});

console.log('gear loadout (7 slots)');
test('7 slots: weapon core, armor core, relic, charm, rune 1-3; view() in loadout shape', () => {
  eq(GEAR_SLOTS.length, 7); const g = game();
  const v = g.equipment.view(); eq(v.weaponCore, null); eq(v.runes.length, 3); eq(v.relic, null);
});
test('every type goes to its own slot; runes fill rune 1, 2, 3 then swap rune 1', () => {
  const g = game(), inv = g.inventory, eqp = g.equipment;
  for (const id of ['core_ironheart', 'armor_guardian', 'relic_oath_mirror', 'charm_heavy', 'rune_guarding_soul', 'rune_iron_will', 'rune_retribution', 'rune_provocation']) inv.add(id);
  for (const id of ['core_ironheart', 'armor_guardian', 'relic_oath_mirror', 'charm_heavy', 'rune_guarding_soul', 'rune_iron_will', 'rune_retribution']) ok(eqp.equip(id), id);
  const v = eqp.view();
  eq(v.weaponCore, 'core_ironheart'); eq(v.armorCore, 'armor_guardian'); eq(v.relic, 'relic_oath_mirror'); eq(v.charm, 'charm_heavy');
  eq(v.runes.join(), 'rune_guarding_soul,rune_iron_will,rune_retribution');
  ok(eqp.equip('rune_provocation'), 'full -> swap'); eq(eqp.slots.rune1, 'rune_provocation'); ok(inv.has('rune_guarding_soul'), 'swapped back to bag');
  ok(eqp.equip('rune_guarding_soul', 'rune3'), 'chosen slot'); eq(eqp.slots.rune3, 'rune_guarding_soul');
});
test('type checks: wrong slot, not gear, unknown', () => {
  const g = game(), eqp = g.equipment; g.inventory.add('relic_dawn_core'); g.inventory.add('hp_potion');
  ok(!eqp.equip('relic_dawn_core', 'charm'), 'relic in charm slot'); eq(eqp.lastError, 'wrongSlot');
  ok(!eqp.equip('hp_potion'), 'potion'); eq(eqp.lastError, 'notGear'); ok(!eqp.equip('ghost'), 'unknown'); eq(eqp.lastError, 'unknown');
});
test('no duplicates: two copies of one rune cannot fill two slots', () => {
  const g = game(), eqp = g.equipment; g.inventory.add('rune_iron_will', 2);
  ok(eqp.equip('rune_iron_will'), 'first'); ok(!eqp.equip('rune_iron_will'), 'second'); eq(eqp.lastError, 'duplicate');
  ok(eqp.equip('rune_iron_will', 'rune1'), 'same slot = swap allowed');
});
test('class restriction from data (allowedClasses); class change takes off what the new class may not use', () => {
  const g = game(), eqp = g.equipment;
  ITEMS.__test_relic = { ...ITEMS.relic_dawn_core, id: '__test_relic', allowedClasses: ['umbral_sword'] };
  try {
    g.inventory.add('__test_relic'); ok(!eqp.equip('__test_relic'), 'aegis refused'); eq(eqp.lastError, 'class');
    g.player.cls.id = 'umbral_sword'; ok(eqp.equip('__test_relic'), 'umbral ok');
    eq(eqp.enforceClass('aegis_guardian'), 1); eq(eqp.slots.relic, null); ok(g.inventory.has('__test_relic'), 'back in bag');
  } finally { delete ITEMS.__test_relic; }
});
test('bag full: a swap that cannot return the old item changes nothing', () => {
  const g = game(), inv = g.inventory, eqp = g.equipment;
  inv.add('core_vanguard'); eqp.equip('core_vanguard'); inv.add('core_vanguard', 9); inv.add('core_counter'); // the bag already holds a full stack of the worn core
  ok(!eqp.equip('core_counter'), 'refused'); eq(eqp.lastError, 'bagFull'); eq(eqp.slots.weapon, 'core_vanguard'); ok(inv.has('core_counter'), 'core kept');
});

console.log('modifier system');
test('additive stacking: sum, then base × (1 + sum); base never edited', () => {
  const m = new ModifierSet(); m.addModifier('a', { type: 'defense', value: 0.15 }); m.addModifier('b', { type: 'defense', value: 0.2 });
  const base = { def: 20, hp: 300 }, out = m.calculateStats(base);
  eq(+m.getModifierValue('defense').toFixed(3), 0.35); eq(+out.def.toFixed(3), 27); eq(base.def, 20, 'base untouched'); eq(out.hp, 300);
});
test('multiplicative stacking (movement speed) and add-type stats (cooldown reduction, barrier strength)', () => {
  const m = new ModifierSet(); m.addModifier('a', { type: 'movementSpeed', value: -0.1 }); m.addModifier('b', { type: 'movementSpeed', value: -0.1 });
  eq(+m.getModifierValue('movementSpeed').toFixed(3), -0.19);
  m.addModifier('c', { type: 'cooldownReduction', value: 0.08 }); m.addModifier('d', { type: 'barrierStrength', value: 0.25 });
  const out = m.calculateStats({ speed: 100, cdr: 0.1, barrierPower: 0.2 });
  eq(+out.speed.toFixed(3), 81); eq(+out.cdr.toFixed(3), 0.18); eq(+out.barrierPower.toFixed(3), 0.45);
});
test('caps: totals never pass min / max (no infinite defense, no huge cooldown cut, damage reduction ≤ 40%)', () => {
  const m = new ModifierSet();
  for (let i = 0; i < 20; i++) { m.addModifier(i, { type: 'defense', value: 0.5 }); m.addModifier(i, { type: 'cooldownReduction', value: 0.2 }); m.addModifier(i, { type: 'damageReduction', value: 0.3 }); }
  eq(m.getModifierValue('defense'), MODIFIER_TYPES.defense.max); eq(m.getModifierValue('cooldownReduction'), MODIFIER_TYPES.cooldownReduction.max);
  eq(m.getModifierValue('damageReduction'), 0.4);
  const neg = new ModifierSet(); for (let i = 0; i < 10; i++) neg.addModifier(i, { type: 'movementSpeed', value: -0.3 });
  ok(neg.calculateStats({ speed: 100 }).speed >= 60 - 1e-9, 'speed floor');
});
test('remove / recalculate: removing a source brings the exact old value back; bad modifiers refused', () => {
  const m = new ModifierSet(); m.addModifier('x', { type: 'maxHP', value: 0.12 }); m.addModifier('y', { type: 'maxHP', value: 0.08 });
  eq(+m.calculateStats({ hp: 250 }).hp.toFixed(3), 300); eq(m.removeModifier('x'), 1); eq(+m.calculateStats({ hp: 250 }).hp.toFixed(3), 270);
  m.removeModifier('y'); eq(m.calculateStats({ hp: 250 }).hp, 250); eq(m.active().length, 0);
  ok(!m.addModifier('z', { type: 'luck', value: 1 }) && !m.addModifier('z', { type: 'defense', value: NaN }), 'refused');
});
test('equipment: final stats follow the worn items, back to exact base after unequip', () => {
  const g = game(), inv = g.inventory, eqp = g.equipment, base = { def: 13, hp: 330, speed: 138, barrierPower: 0, atk: 20, cdr: 0 };
  inv.add('core_ironheart'); inv.add('armor_guardian'); inv.add('charm_heavy');
  eqp.equip('core_ironheart'); eq(+eqp.finalStats(base).def.toFixed(3), 14.95, 'Ironheart +15% DEF');
  eqp.equip('armor_guardian'); eq(+eqp.finalStats(base).barrierPower.toFixed(3), 0.25, 'Guardian Armor barrier');
  eq(+eqp.getModifierValue('guardGeneration').toFixed(3), 0.4, 'guard gen 0.25 + 0.15');
  eqp.equip('charm_heavy'); eq(+eqp.finalStats(base).hp.toFixed(3), 356.4); eq(+eqp.finalStats(base).speed.toFixed(3), 131.1);
  eqp.unequip('charm'); eqp.unequip('armor'); eqp.unequip('weapon');
  const back = eqp.finalStats(base); for (const k of Object.keys(base)) eq(back[k], base[k], k);
});
test('save v4 / v5 migrate to the current version (v6, K1); old kit item ids are dropped by the loaders', () => {
  const r = parseSave(JSON.stringify({ v: 4, player: { classId: 'aegis_guardian', x: 1, y: 2 }, inventory: { items: { aegis_plate: 1 } } }));
  ok(r.ok, r.error); eq(r.data.v, 6);
  const r5 = parseSave(JSON.stringify({ v: 5, player: { classId: 'aegis_guardian', x: 1, y: 2 } })); ok(r5.ok, r5.error); eq(r5.data.v, 6);
  const g = game(); g.inventory.load(r.data.inventory); eq(g.inventory.count('aegis_plate'), 0, 'the old starter armour is gone from the bag');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
