// ITEM INSTANCE (pure) — one real copy of a gear item that a player owns.
//   definition (data/items/*.js): what Oath Mirror IS — shared by everyone, never changes
//   instance (this file)         : { instanceId: 'item_000001', itemId: 'relic_oath_mirror' } — YOUR Oath Mirror
// Only gear is tracked as instances; potions / materials / quest items stay plain stacks (id -> count).
// Reserved for later systems (not created now): durability, upgrade, bound, rolls. A future server owns the id
// counter and checks every instance; the client only keeps what it was given.
import { ITEMS } from './items.js';
import { isGear } from './itemDefs.js';

export const formatInstanceId = (n) => `item_${String(n).padStart(6, '0')}`;

// hands out unique ids; `next` is saved with the inventory so ids never repeat after a load
export class InstanceIds {
  constructor(next = 1) { this.next = Math.max(1, Math.floor(next) || 1); }
  take() { return formatInstanceId(this.next++); }
  // never hand out an id that a loaded instance already uses
  seen(instanceId) {
    const m = /^item_(\d+)$/.exec(instanceId || '');
    if (m) this.next = Math.max(this.next, Number(m[1]) + 1);
  }
}

export function createInstance(itemId, ids) {
  if (!isGear(ITEMS[itemId])) return null;
  return { instanceId: ids.take(), itemId };
}

// a loaded instance -> a clean one (null = drop it: unknown item, not gear). Missing / duplicate ids get a new id.
export function sanitizeInstance(raw, ids, used = new Set()) {
  if (!raw || typeof raw !== 'object' || !isGear(ITEMS[raw.itemId])) return null;
  let id = typeof raw.instanceId === 'string' && /^item_\d+$/.test(raw.instanceId) ? raw.instanceId : null;
  if (!id || used.has(id)) id = null;
  if (id) ids.seen(id); else id = ids.take();
  used.add(id);
  return { instanceId: id, itemId: raw.itemId };
}
