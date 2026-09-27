import { RESOURCES } from '../data/resources.js';
import { ITEMS, maxStackOf } from '../items/items.js';

// Stack-based inventory + village storage. Counts never go negative or above the item's max stack.
// Events: 'itemCollected' { id, n, total, silent } (quests / UI), 'inventoryFull' { id, lost }.
export class Inventory {
  constructor(game) {
    this.game = game;
    this.items = {}; // id -> count
    this.storage = {};
    this.potionCd = 0;
  }
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
    this.items[id] = this.count(id) + added;
    this.game.events.emit('itemCollected', { id, n: added, total: this.items[id], silent });
    return added;
  }
  remove(id, n = 1) {
    n = Math.floor(n);
    if (!(n > 0) || (this.items[id] || 0) < n) return false;
    this.items[id] -= n;
    if (this.items[id] <= 0) delete this.items[id];
    return true;
  }
  has(id, n = 1) { return (this.items[id] || 0) >= n; }
  list(cat = 'All') {
    return Object.entries(this.items)
      .filter(([id]) => cat === 'All' || ITEMS[id].cat === cat)
      .map(([id, n]) => ({ id, n, def: ITEMS[id] }));
  }
  deposit(id, n = 1) {
    if (!(n > 0)) return;
    if (!this.remove(id, n)) return;
    this.storage[id] = (this.storage[id] || 0) + n;
  }
  withdraw(id, n = 1) {
    if (!(n > 0) || (this.storage[id] || 0) < n || this.space(id) < n) return;
    this.storage[id] -= n;
    if (this.storage[id] <= 0) delete this.storage[id];
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

  serialize() { return { items: this.items, storage: this.storage }; }
  // loaded data is cleaned: unknown ids dropped, counts whole numbers within 0..maxStack (storage: no stack cap)
  load(d) {
    const clean = (src, cap) => Object.fromEntries(Object.entries(src || {})
      .filter(([id, n]) => ITEMS[id] && n > 0).map(([id, n]) => [id, cap ? Math.min(Math.floor(n), maxStackOf(id)) : Math.floor(n)]));
    this.items = clean(d.items, true); this.storage = clean(d.storage, false);
  }
}
