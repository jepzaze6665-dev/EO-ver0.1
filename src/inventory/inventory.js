import { RESOURCES } from '../data/resources.js';
import { ITEMS } from '../items/items.js';

// Stack-based inventory + village storage.
export class Inventory {
  constructor(game) {
    this.game = game;
    this.items = {}; // id -> count
    this.storage = {};
    this.potionCd = 0;
  }
  count(id) { return this.items[id] || 0; }
  add(id, n = 1, silent = false) {
    if (!ITEMS[id]) return;
    this.items[id] = (this.items[id] || 0) + n;
    if (!silent) {
      this.game.ui.pickup(ITEMS[id], n);
      this.game.events.emit('itemGained', { id, n });
    }
  }
  remove(id, n = 1) {
    if ((this.items[id] || 0) < n) return false;
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
    if (!this.remove(id, n)) return;
    this.storage[id] = (this.storage[id] || 0) + n;
  }
  withdraw(id, n = 1) {
    if ((this.storage[id] || 0) < n) return;
    this.storage[id] -= n;
    if (this.storage[id] <= 0) delete this.storage[id];
    this.items[id] = (this.items[id] || 0) + n;
  }

  use(id) {
    const g = this.game, p = g.player, def = ITEMS[id];
    if (!def || !def.use || !this.has(id)) return false;
    if (def.use === 'heal') {
      if (p.hp >= p.maxHp) { g.ui.toast('HP is full', 0.8); return false; }
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4);
      g.vfx.burst(p.x, p.y - 20, '#ff6070', 16, 70);
      g.vfx.text(p.x, p.y - 64, '+HP', { color: '#80ff90', size: 10 });
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
  load(d) { this.items = { ...(d.items || {}) }; this.storage = { ...(d.storage || {}) }; }
}
