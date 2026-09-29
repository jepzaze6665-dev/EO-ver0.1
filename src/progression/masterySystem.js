import { MASTERY } from '../data/skillMastery.js';

// SKILL MASTERY (Skill System S3). Pure helpers + an event listener; rules in data/skillMastery.js.
// Progress lives in game.classProgress (per class, per skill: masteryXp / masteryLevel), so it survives
// class changes and saves like every other skill progress.

export function masteryLevelFor(xp, rules = MASTERY) {
  let lv = 0;
  for (let i = 1; i < rules.thresholds.length; i++) if (xp >= rules.thresholds[i]) lv = i;
  return lv;
}
// { level, xp, into, need } for UI bars (need = 0 at max)
export function masteryInfo(entry, rules = MASTERY) {
  const xp = (entry && entry.masteryXp) || 0, level = masteryLevelFor(xp, rules);
  const max = rules.thresholds.length - 1;
  if (level >= max) return { level, xp, into: 0, need: 0, max };
  return { level, xp, into: xp - rules.thresholds[level], need: rules.thresholds[level + 1] - rules.thresholds[level], max };
}
// adds XP to a classProgress skill entry -> levels gained
export function addMasteryXp(entry, amount, rules = MASTERY) {
  if (!(amount > 0)) return 0;
  const cap = rules.thresholds[rules.thresholds.length - 1];
  const before = masteryLevelFor(entry.masteryXp, rules);
  entry.masteryXp = Math.min(cap, (entry.masteryXp || 0) + amount);
  entry.masteryLevel = masteryLevelFor(entry.masteryXp, rules);
  return entry.masteryLevel - before;
}
export function masteryReward(level, rules = MASTERY) {
  const r = rules.rewards[Math.max(0, Math.min(rules.rewards.length - 1, level))] || {};
  return { cooldown: r.cooldown ?? 1, cost: r.cost ?? 1, text: r.text || '' };
}

// Listens to combat events and pays mastery XP to the player's active-class skills.
// Sources: skillUsed · skillHit (hitboxes / projectiles carry skillId) · perfectDodge · counterHit.
export class MasterySystem {
  constructor(game, rules = MASTERY) {
    this.game = game;
    this.rules = rules;
    this.hitsThisCast = {}; // skill id -> hits paid since its last cast
    this.lastHit = null;    // { skillId, t } the last skill hit (combo source)
    this.perfectAt = -99;
    this.perfectPaid = true;
    const ev = game.events;
    this.unsubs = [
      ev.on('skillUsed', (e) => this.onUsed(e)),
      ev.on('skillHit', (e) => this.onHit(e)),
      ev.on('perfectDodge', () => { this.perfectAt = game.time; this.perfectPaid = false; }),
      ev.on('counterHit', (e) => { if (e.skillId && e.source === game.player) this.give(e.skillId, rules.xp.counter, 'counter'); }),
    ];
  }
  dispose() { for (const u of this.unsubs) u(); }

  // a skill of the ACTIVE class only (locked old-class skills never gain)
  owns(skillId) {
    const p = this.game.player;
    return !!(p && p.skillSys.get(skillId) && p.skillSys.get(skillId).type !== 'basic');
  }
  give(skillId, amount, why) {
    if (!this.owns(skillId) || !(amount > 0)) return 0;
    const g = this.game, p = g.player;
    const entry = g.classProgress.skill(p.cls.id, skillId);
    const up = addMasteryXp(entry, amount, this.rules);
    if (up > 0) g.events.emit('skillMasteryUp', { player: p, skillId, level: entry.masteryLevel, name: this.rules.names[entry.masteryLevel] });
    return up;
  }
  onUsed(e) {
    const g = this.game;
    if (e.caster !== g.player || e.recast || !this.owns(e.skillId)) return;
    this.hitsThisCast[e.skillId] = 0;
    this.give(e.skillId, this.rules.xp.use, 'use');
    // COMBO: another skill connected just before this cast
    const l = this.lastHit;
    if (l && l.skillId !== e.skillId && g.time - l.t <= this.rules.comboWindow) this.give(e.skillId, this.rules.xp.combo, 'combo');
  }
  onHit(e) {
    const g = this.game, id = e.skillId, t = e.target;
    if (e.source !== g.player || !this.owns(id) || !t) return;
    if (this.rules.noXpFlags.some((f) => t[f])) return;
    this.lastHit = { skillId: id, t: g.time };
    const n = this.hitsThisCast[id] || 0;
    if (n < this.rules.xp.hitCapPerCast) { this.hitsThisCast[id] = n + 1; this.give(id, this.rules.xp.hit, 'hit'); }
    if (e.killed) this.give(id, this.rules.xp.kill, 'kill');
    if (!this.perfectPaid && g.time - this.perfectAt <= this.rules.perfectWindow) { this.perfectPaid = true; this.give(id, this.rules.xp.afterPerfect, 'afterPerfect'); }
  }
}
