// MARK SYSTEM — generic marks on any entity (player, monster, boss, dummy, future party member).
// Knows nothing about classes: rules come from data/marks.js; reactions (Shadow Break,
// Constellation Break...) are written by class code listening to the emitted events.
//
// State per mark: { id, targetId, sourceId, sourceClass, stacks, maxStacks, remaining, idle, tags }
// Events (via onEvent): targetMarked, markFull, markTriggered, markConsumed, markExpired
export class MarkSystem {
  constructor(defs, { onEvent } = {}) {
    this.defs = defs;
    this.byEntity = new Map(); // entityId -> { entity, marks: Map(markId -> state) }
    this.onEvent = onEvent || null;
  }

  emit(name, data) { if (this.onEvent) this.onEvent(name, data); }
  bucket(entity, create) {
    if (!entity) return null;
    let b = this.byEntity.get(entity.id);
    if (!b && create) { b = { entity, marks: new Map() }; this.byEntity.set(entity.id, b); }
    return b;
  }
  state(entity, markId) { const b = this.bucket(entity, false); return b ? b.marks.get(markId) || null : null; }
  get(entity, markId) { const s = this.state(entity, markId); return s ? s.stacks : 0; }
  list(entity) { const b = this.bucket(entity, false); return b ? [...b.marks.values()] : []; }

  // Add stacks (creates the mark if needed). Returns { stacks, added, full, triggered }.
  apply(target, markId, { source = null, stacks = 1, sourceClass = null } = {}) {
    const d = this.defs[markId];
    if (!d) throw new Error(`Unknown mark "${markId}"`);
    if (!target || target.dead || !(stacks >= 1) || !Number.isFinite(stacks)) return { stacks: this.get(target, markId), added: 0, full: false, triggered: false };
    const b = this.bucket(target, true);
    let s = b.marks.get(markId);
    if (!s) {
      s = { id: markId, targetId: target.id, sourceId: source ? source.id : null, sourceClass, stacks: 0, maxStacks: d.maxStacks, remaining: d.duration, idle: 0, tags: d.tags || [] };
      b.marks.set(markId, s);
    }
    const before = s.stacks;
    s.stacks = Math.min(s.maxStacks, s.stacks + Math.floor(stacks));
    s.idle = 0;
    if (d.duration && (d.refreshOnStack || before === 0)) s.remaining = d.duration;
    if (source) s.sourceId = source.id;
    const added = s.stacks - before;
    const ev = { target, source, markId, stacks: s.stacks, added, maxStacks: s.maxStacks };
    if (added > 0) this.emit('targetMarked', ev);
    let triggered = false;
    if (s.stacks >= s.maxStacks && added > 0) {
      if (d.onMax === 'trigger') { this.remove(target, markId); triggered = true; this.emit('markTriggered', ev); }
      else this.emit('markFull', ev);
    }
    return { stacks: triggered ? 0 : s.stacks, added, full: s.stacks >= s.maxStacks, triggered };
  }

  // Remove up to n stacks (default: all). Returns how many were consumed.
  consume(target, markId, n = Infinity) {
    const s = this.state(target, markId);
    if (!s || !(n > 0)) return 0;
    const used = Math.min(s.stacks, n);
    s.stacks -= used;
    if (s.stacks <= 0) this.remove(target, markId);
    if (used) this.emit('markConsumed', { target, markId, consumed: used, stacks: s.stacks });
    return used;
  }
  refresh(target, markId) { const s = this.state(target, markId); if (s) { s.idle = 0; const d = this.defs[markId]; if (d.duration) s.remaining = d.duration; } }
  remove(target, markId) { const b = this.bucket(target, false); if (b) { b.marks.delete(markId); if (!b.marks.size) this.byEntity.delete(target.id); } }
  clearEntity(entity) { this.byEntity.delete(entity.id); }
  clearAll() { this.byEntity.clear(); }

  // ctx.inCombat(entity) -> bool   (used by idle-decay rules)
  update(dt, ctx = {}) {
    if (!(dt > 0)) return;
    for (const [id, b] of this.byEntity) {
      if (b.entity.dead) { this.byEntity.delete(id); continue; } // clearOnDeath (all current marks) + leak guard
      for (const s of [...b.marks.values()]) {
        const d = this.defs[s.id];
        s.idle += dt;
        if (d.duration) {
          s.remaining -= dt;
          if (s.remaining <= 0) { this.remove(b.entity, s.id); this.emit('markExpired', { target: b.entity, markId: s.id }); continue; }
        }
        const dec = d.idleDecay;
        if (dec && s.idle >= dec.delay && !(dec.outOfCombatOnly && ctx.inCombat && ctx.inCombat(b.entity))) {
          s.stacks -= 1;
          s.idle = dec.delay - dec.step; // next stack drops `step` seconds later
          if (s.stacks <= 0) { this.remove(b.entity, s.id); this.emit('markExpired', { target: b.entity, markId: s.id }); }
        }
      }
    }
  }

  count() { let n = 0; for (const b of this.byEntity.values()) n += b.marks.size; return n; }
}
