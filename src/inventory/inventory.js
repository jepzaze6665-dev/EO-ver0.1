import { RESOURCES } from '../data/resources.js';
import { ITEMS, maxStackOf } from '../items/items.js';
import { isGear } from '../items/itemDefs.js';
import { InstanceIds, createInstance, sanitizeInstance } from '../items/itemInstance.js';

// Stack-based inventory + village storage. Counts never go negative or above the item's max stack.
// Events: 'itemCollected' { id, n, total, silent } (quests / UI), 'inventoryFull' { id, lost }.
// GEAR (cores, relics, charms, runes, older weapons / armour) is kept as INSTANCES (items/itemInstance.js) in
// `gear` / `storageGear`; `items` / `storage` still hold the COUNT of every id (gear included), so count / has /
// add / remove work the same for every item. Instance API: addItem / removeItem / getItem / hasItem / findItem.
export class Inventory {
  constructor(game) {
    this.game = game;
    this.items = {}; // id -> count (gear too: always equal to the number of its instances in `gear`)
    this.storage = {};
    this.gear = []; // [{ instanceId, itemId }] in the bag
    this.storageGear = []; // in the storage chest
    this.ids = new InstanceIds();
    this.potionCd = 0;
  }
  // a new instance of a gear item (equipment uses it for gear that was never in the bag)
  newInstance(itemId) { return createInstance(itemId, this.ids); }
  count(id) { return this.items[id] || 0; }
  space(id) { return Math.max(0, maxStackOf(id) - this.count(id)); }
  canAdd(id, n = 1) { return !!ITEMS[id] && this.space(id) >= n; }
  // returns how many were actually added (0 when full / unknown / n <= 0)
  add(id, n = 1, silent = false) {
    n = Math.floor(n);
    if (!ITEMS[id] || !(n > 0)) return 0;
    const added = Math.min(n, this.space(id));
    if (added < n) this.game.events.emit('inventoryFull', { id, lost: n - added });
    if (!added) return 0;
    if (isGear(ITEMS[id])) for (let i = 0; i < added; i++) this.gear.push(this.newInstance(id));
    this.items[id] = this.count(id) + added;
    this.game.events.emit('itemCollected', { id, n: added, total: this.items[id], silent });
    return added;
  }
  remove(id, n = 1) {
    n = Math.floor(n);
    if (!(n > 0) || (this.items[id] || 0) < n) return false;
    if (isGear(ITEMS[id])) for (let i = 0; i < n; i++) this.takeLast(this.gear, id);
    this.items[id] -= n;
    if (this.items[id] <= 0) delete this.items[id];
    return true;
  }
  has(id, n = 1) { return (this.items[id] || 0) >= n; }

  // ---- instance API (gear)
  // puts an existing instance (from equipment / storage / a reward) in the bag; returns false when it cannot
  addItem(inst, silent = true) {
    if (!inst || !isGear(ITEMS[inst.itemId]) || this.getItem(inst.instanceId)) return false;
    if (this.space(inst.itemId) < 1) { this.game.events.emit('inventoryFull', { id: inst.itemId, lost: 1 }); return false; }
    this.gear.push(inst);
    this.items[inst.itemId] = this.count(inst.itemId) + 1;
    this.game.events.emit('itemCollected', { id: inst.itemId, n: 1, total: this.items[inst.itemId], silent });
    return true;
  }
  // takes one instance out of the bag (by instanceId) and returns it (null when it is not there)
  removeItem(instanceId) {
    const i = this.gear.findIndex((x) => x.instanceId === instanceId);
    if (i < 0) return null;
    const [inst] = this.gear.splice(i, 1);
    if (--this.items[inst.itemId] <= 0) delete this.items[inst.itemId];
    return inst;
  }
  getItem(instanceId) { return this.gear.find((x) => x.instanceId === instanceId) || null; }
  hasItem(instanceId) { return !!this.getItem(instanceId); }
  // first instance of an item id in the bag (null = none)
  findItem(itemId) { return this.gear.find((x) => x.itemId === itemId) || null; }
  instancesOf(itemId) { return this.gear.filter((x) => x.itemId === itemId); }
  // takes the newest instance of an item id out of a list (stack-style remove / deposit)
  takeLast(list, itemId) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].itemId === itemId) return list.splice(i, 1)[0];
    return null;
  }
  list(cat = 'All') {
    return Object.entries(this.items)
      .filter(([id]) => cat === 'All' || ITEMS[id].cat === cat)
      .map(([id, n]) => ({ id, n, def: ITEMS[id] }));
  }
  deposit(id, n = 1) {
    if (!(n > 0)) return;
    const moved = isGear(ITEMS[id]) ? this.instancesOf(id).slice(-n) : [];
    if (!this.remove(id, n)) return;
    this.storageGear.push(...moved);
    this.storage[id] = (this.storage[id] || 0) + n;
  }
  withdraw(id, n = 1) {
    if (!(n > 0) || (this.storage[id] || 0) < n || this.space(id) < n) return;
    this.storage[id] -= n;
    if (this.storage[id] <= 0) delete this.storage[id];
    if (isGear(ITEMS[id])) for (let i = 0; i < n; i++) this.gear.push(this.takeLast(this.storageGear, id));
    this.items[id] = (this.items[id] || 0) + n;
  }

  use(id) {
    const g = this.game, p = g.player, def = ITEMS[id];
    if (!def || !def.use || !this.has(id)) return false;
    if (def.use === 'heal') {
      if (p.hp >= p.maxHp) { g.ui.toast('HP is full', 0.8); return false; }
      p.heal(p.maxHp * 0.4, 'potion');
      g.vfx.burst(p.x, p.y - 20, '#ff6070', 16, 70);
    } else if (def.use === 'shadow') {
      p.gainResource(50, true); // the class's primary resource (Shadow / Astral / ...)
      g.vfx.burst(p.x, p.y - 20, RESOURCES[p.primaryResource].colors[0], 16, 70);
    }
    g.audio.sfx('potion');
    this.remove(id, 1);
    return true;
  }
  quickUse(id) {
    if (this.potionCd > 0) return;
    if (!this.has(id)) { this.game.ui.toast(`No ${ITEMS[id].name} left`, 1); return; }
    if (this.use(id)) this.potionCd = 1.2;
  }
  update(dt) { this.potionCd = Math.max(0, this.potionCd - dt); }

  // save v5: counts + gear instances + the next instance id. On load the instances decide the gear counts.
  serialize() {
    return { items: { ...this.items }, storage: { ...this.storage }, gear: this.gear.map((x) => ({ ...x })),
      storageGear: this.storageGear.map((x) => ({ ...x })), nextInstance: this.ids.next };
  }
  // loaded data is cleaned: unknown ids dropped, counts whole numbers within 0..maxStack (storage: no stack cap).
  // Instances: unknown / non-gear dropped, missing or repeated instanceIds replaced. OLDER SAVES (gear as plain
  // counts in items / storage, before v5) become one new instance per copy.
  load(d) {
    d = d || {};
    const clean = (src, cap) => Object.fromEntries(Object.entries(src || {})
      .filter(([id, n]) => ITEMS[id] && n > 0).map(([id, n]) => [id, cap ? Math.min(Math.floor(n), maxStackOf(id)) : Math.floor(n)]));
    const items = clean(d.items, true), storage = clean(d.storage, false);
    this.ids = new InstanceIds(d.nextInstance);
    const used = new Set(), list = (a) => (Array.isArray(a) ? a : []);
    for (const x of [...list(d.gear), ...list(d.storageGear)]) if (x && typeof x.instanceId === 'string') this.ids.seen(x.instanceId);
    const v5 = Array.isArray(d.gear); // pre-v5 saves have gear as plain counts only
    const fill = (raw, counts, cap) => {
      const out = [];
      for (const r of list(raw)) {
        const inst = sanitizeInstance(r, this.ids, used);
        if (inst && (!cap || out.filter((x) => x.itemId === inst.itemId).length < maxStackOf(inst.itemId))) out.push(inst);
      }
      if (!v5) for (const [id, n] of Object.entries(counts)) { // pre-v5 gear counts -> one instance per copy
        if (isGear(ITEMS[id])) for (let i = 0; i < n; i++) { const inst = this.newInstance(id); used.add(inst.instanceId); out.push(inst); }
      }
      // gear counts = the instances (keys keep their order; a count without instances is dropped)
      for (const id of Object.keys(counts)) if (isGear(ITEMS[id])) counts[id] = 0;
      for (const x of out) counts[x.itemId] = (counts[x.itemId] || 0) + 1;
      for (const id of Object.keys(counts)) if (!counts[id]) delete counts[id];
      return out;
    };
    this.gear = fill(d.gear, items, true);
    this.storageGear = fill(d.storageGear, storage, false);
    this.items = items; this.storage = storage;
  }
}
