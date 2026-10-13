// GEAR ENHANCEMENT action (rules: data/enhance.js, pure maths: items/enhance.js). Used by the smith panel.
// Gold + materials are spent (losses: the server ledger always accepts them, reason 'enhance'); the instance's `plus`
// changes in place — worn gear rebuilds its modifiers (Equipment.buildKey includes the plus).
// ONLINE NOTE: `plus` lives in the save and is not checked by the server yet.
import { ITEMS } from '../items/items.js';
import { plusOf, enhanceCost, rollEnhance } from '../items/enhance.js';

// every gear copy you have: worn first, then the bag -> [{ inst, slot | null }]
export function enhanceable(game) {
  const eq = game.equipment, out = [];
  for (const slot of Object.keys(eq.slots)) { const x = eq.slots[slot] && eq.instanceFor(slot); if (x) out.push({ inst: x, slot }); }
  for (const x of game.inventory.gear) out.push({ inst: x, slot: null });
  return out;
}
export function canEnhance(game, inst) {
  const c = enhanceCost(ITEMS[inst.itemId], plusOf(inst)), inv = game.inventory;
  if (!c) return { ok: false, reason: 'max', cost: null };
  if (!game.player.canAfford(c.gold)) return { ok: false, reason: 'gold', cost: c };
  if (!Object.entries(c.mats).every(([m, n]) => inv.has(m, n))) return { ok: false, reason: 'mats', cost: c };
  return { ok: true, cost: c };
}
// one try -> { ok, plus, dropped } or null when it cannot be paid
export function enhanceGear(game, instanceId, rng = Math.random) {
  const e = enhanceable(game).find((x) => x.inst.instanceId === instanceId);
  if (!e) return null;
  const chk = canEnhance(game, e.inst);
  if (!chk.ok) return null;
  const E = game.online && game.online.econ, why = (fn) => (E ? E.why('enhance', e.inst.itemId, fn) : fn());
  let paid = false;
  why(() => {
    if (!game.player.removeGold(chk.cost.gold)) return;
    for (const [m, n] of Object.entries(chk.cost.mats)) game.inventory.remove(m, n);
    paid = true;
  });
  if (!paid) return null;
  const from = plusOf(e.inst), r = rollEnhance(from, rng);
  if (r.plus > 0) e.inst.plus = r.plus; else delete e.inst.plus;
  if (e.slot) game.equipment.changed();
  game.save.dirty = true;
  game.events.emit('gearEnhanced', { instanceId, itemId: e.inst.itemId, from, plus: r.plus, ok: r.ok, dropped: r.dropped });
  return r;
}
