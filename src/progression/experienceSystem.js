// EXPERIENCE SYSTEM: turns game events into EXP. The rules (curve, cap, level-up) live in
// data/levels.js + progression/experience.js; this file only decides *who* gets *how much* from which event.
export class ExperienceSystem {
  constructor(game) {
    this.game = game;
    game.events.on('enemyDefeated', (e) => {
      if (e.summoned || !(e.exp > 0)) return; // summoned adds give nothing (no infinite EXP)
      game.player.gainExp(e.exp);
    });
  }
}
