import { LEVELS } from '../data/levels.js';
import { questExp, hiddenExp } from './rewardScaling.js';

// EXPERIENCE SYSTEM: turns game events into EXP. The rules (curve, cap, level-up) live in
// data/levels.js + progression/experience.js; this file only decides *who* gets *how much* from which event.
//   enemyDefeated  -> e.exp (monster / boss expReward; summoned adds give nothing)
//   questCompleted / hiddenFound -> e.reward.exp
//   areaDiscovered / loreFound -> LEVELS.expSources
export class ExperienceSystem {
  constructor(game, rules = LEVELS) {
    this.game = game;
    const give = (n) => { if (n > 0) game.player.gainExp(n); };
    const ev = game.events;
    ev.on('enemyDefeated', (e) => { if (!e.summoned) give(e.exp); });
    // quest / secret EXP follows the new level bands (progression/rewardScaling.js, Level rework L4)
    ev.on('questCompleted', (e) => give(e.quest ? questExp(e.quest) : e.reward && e.reward.exp));
    ev.on('hiddenFound', (e) => give(e.entry ? hiddenExp(e.entry) : e.reward && e.reward.exp));
    for (const name of Object.keys(rules.expSources || {})) ev.on(name, () => give(rules.expSources[name]));
  }
}
