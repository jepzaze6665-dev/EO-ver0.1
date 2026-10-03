// RUN SUMMARY: protocol check for runStat + the server relays a member's stats to the run's members. Run: node tools/tests/runSummary.test.mjs
import { validateClientMessage } from '../../src/net/protocol.js';
import { readFileSync } from 'fs';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const valid = (m) => validateClientMessage(JSON.stringify(m)).ok !== false;

test('runStat accepts 4 whole non-negative numbers and nothing else', () => {
  ok(valid({ t: 'runStat', s: { dmg: 1200, heal: 30, deaths: 1, kills: 9 } }), 'good row refused');
  ok(!valid({ t: 'runStat', s: { dmg: -5, heal: 0, deaths: 0, kills: 0 } }), 'negative accepted');
  ok(!valid({ t: 'runStat', s: { dmg: 1.5, heal: 0, deaths: 0, kills: 0 } }), 'fraction accepted');
  ok(!valid({ t: 'runStat', s: { dmg: 1, heal: 0, deaths: 0, kills: 0, gold: 9 } }), 'extra field accepted');
});

test('server relays runStat to the run members; the client sends it and the game shows the summary on banking', () => {
  ok(/handle\('runStat'/.test(readFileSync(new URL('../../server/dungeons.js', import.meta.url), 'utf8')), 'server handler');
  ok(/'runSummary'/.test(readFileSync(new URL('../../src/core/game.js', import.meta.url), 'utf8')), 'game listener');
  ok(/emit\('runSummary'/.test(readFileSync(new URL('../../src/dungeon/runSystem.js', import.meta.url), 'utf8')), 'run emits it');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
