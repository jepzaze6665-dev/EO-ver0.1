import { COUNTER, counterDuration } from '../data/counter.js';

// COUNTER SYSTEM (Combat 2.0 §47) — turns "the player beat that attack" events into a Counter Window on the attacker.
//   attackDodged (perfect -> 'perfectDodge', normal -> 'whiff')  ·  perfectGuard -> 'parry'  ·  attackMissed -> 'whiff'
// The window is a status (data/statuses.js 'counter_window': less DEF, more damage taken). The first hit the player
// lands inside it pays the class's `counterBonus` data ({ marks, resource }) and shows COUNTER!.
// Events out: counterWindow { target, player, reason, duration } · counterHit { ...damageDealt, player, first }
// Rules: data/counter.js. No class or monster names here.
export class CounterSystem {
  constructor(game, rules = COUNTER) {
    this.game = game;
    this.rules = rules;
    const ev = game.events;
    ev.on('attackDodged', (e) => this.open(e.attacker, e.perfect ? 'perfectDodge' : 'whiff', e.player));
    ev.on('perfectGuard', (e) => this.open(e.source, 'parry', e.player));
    // any missed enemy attack (Combat 2.0 §50) — skipped when a dodge already opened a window for it
    ev.on('attackMissed', (e) => { if (!(e.attacker && e.attacker.status && e.attacker.status.has(rules.status))) this.open(e.attacker, 'whiff', e.player); });
    ev.on('damageDealt', (e) => this.onHit(e));
  }
  open(target, reason, player) {
    const dur = counterDuration(reason, target);
    if (!dur || !player || target === player) return false;
    target.status.add(this.rules.status, dur, { source: player });
    target.counterWin = { by: player, rewarded: false }; // who earned it; rewards once per window
    const g = this.game;
    g.vfx.text(target.x, target.y - (target.height || 30) * (target.scale || 1) - 18, 'OPEN', { color: '#ffc070', size: 10, life: Math.min(1, dur) });
    g.events.emit('counterWindow', { target, player, reason, duration: dur });
    return true;
  }
  onHit(e) {
    const t = e.target, w = t && t.counterWin;
    if (!w || !(e.amount > 0) || e.source !== w.by || !t.status || !t.status.has(this.rules.status)) return;
    const p = w.by, g = this.game, first = !w.rewarded;
    if (first) {
      w.rewarded = true;
      const b = (p.cls && p.cls.counterBonus) || {};
      if (b.marks && p.addMark) p.addMark(b.marks);
      if (b.resource && p.gainResource) p.gainResource(b.resource, true);
      g.vfx.text(t.x, t.y - (t.height || 30) * (t.scale || 1) - 34, this.rules.firstHitText, { color: '#ffd070', size: 13, life: 0.9 });
      g.audio.sfx('perfect_guard');
    }
    g.events.emit('counterHit', { ...e, player: p, first });
  }
}
