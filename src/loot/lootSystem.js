import { LOOT_TABLES, REPEAT_KILL } from '../data/lootTables.js';
import { GEAR_ITEMS } from '../data/items/index.js';

// a repeat boss kill: a signature item drops by REPEAT_KILL chance (by its rarity) instead of the table's own chance
export function repeatChance(itemId, chance) {
  const d = GEAR_ITEMS[itemId];
  if (!d || !d.signature) return chance;
  return Math.min(chance, REPEAT_KILL.signatureChance[d.rarity] ?? REPEAT_KILL.defaultChance);
}

// LOOT: rolls a loot table when an enemy is defeated. rollLoot is pure (pass your own rng in tests / on a server);
// LootSystem only listens to 'enemyDefeated' and hands the result to the player / inventory, then reports
// 'lootDropped' so the UI can show it. It never looks inside combat. Gear items become instances in the inventory
// (items/itemInstance.js) — the loot itself only names item ids, so a future server can roll and check the same table.

export const getLootTable = (tableId) => LOOT_TABLES[tableId] || null;

// one weighted pick from a oneOf group (null = empty group)
function pickOne(items, rng) {
  const total = items.reduce((s, x) => s + Math.max(0, x.weight ?? 1), 0);
  if (!(total > 0)) return null;
  let r = rng() * total;
  for (const x of items) { r -= Math.max(0, x.weight ?? 1); if (r < 0) return x; }
  return items[items.length - 1];
}

export function rollLoot(tableId, rng = Math.random, opts = {}) {
  const t = LOOT_TABLES[tableId];
  if (!t) return { gold: 0, items: [] };
  const [lo, hi] = t.gold || [0, 0];
  const gold = Math.max(0, lo + Math.floor(rng() * (hi - lo + 1)));
  const items = [];
  for (const d of t.drops || []) if (rng() < (opts.repeat ? repeatChance(d.item, d.chance) : d.chance)) items.push({ item: d.item, count: Math.max(1, d.count || 1) });
  for (const grp of t.oneOf || []) {
    if (!(rng() < grp.chance)) continue;
    const x = pickOne(grp.items || [], rng);
    if (x) items.push({ item: x.item, count: Math.max(1, x.count || 1) });
  }
  return { gold, items };
}

// chance that ONE roll of a table gives this item at least once (drops: independent; oneOf: group chance × weight share)
export function calculateDropChance(tableId, itemId) {
  const t = LOOT_TABLES[tableId];
  if (!t) return 0;
  let miss = 1;
  for (const d of t.drops || []) if (d.item === itemId) miss *= 1 - d.chance;
  for (const grp of t.oneOf || []) {
    const items = grp.items || [], total = items.reduce((s, x) => s + Math.max(0, x.weight ?? 1), 0);
    const w = items.filter((x) => x.item === itemId).reduce((s, x) => s + Math.max(0, x.weight ?? 1), 0);
    if (total > 0 && w > 0) miss *= 1 - grp.chance * (w / total);
  }
  return 1 - miss;
}

// every table that can give this item: [{ table, chance }] (codex / collection / "where does it drop?")
export function itemSources(itemId) {
  return Object.keys(LOOT_TABLES).map((table) => ({ table, chance: calculateDropChance(table, itemId) })).filter((x) => x.chance > 0);
}

export class LootSystem {
  constructor(game, rng = Math.random) {
    this.game = game;
    this.rng = rng;
    game.events.on('enemyDefeated', (e) => this.onDefeated(e));
    game.events.on('questCompleted', (e) => this.giveReward(e.reward)); // quest gold + items (EXP: ExperienceSystem)
    game.events.on('hiddenFound', (e) => this.giveReward(e.reward));
    game.events.on('bossRewarded', (e) => this.giveReward(e.reward)); // boss gold + trophy items (EXP + table: enemyDefeated)
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
    for (const id of [].concat(e.loot)) { const x = rollLoot(id, this.rng, { repeat: !!e.repeat }); r.gold += x.gold; r.items.push(...x.items); } // elites roll 2 tables
    if (r.gold) g.player.addGold(r.gold);
    for (const it of r.items) g.inventory.add(it.item, it.count);
    g.events.emit('lootDropped', { x: e.x, y: e.y, source: e.type, bossId: e.bossId || null, gold: r.gold, items: r.items });
  }
}
