// ONLINE H5a — the server's ECONOMY LEDGER: what each player owns (gold, level / EXP, every stack item, every gear instance
// wherever it sits: bag, storage chest or a loadout slot). Kept in the player record next to the save (`econ`).
//   - the client reports every ownership change as an op with a REASON ('econ' { ops: [[op, ...args, why]] }), see
//     src/net/netEconomy.js. Moving things between bag / storage / slots is not an op (ownership does not change).
//   - ops the server cannot allow are UNDONE on the client ('econUndo' { op }): spending what you do not have, rewards
//     the server pays itself (monster / boss kills in a room it hosts), unknown items.
//   - KILL REWARDS in rooms the server hosts (H2) are rolled HERE (same rules: DIFFICULTY.expRate, lootSystem.rollLoot,
//     boss first kill vs repeat from server/progress.js) and sent as 'econGrant' { ops, x, y, src } to every player in the room.
//   - a saveWrite is PATCHED to the ledger before it is stored (gold / level / EXP / item counts / gear): an edited save
//     never sticks.
// H5a trusts the other reasons for now (chests, quests, shops, forge, death pile...) and counts them in econ.unverified;
// H5b / H5c check each of them against the game data and then refuse the rest.
import { ITEMS } from '../src/items/items.js';
import { isGear } from '../src/items/itemDefs.js';
import { addExp } from '../src/progression/experience.js';
import { rollLoot } from '../src/loot/lootSystem.js';
import { DIFFICULTY } from '../src/data/difficulty.js';
import { BOSSES } from '../src/data/bosses.js';
import { LEVELS } from '../src/data/levels.js';
import { isSharedMap } from '../src/data/online.js';
import { QUESTS } from '../src/data/quests.js';
import { HIDDEN } from '../src/data/hidden.js';
import { questExp, hiddenExp } from '../src/progression/rewardScaling.js';
import { EconCatalog } from './econCatalog.js';

export const SERVER_INSTANCE_BASE = 5000000; // gear the server creates: item_5000000+ (clients never count up to it)
const SERVER_REASONS = new Set(['kill', 'boss']); // paid by the server in a room it hosts
// H5b: sources checked against the game data — a claim may never pay more than the data says, and only once per character
// (a gathering node: once per regrow time)
const VERIFIED = new Set(['quest', 'secret', 'explore', 'chest', 'resource', 'forge', 'shrine']);
export const ECON_RULES = { regrow: 110, exploreKeys: 600 };
const expOf = (n) => (n > 0 ? Math.max(1, Math.round(n * DIFFICULTY.expRate)) : 0);

const blank = () => ({ v: 1, gold: 0, level: 1, exp: 0, items: {}, gear: {}, next: SERVER_INSTANCE_BASE, unverified: 0, claims: {} });

export class EconomyService {
  constructor(server, store, { scan = false } = {}) {
    this.server = server;
    this.store = store;
    this.catalog = new EconCatalog();
    if (scan) this.catalog.scan().then(() => server.log.info?.('[server] economy catalog ready (every grid scanned)')).catch((e) => server.log.error?.('[server] economy catalog scan failed:', e));
    server.on('sessionOpened', (s) => this.get(s.id));
    server.handle('econ', (s, m) => this.onOps(s, m.ops));
  }
  save(playerId, econ) { this.store.set(playerId, { ...(this.store.get(playerId) || {}), econ }); }

  // the ledger (a record from before H5a is seeded ONCE from its save)
  get(playerId) {
    const r = this.store.get(playerId) || {};
    if (r.econ) return r.econ;
    const e = blank();
    try {
      const d = r.main && JSON.parse(r.main);
      if (d && d.player) {
        e.gold = Math.max(0, Math.floor(d.player.gold || 0));
        e.level = Math.max(1, Math.floor(d.player.level || 1)); e.exp = Math.max(0, Math.floor(d.player.exp || 0));
        const inv = d.inventory || {};
        for (const src of [inv.items, inv.storage]) for (const [id, n] of Object.entries(src || {})) if (ITEMS[id] && !isGear(ITEMS[id]) && n > 0) e.items[id] = (e.items[id] || 0) + Math.floor(n);
        const gear = [...(inv.gear || []), ...(inv.storageGear || []), ...Object.values((d.equipment && d.equipment.inst) || {})];
        for (const x of gear) if (x && typeof x.instanceId === 'string' && ITEMS[x.itemId] && isGear(ITEMS[x.itemId])) e.gear[x.instanceId] = x.itemId;
      }
    } catch { /* unreadable save: start empty */ }
    this.save(playerId, e);
    return e;
  }
  reset(playerId) { this.save(playerId, blank()); } // New Game (SaveService.remove)

  // a room the server hosts right now (H2) -> kill / boss rewards are the server's
  serverHosted(s) { const room = s.presence && s.presence.room; return !!(room && !isSharedMap(room) && this.server.simHosts && this.server.simHosts.hosting(room)); }

  // ---------------- client ops
  onOps(s, ops) {
    const e = this.get(s.id);
    for (const op of ops) {
      const why = op[op.length - 1], kind = Array.isArray(why) ? String(why[0]) : 'other';
      const r = this.allow(s, e, op, kind);
      if (r === true) this.apply(e, op);
      else s.send('econUndo', { op, why: r });
    }
    this.save(s.id, e);
  }
  // true or the reason it was refused
  allow(s, e, op, kind) {
    const [t, a, b] = op;
    const gain = (t === 'i' && b > 0) || t === 'g+' || (t === '$' && a > 0) || t === 'xp';
    if (gain && SERVER_REASONS.has(kind) && this.serverHosted(s)) return 'the server pays this reward';
    if (t === 'i') {
      if (!ITEMS[a] || isGear(ITEMS[a]) || !Number.isInteger(b) || b === 0) return 'bad item';
      if (b < 0 && (e.items[a] || 0) < -b) return 'not owned';
    } else if (t === 'g+') {
      if (!a || !ITEMS[a.itemId] || !isGear(ITEMS[a.itemId]) || typeof a.instanceId !== 'string' || e.gear[a.instanceId]) return 'bad gear';
    } else if (t === 'g-') {
      if (!e.gear[a]) return 'not owned';
    } else if (t === '$') {
      if (!Number.isInteger(a) || a === 0) return 'bad gold';
      if (a < 0 && e.gold < -a) return 'not enough gold';
    } else if (t === 'xp') {
      if (!Number.isInteger(a) || a <= 0) return 'bad exp';
    } else return 'unknown op';
    if (gain && VERIFIED.has(kind)) return this.claim(e, op, kind, String(op[op.length - 1][1] || ''));
    if (gain && !SERVER_REASONS.has(kind) && kind !== 'use') e.unverified++; // H5c checks the rest (shops, piles, mechanics...)
    return true;
  }

  // ---------------- H5b: what a data source pays (null = unknown source)
  expected(kind, id) {
    const C = this.catalog;
    if (kind === 'quest') { const q = QUESTS[id]; return q ? { xp: expOf(questExp(q)), gold: (q.rewards && q.rewards.gold) || 0, items: { ...((q.rewards && q.rewards.items) || {}) } } : null; }
    if (kind === 'secret') { const h = HIDDEN[id]; return h ? { xp: expOf(hiddenExp(h)), gold: (h.reward && h.reward.gold) || 0, items: { ...((h.reward && h.reward.items) || {}) } } : null; }
    if (kind === 'explore') { const src = LEVELS.expSources[id.split(':')[0]]; return src ? { xp: expOf(src), gold: 0, items: {} } : null; }
    if (kind === 'chest') { const c = C.chest[id]; return c ? { xp: 0, gold: c.gold, items: { ...c.items } } : null; }
    if (kind === 'resource') { const r = C.resource[id]; return r ? { xp: 0, gold: 0, items: { [r.item]: 1 }, regrow: true } : null; }
    if (kind === 'forge') { const f = C.forge[id]; return f ? { xp: 0, gold: 0, items: { ...f.gives } } : null; }
    if (kind === 'shrine') return { xp: 0, gold: 0, items: { seal_fragment: 1 } };
    return null;
  }
  claim(e, op, kind, id) {
    const key = kind + ':' + id, claims = e.claims || (e.claims = {}), now = Date.now();
    let b = claims[key];
    if (b && b.regrow && now - b.at > ECON_RULES.regrow * 1000) b = null; // the node grew back
    if (!b) {
      const exp = this.expected(kind, id);
      if (!exp) {
        // grid-built chests / nodes are only known after the scan: until then (or without one, e.g. unit tests) trust them
        if (!this.catalog.full && (kind === 'chest' || kind === 'resource' || kind === 'forge')) { e.unverified++; return true; }
        return 'unknown ' + kind;
      }
      if (kind === 'explore' && Object.keys(claims).filter((k) => k.startsWith('explore:')).length >= ECON_RULES.exploreKeys) return 'too many discoveries';
      if (claims[key] && !claims[key].regrow) return 'already claimed';
      b = claims[key] = { ...exp, at: now };
    }
    const [t, a, n] = op;
    if (t === 'xp') { if (a > b.xp) return `more EXP than ${kind} gives`; b.xp -= a; }
    else if (t === '$') { if (a > b.gold) return `more gold than ${kind} gives`; b.gold -= a; }
    else {
      const item = t === 'i' ? a : a.itemId, k = t === 'i' ? n : 1;
      if (!((b.items[item] || 0) >= k)) return `${item} is not what ${kind} gives`;
      b.items[item] -= k;
    }
    return true;
  }
  apply(e, op) {
    const [t, a, b] = op;
    if (t === 'i') { e.items[a] = (e.items[a] || 0) + b; if (e.items[a] <= 0) delete e.items[a]; }
    else if (t === 'g+') e.gear[a.instanceId] = a.itemId;
    else if (t === 'g-') delete e.gear[a];
    else if (t === '$') e.gold = Math.max(0, e.gold + a);
    else if (t === 'xp') {
      if (e.level >= LEVELS.maxLevel) return;
      const r = addExp(e.level, e.exp, a); e.level = r.level; e.exp = r.exp;
    }
  }

  // ---------------- server rewards (H2 rooms): a kill seen by the server's room host
  grantKill(room, ev) {
    const S = this.server, set = S.city.rooms.get(room);
    if (!set || ev.summoned) return;
    for (const s of set) {
      if (s.sim) continue;
      const e = this.get(s.id), ops = [];
      if (ev.exp > 0) ops.push(['xp', Math.max(1, Math.round(ev.exp * DIFFICULTY.expRate))]);
      let first = false;
      if (ev.bossId) first = !S.progress.bosses(s.id).includes(ev.bossId);
      const def = ev.bossId && BOSSES[ev.bossId], reward = (def && def.rewards) || {};
      let gold = 0; const items = [];
      for (const id of [].concat(ev.loot || [])) { const x = rollLoot(id, Math.random, { repeat: !!ev.bossId && !first }); gold += x.gold; items.push(...x.items); }
      if (first) { gold += reward.gold || 0; for (const [id, n] of Object.entries(reward.items || {})) items.push({ item: id, count: n }); }
      if (gold > 0) ops.push(['$', gold]);
      for (const it of items) {
        if (!ITEMS[it.item]) continue;
        if (isGear(ITEMS[it.item])) for (let i = 0; i < it.count; i++) ops.push(['g+', { instanceId: 'item_' + String(e.next++).padStart(7, '0'), itemId: it.item }]);
        else ops.push(['i', it.item, it.count]);
      }
      for (const op of ops) this.apply(e, op);
      this.save(s.id, e);
      if (ops.length) s.send('econGrant', { ops, x: Math.round(ev.x || 0), y: Math.round(ev.y || 0), src: String(ev.type || ''), boss: ev.bossId || null, first });
    }
  }
  // ---------------- saves: an incoming save is patched to the ledger before it is stored
  patchSave(playerId, text) {
    let d;
    try { d = JSON.parse(text); } catch { return text; }
    if (!d || !d.player) return text;
    const e = this.get(playerId), inv = d.inventory = d.inventory || {};
    d.player.gold = e.gold; d.player.level = e.level; d.player.exp = e.exp;
    // stacks: bag + storage must add up to the ledger (extra = removed from the bag first, missing = put in the bag)
    inv.items = inv.items || {}; inv.storage = inv.storage || {};
    const ids = new Set([...Object.keys(inv.items), ...Object.keys(inv.storage), ...Object.keys(e.items)]);
    for (const id of ids) {
      if (!ITEMS[id] || isGear(ITEMS[id])) continue;
      const want = e.items[id] || 0, have = (inv.items[id] || 0) + (inv.storage[id] || 0);
      let diff = want - have;
      if (diff > 0) inv.items[id] = (inv.items[id] || 0) + diff;
      while (diff < 0) {
        const from = (inv.items[id] || 0) > 0 ? inv.items : inv.storage, take = Math.min(-diff, from[id] || 0);
        if (!take) break;
        from[id] -= take; if (!from[id]) delete from[id]; diff += take;
      }
    }
    // gear: only instances the ledger knows; the ledger's missing ones go to the bag
    const owned = { ...e.gear }, keep = (x) => x && owned[x.instanceId] === x.itemId && (delete owned[x.instanceId], true);
    inv.gear = (inv.gear || []).filter(keep);
    inv.storageGear = (inv.storageGear || []).filter(keep);
    const eq = d.equipment;
    if (eq && eq.inst) for (const [slot, x] of Object.entries(eq.inst)) if (!keep(x)) { delete eq.inst[slot]; eq[slot] = null; }
    for (const [instanceId, itemId] of Object.entries(owned)) inv.gear.push({ instanceId, itemId });
    // gear counts follow the instances (Inventory.load recounts them too)
    for (const id of Object.keys(inv.items)) if (isGear(ITEMS[id])) delete inv.items[id];
    for (const x of inv.gear) inv.items[x.itemId] = (inv.items[x.itemId] || 0) + 1;
    for (const id of Object.keys(inv.storage)) if (isGear(ITEMS[id])) delete inv.storage[id];
    for (const x of inv.storageGear) inv.storage[x.itemId] = (inv.storage[x.itemId] || 0) + 1;
    const out = JSON.stringify(d);
    return out === JSON.stringify(JSON.parse(text)) ? text : out; // nothing to fix: keep the text as sent
  }
}
