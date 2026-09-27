import { LOOT_TABLES } from '../data/lootTables.js';

// LOOT: rolls a loot table when an enemy is defeated. rollLoot is pure (pass your own rng in tests / on a server);
// LootSystem only listens to 'enemyDefeated' and hands the result to the player / inventory, then reports
// 'lootDropped' so the UI can show it. It never looks inside combat.

export function rollLoot(tableId, rng = Math.random) {
  const t = LOOT_TABLES[tableId];
  if (!t) return { gold: 0, items: [] };
  const [lo, hi] = t.gold || [0, 0];
  const gold = Math.max(0, lo + Math.floor(rng() * (hi - lo + 1)));
  const items = [];
  for (const d of t.drops || []) if (rng() < d.chance) items.push({ item: d.item, count: Math.max(1, d.count || 1) });
  return { gold, items };
}

export class LootSystem {
  constructor(game, rng = Math.random) {
    this.game = game;
    this.rng = rng;
    game.events.on('enemyDefeated', (e) => this.onDefeated(e));
    game.events.on('questCompleted', (e) => this.giveReward(e.reward)); // quest gold + items (EXP: ExperienceSystem)
    game.events.on('hiddenFound', (e) => this.giveReward(e.reward));
  }
  giveReward(r) {
    if (!r) return;
    const g = this.game;
    if (r.gold) g.player.addGold(r.gold);
    for (const [id, n] of Object.entries(r.items || {})) g.inventory.add(id, n, true);
  }
  onDefeated(e) {
    if (e.summoned || !e.loot) return; // summoned adds (boss roots, ...) give nothing
    const g = this.game, r = { gold: 0, items: [] };
    for (const id of [].concat(e.loot)) { const x = rollLoot(id, this.rng); r.gold += x.gold; r.items.push(...x.items); } // elites roll 2 tables
    if (r.gold) g.player.addGold(r.gold);
    for (const it of r.items) g.inventory.add(it.item, it.count);
    g.events.emit('lootDropped', { x: e.x, y: e.y, source: e.type, gold: r.gold, items: r.items });
  }
}
