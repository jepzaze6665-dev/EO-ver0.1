import { QUESTS } from '../data/quests.js';
import { allMet } from '../progression/requirements.js';

export { QUESTS }; // (UI panels import it from here)

// QUEST SYSTEM — data in data/quests.js. Listens to game events, never looks inside combat / world / UI:
//   enemyDefeated · bossDefeated · zoneEnter · flag · npcTalked · itemCollected   (objective progress)
// and reports: questAccepted · questUpdated · questCompleted (rewards: ExperienceSystem + LootSystem; UI: game.js).
// State per active quest: { progress: { objId: n }, done: { objId: true } } (saved as is).
export class Quests {
  constructor(game, data = QUESTS) {
    this.game = game;
    this.data = data;
    this.active = {};
    this.completed = {};
    const ev = game.events;
    ev.on('enemyDefeated', (e) => { if (!e.summoned && !e.boss) this.onEvent('kill', { type: e.type }); });
    ev.on('bossDefeated', (e) => this.onEvent('boss', { type: e.type, bossId: e.bossId }));
    ev.on('zoneEnter', (z) => this.onEvent('reach', { zone: z }));
    ev.on('mapEntered', (e) => this.onEvent('reach', { map: e.id }));
    ev.on('flag', (f) => this.onEvent('flag', { flag: f }));
    ev.on('npcTalked', (e) => this.onEvent('talk', { npc: e.id }));
    ev.on('itemCollected', () => this.onEvent('collect', {}));
  }
  isActive(id) { return !!this.active[id]; }
  isDone(id) { return !!this.completed[id]; }
  context() {
    const g = this.game;
    return g.progression ? g.progression.context(g.player.cls.id) : { questsDone: new Set(Object.keys(this.completed)) };
  }
  canAccept(id) {
    const q = this.data[id];
    return !!q && !this.active[id] && !this.completed[id] && allMet(q.requirements, this.context());
  }
  // opts.npc: accepted by talking to that NPC (counts as its first 'talk' objective)
  accept(id, opts = {}) {
    if (!this.canAccept(id)) return false;
    const q = this.data[id];
    const st = this.active[id] = { progress: {}, done: {} };
    this.game.events.emit('questAccepted', { id, quest: q });
    // objectives already satisfied right now (flags set, standing in the zone, items owned, talking to the giver)
    const first = q.objectives[0];
    if (opts.npc && first && first.type === 'talk' && first.npc === opts.npc) this.markDone(id, first);
    for (const o of q.objectives) {
      if (st.done[o.id] || !this.unlocked(q, st, o)) continue;
      if (o.type === 'flag' && this.game.world.state.flags[o.flag]) this.markDone(id, o);
      else if (o.type === 'reach' && ((o.zone !== undefined && this.game.world.currentZone === o.zone) || (o.map !== undefined && this.game.world.mapId === o.map))) this.markDone(id, o);
      else if (o.type === 'collect') this.updateCollect(id, o);
    }
    this.checkComplete(id);
    this.game.save.dirty = true;
    return true;
  }
  // ordered quests: an objective counts only once every earlier one is done
  unlocked(q, st, o) {
    if (!q.ordered) return true;
    for (const x of q.objectives) { if (x === o) return true; if (!st.done[x.id]) return false; }
    return true;
  }
  current(id) {
    const q = this.data[id], st = this.active[id];
    return st ? q.objectives.find((o) => !st.done[o.id]) || null : null;
  }
  markDone(id, o) {
    const st = this.active[id];
    if (!st || st.done[o.id]) return;
    st.done[o.id] = true;
    this.game.events.emit('questUpdated', { id, objective: o.id, text: this.objText(o), done: true });
  }
  updateCollect(id, o) {
    const st = this.active[id], have = Math.min(o.count, this.game.inventory.count(o.item));
    if (have === (st.progress[o.id] || 0)) return;
    st.progress[o.id] = have;
    if (have >= o.count) this.markDone(id, o);
    else this.game.events.emit('questUpdated', { id, objective: o.id, progress: have, count: o.count, done: false });
  }
  onEvent(type, v) {
    for (const [qid, st] of Object.entries(this.active)) {
      const q = this.data[qid];
      let changed = false;
      for (const o of q.objectives) {
        if (st.done[o.id] || o.type !== type || !this.unlocked(q, st, o)) continue;
        if (type === 'kill' && (o.target === 'any' || o.target === v.type)) {
          st.progress[o.id] = Math.min(o.count, (st.progress[o.id] || 0) + 1);
          if (st.progress[o.id] >= o.count) this.markDone(qid, o);
          else this.game.events.emit('questUpdated', { id: qid, objective: o.id, progress: st.progress[o.id], count: o.count, done: false });
          changed = true;
        } else if (type === 'collect') { const before = st.progress[o.id]; this.updateCollect(qid, o); changed = before !== st.progress[o.id]; }
        else if ((type === 'reach' && ((o.zone !== undefined && o.zone === v.zone) || (o.map !== undefined && o.map === v.map))) || (type === 'flag' && o.flag === v.flag)
          || (type === 'talk' && o.npc === v.npc) || (type === 'boss' && (o.boss === v.type || (v.bossId && o.boss === v.bossId)))) { this.markDone(qid, o); changed = true; }
        // one step per event in ordered quests (talking to the guide must not tick "talk" and "return" at once)
        if (changed && q.ordered) break;
      }
      // a finalizing objective (e.g. the boss) completes whatever the player skipped before it
      const fin = q.objectives.findIndex((o) => o.finalizes && st.done[o.id]);
      if (fin > 0) for (const o of q.objectives.slice(0, fin)) if (!st.done[o.id]) { st.done[o.id] = true; changed = true; }
      if (changed) { this.checkComplete(qid); this.game.save.dirty = true; }
    }
  }
  checkComplete(id) {
    const q = this.data[id], st = this.active[id];
    if (!st || !q.objectives.every((o) => st.done[o.id])) return;
    delete this.active[id]; // removed before rewards: a quest can never complete (or pay out) twice
    this.completed[id] = true;
    this.game.events.emit('questCompleted', { id, quest: q, reward: q.rewards || {} });
  }
  // objective text can be supplied by the player's class (tutorial steps differ per class)
  objText(o) {
    const tut = o.classText && this.game.player && this.game.player.cls.tutorial;
    return (tut && tut[o.classText]) || o.text;
  }
  // NPC marker: a quest to offer, or an active quest waiting to be reported to it
  npcHasNews(npcId) {
    for (const [id, q] of Object.entries(this.data)) if (q.giver === npcId && this.canAccept(id)) return true;
    for (const id of Object.keys(this.active)) { const o = this.current(id); if (o && o.type === 'talk' && o.npc === npcId && this.unlocked(this.data[id], this.active[id], o)) return true; }
    return false;
  }
  // where the HUD / minimap should point: current objective of the first main quest, else a giver with a quest
  target() {
    const rank = (id) => (this.data[id].side ? 100 : 0) - (this.data[id].priority || 0);
    const ids = Object.keys(this.active).sort((a, b) => rank(a) - rank(b));
    for (const id of ids) { const o = this.current(id); if (o && o.marker) return { tx: o.marker[0], ty: o.marker[1] }; }
    for (const [id, q] of Object.entries(this.data)) if (!q.side && q.giver && this.canAccept(id)) return { npc: q.giver };
    return null;
  }
  // tracker lines for the HUD
  tracker() {
    const out = [];
    for (const [qid, st] of Object.entries(this.active)) {
      const q = this.data[qid];
      out.push({
        title: q.name, side: q.side,
        lines: q.objectives.map((o) => ({
          text: o.count ? `${this.objText(o)} ${Math.min(o.count, st.progress[o.id] || 0)}/${o.count}` : this.objText(o),
          done: !!st.done[o.id],
        })),
      });
    }
    if (this.game.progression) out.unshift(...this.game.progression.tracker()); // active class trial first
    return out.sort((a, b) => (a.side ? 1 : 0) - (b.side ? 1 : 0));
  }
  serialize() { return { active: this.active, completed: this.completed }; }
  // unknown quest ids (removed content) are dropped
  load(d) {
    const known = (o) => Object.fromEntries(Object.entries(o || {}).filter(([id]) => this.data[id]));
    this.active = JSON.parse(JSON.stringify(known(d.active)));
    this.completed = { ...known(d.completed) };
  }
}
