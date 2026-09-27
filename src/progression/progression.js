import { CLASS_TREE, CLASS_COUNTERS, TRIALS } from '../data/classTree.js';
import { evaluate, evaluateAll, matches } from './requirements.js';

// CLASS PROGRESSION — class records, class-tree requirements and class trials for the current character.
// Everything comes from data/classTree.js; this file never names a class.
//   records : per class, counters fed by bus events (CLASS_COUNTERS)
//   trials  : { trialId: { state: 'active' | 'passed', base: { counter: valueAtStart } } }
//   unlocked: class ids the character has earned (Class Change itself is Phase 13)
// Events: trialStarted, trialProgress, trialPassed, classUnlocked
export class Progression {
  constructor(game) {
    this.game = game;
    this.records = {};
    this.trials = {};
    this.unlocked = [];
    this.wire();
  }

  // ---------------- class records
  wire() {
    const ev = this.game.events;
    const byEvent = {};
    for (const [id, c] of Object.entries(CLASS_COUNTERS)) (byEvent[c.event] ||= []).push([id, c]);
    for (const [event, list] of Object.entries(byEvent)) {
      ev.on(event, (data) => {
        const p = this.game.player;
        if (!p) return;
        for (const [id, c] of list) {
          if (!matches(c.match, data || {}, p)) continue;
          const add = c.sum ? Number((data || {})[c.sum]) : 1;
          if (Number.isFinite(add) && add > 0) this.bump(p.cls.id, id, add);
        }
      });
    }
  }
  bump(classId, counter, n) {
    const r = (this.records[classId] ||= {});
    r[counter] = (r[counter] || 0) + n;
    this.checkTrials();
  }
  record(classId, counter) { return (this.records[classId] || {})[counter] || 0; }

  // ---------------- requirements
  context(classId) {
    const g = this.game, p = g.player;
    return {
      level: p.level, classId: p.cls.id,
      questsDone: new Set(Object.keys(g.quests.completed || {})),
      flags: g.world.state.flags,
      items: (id) => g.inventory.count(id),
      secrets: g.world.map.secretsFound.size,
      records: this.records[classId] || {},
      trialsPassed: new Set(Object.entries(this.trials).filter(([, t]) => t.state === 'passed').map(([k]) => k)),
    };
  }
  // the class tree as seen from the current class: next-tier paths + their requirement checklists
  paths() {
    const g = this.game, cur = g.player.cls.id;
    const ctx = this.context(cur);
    return Object.values(CLASS_TREE)
      .filter((n) => n.parent === cur)
      .filter((n) => !n.hidden || (n.reveal && evaluateAll(n.reveal, ctx).every((r) => r.met))) // secret nodes stay invisible
      .map((n) => {
        const reqs = evaluateAll(n.requirements, ctx);
        const trial = n.trial ? { id: n.trial, def: TRIALS[n.trial], ...this.trialView(n.trial) } : null;
        const ready = reqs.every((r) => r.met);
        return { node: n, reqs, ready, trial, unlocked: this.unlocked.includes(n.id) };
      });
  }

  // ---------------- trials
  trialView(id) {
    const t = this.trials[id], def = TRIALS[id];
    if (!t) return { state: 'locked' };
    if (t.state === 'passed') return { state: 'passed', objectives: def.objectives.map((o) => ({ ...o, have: o.count })) };
    const cls = this.game.player.cls.id;
    return { state: 'active', objectives: def.objectives.map((o) => ({ ...o, have: Math.min(o.count, this.record(cls, o.counter) - (t.base[o.counter] || 0)) })) };
  }
  startTrial(nodeId) {
    const g = this.game, path = this.paths().find((x) => x.node.id === nodeId);
    if (!path || !path.trial) return { ok: false, reason: 'unknown' };
    if (!path.ready) return { ok: false, reason: 'requirements' };
    if (this.trials[path.trial.id]) return { ok: false, reason: this.trials[path.trial.id].state };
    if (Object.values(this.trials).some((t) => t.state === 'active')) return { ok: false, reason: 'busy' }; // one trial at a time
    const cls = g.player.cls.id, base = {};
    for (const o of TRIALS[path.trial.id].objectives) base[o.counter] = this.record(cls, o.counter);
    this.trials[path.trial.id] = { state: 'active', node: nodeId, base };
    g.events.emit('trialStarted', { trial: path.trial.id, node: nodeId });
    g.save.dirty = true;
    return { ok: true };
  }
  abandonTrial(id) { if (this.trials[id] && this.trials[id].state === 'active') { delete this.trials[id]; this.game.save.dirty = true; } }
  checkTrials() {
    for (const [id, t] of Object.entries(this.trials)) {
      if (t.state !== 'active') continue;
      const v = this.trialView(id);
      if (!v.objectives.every((o) => o.have >= o.count)) continue;
      t.state = 'passed';
      const g = this.game;
      g.events.emit('trialPassed', { trial: id, node: t.node });
      this.unlock(t.node);
    }
  }
  unlock(nodeId) {
    if (this.unlocked.includes(nodeId)) return;
    this.unlocked.push(nodeId);
    this.game.events.emit('classUnlocked', { classId: nodeId, node: CLASS_TREE[nodeId] });
    this.game.save.dirty = true;
  }
  // quest-tracker lines for the active trial
  tracker() {
    const out = [];
    for (const [id, t] of Object.entries(this.trials)) {
      if (t.state !== 'active') continue;
      const v = this.trialView(id);
      out.push({ title: TRIALS[id].title.toUpperCase(), side: false, lines: v.objectives.map((o) => ({ text: `${CLASS_COUNTERS[o.counter].label} ${Math.max(0, Math.floor(o.have))}/${o.count}`, done: o.have >= o.count })) });
    }
    return out;
  }

  serialize() { return { records: this.records, trials: this.trials, unlocked: this.unlocked }; }
  load(d) {
    if (!d) return;
    this.records = JSON.parse(JSON.stringify(d.records || {}));
    this.trials = JSON.parse(JSON.stringify(d.trials || {}));
    this.unlocked = (d.unlocked || []).filter((id) => CLASS_TREE[id]);
  }
}
export { evaluate };
