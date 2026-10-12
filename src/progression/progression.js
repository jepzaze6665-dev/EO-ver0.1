import { CLASS_TREE, CLASS_COUNTERS, TRIALS, trialChapters } from '../data/classTree.js';
import { evaluate, evaluateAll, matches } from './requirements.js';

// CLASS PROGRESSION — class records, class-tree requirements and class trials for the current character.
// Everything comes from data/classTree.js; this file never names a class.
//   records : per class, counters fed by bus events (CLASS_COUNTERS)
//   trials  : { trialId: { state: 'active' | 'passed', base: { counter: valueAtStart } } }
//   unlocked: class ids the character has earned (Class Change itself is Phase 13)
// Events: trialStarted, trialChapter, trialProgress, trialPassed, classUnlocked
// CLASS QUESTS (Quest rework Q2): a trial may be a chain of CHAPTERS (data/classTree.js trialChapters): talk to the
// line's master · counters (the old trial objectives) · bring an item · defeat a boss (the shadow duel). The state keeps
// `step`; counters measure from the moment their chapter begins. A 'boss' chapter sets flags duel_<class> (the shadow
// appears) + provingOpen (the ring opens); they are cleared when the trial ends.
export class Progression {
  constructor(game) {
    this.game = game;
    this.records = {};
    this.trials = {};
    this.unlocked = [];
    this.startingClass = null; // chosen at character creation
    this.history = [];        // class changes: { from, to, level }
    this.wire();
  }

  // ---------------- class records
  wire() {
    const ev = this.game.events;
    const byEvent = {};
    for (const [id, c] of Object.entries(CLASS_COUNTERS)) (byEvent[c.event] ||= []).push([id, c]);
    // chapter steps that wait for an event
    ev.on('npcTalked', (e) => this.onChapterEvent('talk', (c) => c.npc === (e && e.id)));
    ev.on('itemCollected', () => this.onChapterEvent('item', (c) => this.game.inventory.count(c.item) >= (c.count || 1)));
    ev.on('bossDefeated', (e) => this.onChapterEvent('boss', (c) => c.boss === (e && e.bossId)));
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
  // what any requirement may read about the character + world (world/worldProgression.js adds bosses / maps / events)
  baseContext() {
    const g = this.game, p = g.player;
    return {
      level: p.level, classId: p.cls.id,
      questsDone: new Set(Object.keys(g.quests.completed || {})),
      flags: g.world.state.flags,
      items: (id) => g.inventory.count(id),
      secrets: g.world.map.secretsFound.size,
    };
  }
  context(classId) {
    const g = this.game;
    return {
      ...(g.worldProgress ? g.worldProgress.context() : this.baseContext()),
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

  // the whole lineage of the current class for the tree view: root (tier 1 ancestor) + every descendant.
  // state: current · owned (can change into) · unlocked · ready (trial can start) · locked · future (deeper tier)
  // hidden nodes (secret classes) are left out until their reveal conditions are met.
  lineage() {
    const cur = this.game.player.cls.id;
    let root = cur;
    while (CLASS_TREE[root] && CLASS_TREE[root].parent) root = CLASS_TREE[root].parent;
    const ctx = this.context(cur), readyIds = new Set(this.paths().filter((x) => x.ready).map((x) => x.node.id));
    const out = [];
    const visit = (id, depth) => {
      const n = CLASS_TREE[id];
      if (!n) return;
      if (n.hidden && !(n.reveal && evaluateAll(n.reveal, ctx).every((r) => r.met))) return;
      const state = id === cur ? 'current' : this.owns(id) ? (n.playable ? 'owned' : 'unlocked')
        : readyIds.has(id) ? 'ready' : n.parent === cur ? 'locked' : 'future';
      out.push({ node: n, depth, state });
      for (const c of Object.values(CLASS_TREE)) if (c.parent === id) visit(c.id, depth + 1);
    };
    visit(root, 0);
    return out;
  }

  // ---------------- trials
  // { state, step, chapters: [{ ...chapter, done, current }], objectives (the counters of the current chapter) }
  trialView(id) {
    const t = this.trials[id], def = TRIALS[id], ch = trialChapters(def);
    if (!t) return { state: 'locked', step: -1, chapters: ch.map((c) => ({ ...c, done: false, current: false })), objectives: [] };
    if (t.state === 'passed') return { state: 'passed', step: ch.length, chapters: ch.map((c) => ({ ...c, done: true, current: false })), objectives: (def.objectives || []).map((o) => ({ ...o, have: o.count })) };
    const step = t.step || 0, cur = ch[step], cls = this.game.player.cls.id;
    const objectives = cur && cur.type === 'counters' ? (def.objectives || []).map((o) => ({ ...o, have: Math.min(o.count, this.record(cls, o.counter) - ((t.base || {})[o.counter] || 0)) })) : [];
    return { state: 'active', step, chapters: ch.map((c, i) => ({ ...c, done: i < step, current: i === step })), objectives };
  }
  // the chapter the active trial is on
  chapterOf(id) { const t = this.trials[id]; return t && t.state === 'active' ? trialChapters(TRIALS[id])[t.step || 0] : null; }
  // start chapter i of trial id (counters: remember where they stand; boss: open the ring + call the shadow)
  enterChapter(id, i) {
    const g = this.game, t = this.trials[id], ch = trialChapters(TRIALS[id]);
    t.step = i;
    const c = ch[i];
    if (!c) return this.passTrial(id);
    if (c.type === 'counters') { t.base = {}; for (const o of TRIALS[id].objectives || []) t.base[o.counter] = this.record(g.player.cls.id, o.counter); }
    if (c.type === 'boss' && g.world) { g.world.setFlag('duel_' + t.node); g.world.setFlag('provingOpen'); }
    g.events.emit('trialChapter', { trial: id, node: t.node, step: i, chapter: c });
    g.save.dirty = true;
    // a chapter that is already met (item in the bag, master just spoken to) moves on at once
    if (c.type === 'item' && g.inventory.count(c.item) >= (c.count || 1)) return this.enterChapter(id, i + 1);
    if (c.type === 'counters') this.checkTrials();
  }
  onChapterEvent(type, ok) {
    for (const id of Object.keys(this.trials)) {
      const c = this.chapterOf(id);
      if (c && c.type === type && ok(c)) this.enterChapter(id, (this.trials[id].step || 0) + 1);
    }
  }
  clearDuel(id) {
    const t = this.trials[id], w = this.game.world;
    if (t && w && w.state.flags['duel_' + t.node]) w.setFlag('duel_' + t.node, false);
  }
  startTrial(nodeId) {
    const g = this.game, path = this.paths().find((x) => x.node.id === nodeId);
    if (!path || !path.trial) return { ok: false, reason: 'unknown' };
    if (!path.ready) return { ok: false, reason: 'requirements' };
    if (this.trials[path.trial.id]) return { ok: false, reason: this.trials[path.trial.id].state };
    if (Object.values(this.trials).some((t) => t.state === 'active')) return { ok: false, reason: 'busy' }; // one trial at a time
    this.trials[path.trial.id] = { state: 'active', node: nodeId, base: {}, step: 0 };
    g.events.emit('trialStarted', { trial: path.trial.id, node: nodeId });
    this.enterChapter(path.trial.id, 0);
    g.save.dirty = true;
    return { ok: true };
  }
  abandonTrial(id) { if (this.trials[id] && this.trials[id].state === 'active') { this.clearDuel(id); delete this.trials[id]; this.game.save.dirty = true; } }
  checkTrials() {
    for (const [id, t] of Object.entries(this.trials)) {
      if (t.state !== 'active') continue;
      const c = this.chapterOf(id);
      if (!c || c.type !== 'counters') continue;
      const v = this.trialView(id);
      if (!v.objectives.every((o) => o.have >= o.count)) continue;
      this.enterChapter(id, (t.step || 0) + 1);
    }
  }
  passTrial(id) {
    const t = this.trials[id], g = this.game;
    if (!t || t.state === 'passed') return;
    this.clearDuel(id);
    t.state = 'passed';
    g.events.emit('trialPassed', { trial: id, node: t.node });
    this.unlock(t.node);
    g.save.dirty = true;
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
      const v = this.trialView(id), c = v.chapters[v.step];
      // only while the counters are what this chapter asks for: each one + how to earn it (hint) until it is done
      const counting = !c || c.type === 'counters';
      const counters = counting ? v.objectives.flatMap((o) => {
        const def = CLASS_COUNTERS[o.counter], done = o.have >= o.count;
        const row = { text: `${def.label} ${Math.max(0, Math.floor(o.have))}/${o.count}`, done };
        return !done && def.hint ? [row, { text: def.hint, hint: true }] : [row];
      }) : [];
      const head = c && c.text && v.chapters.length > 1 ? [{ text: c.text, done: false }, ...(c.where ? [{ text: c.where, hint: true }] : [])] : [];
      const lines = [...head, ...counters];
      out.push({ title: TRIALS[id].title.toUpperCase(), side: false, lines });
    }
    return out;
  }

  // classes this character may change into: its starting class + everything unlocked
  owns(classId) { return classId === this.startingClass || this.unlocked.includes(classId); }

  serialize() { return { records: this.records, trials: this.trials, unlocked: this.unlocked, startingClass: this.startingClass, history: this.history }; }
  load(d) {
    if (!d) return;
    this.records = JSON.parse(JSON.stringify(d.records || {}));
    this.trials = JSON.parse(JSON.stringify(d.trials || {}));
    this.unlocked = (d.unlocked || []).filter((id) => CLASS_TREE[id]);
    this.startingClass = CLASS_TREE[d.startingClass] ? d.startingClass : null;
    this.history = Array.isArray(d.history) ? d.history.slice(-50) : [];
  }
}
export { evaluate };
