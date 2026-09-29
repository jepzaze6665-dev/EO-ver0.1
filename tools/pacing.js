// PACING — "what level is the player when they reach each boss?" (Level rework L4). Browser-side, read-only:
//   const P = await import('/tools/pacing.js'); P.pacing(__game)
// One clear of every field spawn on a map (same monster stats as the real game: World.spawnOpts) + that map's quests,
// secret areas and optional mini-bosses, then the boss reward. No respawn farming, so real players end a bit higher.
import { QUESTS } from '../src/data/quests.js';
import { HIDDEN } from '../src/data/hidden.js';
import { BOSSES } from '../src/data/bosses.js';
import { addExp } from '../src/progression/experience.js';
import { bossScale } from '../src/progression/levelScaling.js';
import { questExp, hiddenExp } from '../src/progression/rewardScaling.js';
import { Monster } from '../src/monsters/monster.js';
import { START_GRID } from '../src/world/levels/index.js';
import { DIFFICULTY } from '../src/data/difficulty.js';

// which quests belong to which map (the start quests count for both routes)
export const ROUTES = {
  A: [
    { map: 'a1', boss: 'boss_a1', quests: ['beyond_lumina', 'first_steps', 'forest_hunts', 'whispers'], minis: ['mini_hollow_fang', 'mini_grukk'] },
    { map: 'a2', boss: 'boss_a2', quests: ['route_a', 'burning_rift'] },
    { map: 'a3', boss: 'boss_a3', quests: ['fallen_city'] },
  ],
  B: [
    { map: 'b1', boss: 'boss_b1', quests: ['beyond_lumina', 'first_steps', 'eastern_road'] },
    { map: 'b2', boss: 'boss_b2', quests: ['crystal_depths'] },
    { map: 'b3', boss: 'boss_b3', quests: ['frostpeak_climb'] },
  ],
};

// EXP of one clear of a map's field spawns
export function mapClearExp(g, mapId) {
  const w = g.world, def = w.mapManager.get(mapId);
  if (!def) return { exp: 0, monsters: 0 };
  w.enterGrid(def.grid || START_GRID); // maps without a grid live on the start grid
  let exp = 0, monsters = 0;
  for (const sp of w.spawnPoints) {
    const d = sp.def;
    if (d.type === 'guardian') continue;
    const opts = w.spawnOpts(d);
    if (opts.mapId !== mapId) continue;
    const m = new Monster(g, d.type, d.x, d.y, opts);
    exp += m.expReward * d.count; monsters += d.count;
  }
  return { exp, monsters };
}

export function pacing(g, { routes = ['A', 'B'] } = {}) {
  const out = {};
  for (const r of routes) {
    let level = 1, xp = 0;
    const add = (n) => { const s = addExp(level, xp, Math.round(n * DIFFICULTY.expRate)); level = s.level; xp = s.exp; };
    const rows = [];
    for (const step of ROUTES[r]) {
      const clear = mapClearExp(g, step.map);
      add(clear.exp);
      for (const id of step.minis || []) add(Math.round((BOSSES[id].rewards.exp || 0) * bossScale(BOSSES[id]).exp));
      for (const q of step.quests) if (QUESTS[q]) add(questExp(QUESTS[q]));
      for (const h of Object.values(HIDDEN)) if (h.map === step.map && h.reward) add(hiddenExp(h));
      const b = BOSSES[step.boss];
      rows.push({ map: step.map, monsters: clear.monsters, clearExp: Math.round(clear.exp), levelAtBoss: level, bossLevel: b.level, recommended: b.recommendedLevel });
      add(Math.round((b.rewards.exp || 0) * bossScale(b).exp));
    }
    rows.push({ map: 'END', levelAtBoss: level });
    out[r] = rows;
  }
  g.world.enterGrid(START_GRID);
  return out;
}
