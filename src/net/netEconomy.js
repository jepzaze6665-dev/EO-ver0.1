// ONLINE H5a — the client side of the server's economy ledger (server/economy.js). game.online.econ
// Every OWNERSHIP change goes through a few choke points (Inventory.add / remove / addItem / removeItem, Player.addGold /
// removeGold / gainExp) which call note(op). The op carries the current REASON (why(kind, id, fn) around the code that
// causes it: 'kill', 'boss', 'use', 'shop', 'chest', 'quest', ...; nothing set = 'other'). Ops are batched and sent before
// any save leaves (so the server's ledger is never behind the save it patches).
//   op = ['i', itemId, ±n] stack items · ['g+', { instanceId, itemId }] / ['g-', instanceId] gear · ['$', ±n] gold · ['xp', n]
// Moving things between bag / storage / loadout slots is NOT an op: wrap those in quiet(fn).
// Server answers: 'econUndo' { op } = refused -> the op is reversed here (quietly); 'econGrant' { ops } = kill rewards the
// server rolled (rooms it hosts) -> applied quietly + the usual loot feedback.
// Inactive offline (?offline / not logged in): nothing is sent, the game works as before.

export class NetEconomy {
  constructor(session) {
    this.s = session;
    this.buf = [];
    this.reason = null;
    this.quietDepth = 0;
    const n = session.net;
    n.on('welcome', () => { this.buf.length = 0; });
    n.on('econUndo', (m) => this.undo(m.op, m.why));
    n.on('econGrant', (m) => this.grant(m));
  }
  get active() { const s = this.s; return !!(s.online && s.saveReady && s.game.state === 'play'); }

  // ---------------- reasons / quiet moves
  why(kind, id, fn) {
    const prev = this.reason;
    this.reason = id === undefined || id === null ? [kind] : [kind, String(id).slice(0, 32)];
    try { return fn(); } finally { this.reason = prev; }
  }
  quiet(fn) { this.quietDepth++; try { return fn(); } finally { this.quietDepth--; } }

  note(op) {
    if (this.quietDepth || !this.active) return;
    this.buf.push([...op, this.reason || ['other']]);
    if (this.buf.length >= 64) this.flush();
  }
  flush() {
    while (this.buf.length) {
      const ops = this.buf.splice(0, 64);
      if (!this.s.net.send('econ', { ops })) { this.buf.unshift(...ops); return; }
    }
  }

  // ---------------- applying server decisions (never reported back)
  applyOp(op, sign = 1) {
    const g = this.s.game, inv = g.inventory, p = g.player, [t, a, b] = op;
    return this.quiet(() => {
      if (t === 'i') { const n = b * sign; if (n > 0) inv.add(a, n, true); else if (!inv.remove(a, Math.min(-n, inv.count(a)))) { const k = Math.min(-n, inv.storage[a] || 0); if (k) { inv.storage[a] -= k; if (!inv.storage[a]) delete inv.storage[a]; } } }
      else if (t === 'g+' || t === 'g-') {
        const add = (t === 'g+') === (sign > 0), inst = t === 'g+' ? a : { instanceId: a };
        if (add) { if (inst.itemId) inv.addItem({ instanceId: inst.instanceId, itemId: inst.itemId }, true); }
        else this.dropInstance(inst.instanceId);
      } else if (t === '$') { const n = a * sign; if (n > 0) p.addGold(n); else p.removeGold(Math.min(p.gold, -n)); }
      else if (t === 'xp' && sign > 0) p.gainExp(a);
      else if (t === 'xp') { p.exp = Math.max(0, p.exp - a); }
      else if (t === 'xp-') { if (sign < 0) p.exp += a; else p.exp = Math.max(0, p.exp - a); }
    });
  }
  // a gear instance wherever it is (bag, storage, a loadout slot)
  dropInstance(instanceId) {
    const g = this.s.game, inv = g.inventory, eq = g.equipment;
    if (inv.removeItem(instanceId)) return true;
    const i = inv.storageGear.findIndex((x) => x.instanceId === instanceId);
    if (i >= 0) { const [x] = inv.storageGear.splice(i, 1); if (--inv.storage[x.itemId] <= 0) delete inv.storage[x.itemId]; return true; }
    for (const slot of Object.keys(eq.slots)) {
      const x = eq.slots[slot] && eq.instanceFor(slot);
      if (x && x.instanceId === instanceId) { eq.slots[slot] = null; delete eq.inst[slot]; eq.changed(); g.player.recomputeStats(); return true; }
    }
    return false;
  }
  undo(op, why) {
    if (!Array.isArray(op)) return;
    this.applyOp(op, -1);
    console.warn('[econ] the server refused', op, why);
  }
  grant(m) {
    const g = this.s.game, items = [];
    let gold = 0;
    for (const op of m.ops || []) {
      this.applyOp(op, 1);
      if (op[0] === '$') gold += op[1];
      else if (op[0] === 'i') items.push({ item: op[1], count: op[2] });
      else if (op[0] === 'g+' && op[1]) items.push({ item: op[1].itemId, count: 1 });
    }
    // the usual feedback (pickup texts, loot toast); quests already heard 'itemCollected' from Inventory.add
    g.events.emit('lootDropped', { x: m.x, y: m.y, source: m.src, bossId: m.boss || null, gold, items, server: true });
    g.save.dirty = true;
  }
}
