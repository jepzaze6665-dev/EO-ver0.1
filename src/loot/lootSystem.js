import { LOOT_TABLES } from '../data/lootTables.js';
import { DROP_RATES } from '../data/dropRates.js';
import { ITEMS } from '../items/items.js';
import { isGear } from '../items/itemDefs.js';

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

// the chance actually used for one table entry (data/dropRates.js): gear × global; on a boss REPEAT kill the signature
// item and the guaranteed gear group use the repeat chances; one-time trophies are skipped. Pure.
//   kind: 'drop' (an item entry) | 'group' (a oneOf group, entry = the group)
export function entryChance(entry, kind, { repeat = false, rates = DROP_RATES } = {}) {
  const gearOf = (id) => isGear(ITEMS[id]);
  let c = entry.chance;
  if (kind === 'drop') {
    const def = ITEMS[entry.item];
    if (repeat && def && def.signature) c = rates.repeat.signature;
    else if (repeat && !rates.repeat.trophies && def && def.maxStack === 1 && !gearOf(entry.item)) c = 0; // one-time trophy
    if (gearOf(entry.item)) c *= rates.global;
  } else {
    if (repeat && c >= 1) c = rates.repeat.gearGroup;
    if ((entry.items || []).some((x) => gearOf(x.item))) c *= rates.global;
  }
  return Math.max(0, Math.min(1, c));
}

export function rollLoot(tableId, rng = Math.random, opts = {}) {
  const t = LOOT_TABLES[tableId];
  if (!t) return { gold: 0, items: [] };
  const [lo, hi] = t.gold || [0, 0];
  const goldMult = opts.repeat ? (opts.rates || DROP_RATES).repeat.gold : 1;
  const gold = Math.max(0, Math.round((lo + Math.floor(rng() * (hi - lo + 1))) * goldMult));
  const items = [];
  for (const d of t.drops || []) if (rng() < entryChance(d, 'drop', opts)) items.push({ item: d.item, count: Math.max(1, d.count || 1) });
  for (const grp of t.oneOf || []) {
    if (!(rng() < entryChance(grp, 'group', opts))) continue;
    const x = pickOne(grp.items || [], rng);
    if (x) items.push({ item: x.item, count: Math.max(1, x.count || 1) });
  }
  return { gold, items };
}

// chance that ONE roll of a table gives this item at least once (drops: independent; oneOf: group chance × weight share)
// opts.repeat = a boss repeat kill (data/dropRates.js)
export function calculateDropChance(tableId, itemId, opts = {}) {
  const t = LOOT_TABLES[tableId];
  if (!t) return 0;
  let miss = 1;
  for (const d of t.drops || []) if (d.item === itemId) miss *= 1 - entryChance(d, 'drop', opts);
  for (const grp of t.oneOf || []) {
    const items = grp.items || [], total = items.reduce((s, x) => s + Math.max(0, x.weight ?? 1), 0);
    const w = items.filter((x) => x.item === itemId).reduce((s, x) => s + Math.max(0, x.weight ?? 1), 0);
    if (total > 0 && w > 0) miss *= 1 - entryChance(grp, 'group', opts) * (w / total);
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
    g.events.emit('lootDropped', { x: e.x, y: e.y, source: e.type, bossId: e.bossId || null, repeat: !!e.repeat, gold: r.gold, items: r.items });
  }
}
