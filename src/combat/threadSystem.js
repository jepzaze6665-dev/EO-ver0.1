import { THREAD_RULES } from '../data/threads.js';

// THREAD SYSTEM — generic "lines between two anchors" (Astral Thread today; lightning, void or
// healing threads tomorrow). Rules come from data/threads.js; it never names a class.
// It is pure logic: collision + lifetime + events. What a touch or a burst DOES (damage, status,
// marks) is applied by the game layer through callbacks, so this file runs in unit tests as-is.
//
// Anchor: { entity } (follows it while alive) or { x, y } (ground point / astral node).
// Thread: { id, type, owner, a, b, t, duration, touchCd: Map(targetId -> s), touched: Set(targetId) }
// Events (onEvent): threadCreated, threadTouched, threadTriggered, threadExpired
let NEXT_ID = 1;

// distance from point to segment (for "is this target touching the line?")
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export class ThreadSystem {
  constructor(defs, { onEvent } = {}) {
    this.defs = defs;
    this.list = [];
    this.onEvent = onEvent || null;
  }
  emit(name, data) { if (this.onEvent) this.onEvent(name, data); }
  def(type) { const d = this.defs[type]; if (!d) throw new Error(`Unknown thread "${type}"`); return d; }

  // anchor -> current position (entity anchors fall back to their last known point once dead)
  pos(anchor) {
    if (anchor.entity) {
      if (!anchor.entity.dead) { anchor.x = anchor.entity.x; anchor.y = anchor.entity.y; }
      else anchor.entity = null;
    }
    return anchor;
  }
  ends(th) { return [this.pos(th.a), this.pos(th.b)]; }

  create(owner, type, a, b, opts = {}) {
    const d = this.def(type);
    const A = anchorOf(a), B = anchorOf(b);
    if (!A || !B) return null;
    // clamp length (anchor B is pulled toward A; entity anchors keep their entity only if in range)
    const len = Math.hypot(B.x - A.x, B.y - A.y);
    if (len > d.maxLength) {
      const k = d.maxLength / len;
      B.entity = null; B.x = A.x + (B.x - A.x) * k; B.y = A.y + (B.y - A.y) * k;
    }
    if (!(Math.hypot(B.x - A.x, B.y - A.y) >= 4)) return null; // zero-length threads are useless
    // per-owner and global caps: replace the oldest
    while (this.count(owner, type) >= d.maxPerOwner) this.expire(this.list.find((t) => t.owner === owner && t.type === type), 'replaced');
    while (this.list.length >= THREAD_RULES.maxTotal) this.expire(this.list[0], 'limit');
    const duration = Number.isFinite(opts.duration) && opts.duration > 0 ? opts.duration : d.duration;
    const th = { id: NEXT_ID++, type, owner, a: A, b: B, t: 0, duration, touchCd: new Map(), touched: new Set(), data: opts.data || null };
    this.list.push(th);
    this.emit('threadCreated', { thread: th, owner });
    return th;
  }

  count(owner, type) { let n = 0; for (const t of this.list) if ((!owner || t.owner === owner) && (!type || t.type === type)) n++; return n; }
  ofOwner(owner) { return this.list.filter((t) => t.owner === owner); }

  expire(th, reason = 'timeout') {
    const i = this.list.indexOf(th);
    if (i < 0) return;
    this.list.splice(i, 1);
    this.emit('threadExpired', { thread: th, owner: th.owner, reason });
  }

  // trigger = consume the thread for a burst; returns its final segment for the caller to act on
  trigger(th, reason = 'burst') {
    const i = this.list.indexOf(th);
    if (i < 0) return null;
    const [a, b] = this.ends(th);
    this.list.splice(i, 1);
    const seg = { ax: a.x, ay: a.y, bx: b.x, by: b.y, thread: th, def: this.defs[th.type] };
    this.emit('threadTriggered', { thread: th, owner: th.owner, reason, ...seg });
    return seg;
  }
  triggerAll(owner, reason) { return this.ofOwner(owner).map((t) => this.trigger(t, reason)).filter(Boolean); }

  // ctx.targets(owner) -> entities that can be caught; ctx.onTouch(thread, target, first)
  update(dt, ctx = {}) {
    if (!(dt > 0)) return;
    for (const th of [...this.list]) {
      th.t += dt;
      if (th.owner && th.owner.dead) { this.expire(th, 'ownerDead'); continue; }
      if (th.t >= th.duration) { this.expire(th, 'timeout'); continue; }
      for (const [id, cd] of th.touchCd) { if (cd - dt <= 0) th.touchCd.delete(id); else th.touchCd.set(id, cd - dt); }
      if (!ctx.targets) continue;
      const d = this.defs[th.type], [a, b] = this.ends(th);
      for (const e of ctx.targets(th.owner)) {
        if (!e || e.dead || th.touchCd.has(e.id)) continue;
        if (distToSegment(e.x, e.y, a.x, a.y, b.x, b.y) > (e.radius || 0) + d.width / 2) continue;
        const first = !th.touched.has(e.id);
        th.touched.add(e.id);
        th.touchCd.set(e.id, Math.max(0.1, d.touch ? d.touch.interval : 1)); // guard: no per-frame touches
        this.emit('threadTouched', { thread: th, owner: th.owner, target: e, first });
        if (ctx.onTouch) ctx.onTouch(th, e, first);
      }
    }
  }
  clearAll() { this.list.length = 0; }
}

function anchorOf(v) {
  if (!v) return null;
  if (v.entity) return Number.isFinite(v.entity.x) ? { entity: v.entity, x: v.entity.x, y: v.entity.y } : null;
  if (Number.isFinite(v.x) && Number.isFinite(v.y)) return { entity: null, x: v.x, y: v.y };
  return null;
}
