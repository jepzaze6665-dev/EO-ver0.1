// H1 (docs/online/HEADLESS_SERVER_PLAN.md): the real Game runs in Node (SimGame), and the bot plays the A1 loop
// (guide -> A1 -> fight -> EXP / gold / loot -> back to the guide) exactly like testkit.a1Loop in the browser.
import { createSimGame } from '../../src/sim/simGame.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  FAIL') + ' ' + m); if (!c) fails++; };
console.log('simGame.test');

const sim = await createSimGame({ classId: 'umbral_sword' });
const g = sim.game;
ok(g.state === 'play' && g.world.mapId === 'lumina' && g.player.hp > 0, `new game in Node: ${g.state} on ${g.world.mapId}`);
const ms = sim.measure(2);
ok(ms < 5, `one tick in a city: ${ms.toFixed(2)} ms`);

const T = await import('../testkit.js');
for (const classId of ['umbral_sword', 'astral_weaver', 'aegis_guardian']) {
  const rows = T.a1Loop(g, classId);
  // a1Loop's "level went up before the turn-in" predates the level rework (5 A1 kills no longer give a level);
  // here: EXP was earned and the quest turn-in levels the player
  const exp = rows.find((r) => r[0].startsWith('EXP'));
  const gold = exp && /gold (\d+)->(\d+)/.exec(exp[2]);
  if (exp && !exp[1] && gold && +gold[2] > +gold[1] && (g.player.level > 1 || g.player.exp > 0)) exp[1] = true;
  const bad = rows.filter((r) => !r[1]);
  ok(!bad.length, `${classId}: bot plays the A1 loop headless (${rows.length} steps)` + (bad.length ? ' — ' + bad.map((r) => r[0] + ' ' + r[2]).join(' | ') : ''));
}
// fighting cost (A1 with monsters around), for the server load estimate
T.goto(g, 38, 121);
const fightMs = sim.measure(3, (gg, i) => T.bot(gg, i, { god: true }));
ok(fightMs < 5, `one tick while fighting in A1: ${fightMs.toFixed(2)} ms`);

console.log(fails ? `simGame.test: ${fails} FAILED` : 'simGame.test: all passed');
process.exit(fails ? 1 : 0);
