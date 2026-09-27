import { Z } from '../core/constants.js';

// Data-driven quests. Objective types: zone (enter zone), kill (type, count), flag (world flag set).
export const QUESTS = {
  first_steps: {
    title: 'FIRST STEPS OF SHADOW', giver: 'Captain Aldric', side: true,
    desc: 'Aldric wants proof you can survive the forest: master your class techniques.',
    objectives: [
      { id: 'mark', text: 'Build 3 Shadow Marks', classText: 'marks', type: 'flag', flag: 'tut_marks' },
      { id: 'perfect', text: 'Perform a Perfect Dodge', classText: 'perfect', type: 'flag', flag: 'tut_perfect' },
      { id: 'break', text: 'Unleash Shadow Break', classText: 'break', type: 'flag', flag: 'tut_break' },
    ],
    reward: { exp: 80, gold: 60, items: { shadow_tonic: 2 } },
  },
  whispers: {
    title: 'WHISPERS IN THE FOREST', giver: 'Elder Maren',
    desc: 'A fog has swallowed the Whispering Forest and the beasts have turned savage. Find the source.',
    objectives: [
      { id: 'enter', text: 'Enter Whispering Forest', type: 'zone', zone: Z.FOREST },
      { id: 'wolves', text: 'Defeat Forest Wolves', type: 'kill', target: 'wolf', count: 5 },
      { id: 'shrine', text: 'Investigate Ancient Shrine', type: 'flag', flag: 'shrineInvestigated' },
      { id: 'discover', text: 'Discover Guardian', type: 'flag', flag: 'guardianDiscovered' },
      { id: 'defeat', text: 'Defeat Guardian', type: 'flag', flag: 'guardianDefeated', finalizes: true },
    ],
    reward: { exp: 400, gold: 250, items: { hp_potion: 3 } },
  },
  valley: {
    title: 'PATH TO ANCIENT VALLEY', giver: 'World',
    desc: 'With the Guardian at peace, the thorns sealing the northern road have withered.',
    objectives: [
      { id: 'gd', text: 'Guardian Defeated', type: 'flag', flag: 'guardianDefeated' },
      { id: 'fr', text: 'Forest Restored', type: 'flag', flag: 'forestRestored' },
      { id: 'enter', text: 'Enter Ancient Valley', type: 'zone', zone: Z.VALLEY },
    ],
    reward: { exp: 200, gold: 100 },
  },
  depths: {
    title: 'THE SEALED DEPTHS', giver: 'Scout Wren',
    desc: 'An ancient dungeon lies sealed beneath the valley. Its lock answers to power not yet found.',
    objectives: [
      { id: 'find', text: 'Find a way to unseal the Depths', type: 'flag', flag: '__future__' },
    ],
    reward: {},
  },
};

export class Quests {
  constructor(game) {
    this.game = game;
    this.active = {}; // id -> {progress:{objId: n}, done:{objId: bool}}
    this.completed = {};
    game.events.on('zoneEnter', (z) => this.onEvent('zone', z));
    game.events.on('kill', (type) => this.onEvent('kill', type));
    game.events.on('flag', (f) => this.onEvent('flag', f));
  }
  isActive(id) { return !!this.active[id]; }
  isDone(id) { return !!this.completed[id]; }
  accept(id) {
    if (this.active[id] || this.completed[id]) return;
    const q = QUESTS[id];
    this.active[id] = { progress: {}, done: {} };
    this.game.ui.questBanner('NEW QUEST', q.title);
    this.game.audio.sfx('quest');
    // objectives that are already satisfied
    const flags = this.game.world.state.flags;
    for (const o of q.objectives) {
      if (o.type === 'flag' && flags[o.flag]) this.active[id].done[o.id] = true;
      if (o.type === 'zone' && this.game.world.currentZone === o.zone) this.active[id].done[o.id] = true;
    }
    this.checkComplete(id);
    this.game.save.dirty = true;
  }
  onEvent(type, value) {
    for (const [qid, st] of Object.entries(this.active)) {
      const q = QUESTS[qid];
      let changed = false;
      for (const o of q.objectives) {
        if (st.done[o.id]) continue;
        if (o.type === 'zone' && type === 'zone' && value === o.zone) { st.done[o.id] = true; changed = true; }
        if (o.type === 'flag' && type === 'flag' && value === o.flag) { st.done[o.id] = true; changed = true; }
        if (o.type === 'kill' && type === 'kill' && value === o.target) {
          st.progress[o.id] = (st.progress[o.id] || 0) + 1;
          if (st.progress[o.id] >= o.count) st.done[o.id] = true;
          changed = true;
        }
        if (changed && st.done[o.id]) this.game.ui.notify(q.title, `✓ ${this.objText(o)}`, '#a8f0b0');
      }
      // a finalizing objective (e.g. the boss) completes whatever the player skipped
      if (q.objectives.some((o) => o.finalizes && st.done[o.id])) for (const o of q.objectives) st.done[o.id] = true;
      if (changed) { this.checkComplete(qid); this.game.save.dirty = true; }
    }
  }
  checkComplete(id) {
    const q = QUESTS[id], st = this.active[id];
    if (!st) return;
    if (!q.objectives.every((o) => st.done[o.id])) return;
    delete this.active[id];
    this.completed[id] = true;
    const g = this.game, r = q.reward || {};
    if (r.exp) g.player.gainExp(r.exp);
    if (r.gold) g.player.gold += r.gold;
    for (const [it, n] of Object.entries(r.items || {})) g.inventory.add(it, n, true);
    g.ui.questBanner('QUEST COMPLETE', q.title + (r.gold ? `   +${r.gold}G  +${r.exp} EXP` : ''));
    g.audio.sfx('quest_done');
    g.events.emit('questComplete', id);
  }
  // objective text can be supplied by the player's class (tutorial steps differ per class)
  objText(o) {
    const tut = o.classText && this.game.player && this.game.player.cls.tutorial;
    return (tut && tut[o.classText]) || o.text;
  }
  // tracker lines for the HUD
  tracker() {
    const out = [];
    for (const [qid, st] of Object.entries(this.active)) {
      const q = QUESTS[qid];
      out.push({
        title: q.title, side: q.side,
        lines: q.objectives.map((o) => ({
          text: o.type === 'kill' ? `${o.text} ${Math.min(o.count, st.progress[o.id] || 0)}/${o.count}` : this.objText(o),
          done: !!st.done[o.id],
        })),
      });
    }
    return out.sort((a, b) => (a.side ? 1 : 0) - (b.side ? 1 : 0));
  }
  serialize() { return { active: this.active, completed: this.completed }; }
  load(d) { this.active = JSON.parse(JSON.stringify(d.active || {})); this.completed = { ...(d.completed || {}) }; }
}
