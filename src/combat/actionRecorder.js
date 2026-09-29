// ACTION RECORDER — generic "memory" of what a character just did (Blade of Echoes today; any class, a boss that
// copies the player, or a replay/ghost system tomorrow). Pure logic: no game, no DOM, never names a class.
//
//   const rec = new ActionRecorder({ keep: 6, max: 8, kinds: ['basic', 'skill', 'dodge', 'counter'] })
//   rec.record({ kind: 'skill', id: 'echo_slash', x, y, ang }, now)   -> entry or null (refused)
//   rec.recent(now, { kinds?, within?, n? })                          -> oldest-first list, only entries still in memory
//   rec.last(now, filter?)                                             -> newest entry that passes filter(entry)
//
// Rules (data, from the class):
//   keep  : seconds an action stays remembered        max   : entries kept (oldest dropped)
//   kinds : which kinds may be recorded (others are refused)
// No infinite replay: while `replaying` is true nothing is recorded, so replayed actions never feed the memory
// (a replay cannot record itself and be replayed again).
export class ActionRecorder {
  constructor({ keep = 6, max = 8, kinds = null } = {}) {
    this.keep = keep;
    this.max = max;
    this.kinds = kinds;
    this.entries = [];
    this.replaying = false;
  }
  allowed(kind) { return !this.kinds || this.kinds.includes(kind); }
  record(action, now) {
    if (this.replaying || !action || !this.allowed(action.kind) || !Number.isFinite(now)) return null;
    const e = { ...action, t: now };
    this.entries.push(e);
    while (this.entries.length > this.max) this.entries.shift();
    return e;
  }
  prune(now) { this.entries = this.entries.filter((e) => now - e.t <= this.keep); }
  recent(now, { kinds = null, within = this.keep, n = Infinity } = {}) {
    this.prune(now);
    const out = this.entries.filter((e) => now - e.t <= within && (!kinds || kinds.includes(e.kind)));
    return out.slice(Math.max(0, out.length - n));
  }
  last(now, filter = () => true) {
    this.prune(now);
    for (let i = this.entries.length - 1; i >= 0; i--) if (filter(this.entries[i])) return this.entries[i];
    return null;
  }
  // run fn with recording switched off (replays)
  replay(fn) {
    const was = this.replaying;
    this.replaying = true;
    try { return fn(); } finally { this.replaying = was; }
  }
  clear() { this.entries.length = 0; }
}
