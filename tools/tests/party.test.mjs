// Combat 2.0 phase C9 — party foundation: downed / revive / bleed-out / encounter failed. Run:  node tools/tests/party.test.mjs
import { PartySystem } from '../../src/party/partySystem.js';
import { PARTY } from '../../src/data/party.js';
import { EventBus } from '../../src/core/events.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const setup = (n) => {
  const events = new EventBus(), log = [];
  for (const e of ['playerDowned', 'reviveStarted', 'reviveInterrupted', 'playerRevived', 'playerBledOut', 'encounterFailed']) events.on(e, () => log.push(e));
  const party = new PartySystem({ events });
  const ms = Array.from({ length: n }, (_, i) => ({ id: i, x: i * 20, y: 0, hp: 100, maxHp: 100 }));
  ms.forEach((m) => party.add(m));
  return { events, party, ms, log };
};
const run = (party, reviver, sec) => { for (let t = 0; t < sec; t += 0.1) { party.tryRevive(reviver, 0.1); party.update(0.1); } };

console.log('party');
test('solo: 0 HP = ENCOUNTER FAILED straight away (no downed state)', () => {
  const { party, ms, log } = setup(1); ok(party.onDefeated(ms[0]) === 'failed' && ms[0].dead && log.includes('encounterFailed'), 'failed');
});
test('party: first fall = DOWNED (not dead), the last one standing = FAILED', () => {
  const { party, ms, log } = setup(2);
  ok(party.onDefeated(ms[0]) === 'downed' && ms[0].downed && !ms[0].dead, 'downed');
  ok(party.standing().length === 1, 'one standing');
  ok(party.onDefeated(ms[1]) === 'failed' && party.failed && ms[0].dead && log.includes('encounterFailed'), 'failed');
});
test('revive: holding next to the downed member for reviveTime brings it back with reviveHp', () => {
  const { party, ms, log } = setup(2); party.onDefeated(ms[0]);
  run(party, ms[1], PARTY.downed.reviveTime * 0.5); ok(ms[0].downed && party.progress(ms[0]) > 0.3, 'half way');
  run(party, ms[1], PARTY.downed.reviveTime * 0.6); ok(!ms[0].downed && ms[0].hp === 100 * PARTY.downed.reviveHp && log.includes('playerRevived'), 'revived');
});
test('a hit on the reviver interrupts; letting go interrupts too', () => {
  const { events, party, ms, log } = setup(2); party.onDefeated(ms[0]);
  run(party, ms[1], 1); events.emit('damageTaken', { target: ms[1], amount: 10 });
  ok(log.includes('reviveInterrupted') && party.progress(ms[0]) === 0, 'hit');
  run(party, ms[1], 1); party.update(0.1); party.update(0.1);
  ok(party.progress(ms[0]) === 0, 'released');
});
test('too far away: no revive', () => {
  const { party, ms } = setup(2); party.onDefeated(ms[0]); ms[1].x = 500; run(party, ms[1], 5); ok(ms[0].downed, 'still downed');
});
test('bleed-out: a downed member left alone is defeated; the party only fails when nobody stands', () => {
  const { party, ms, log } = setup(3); party.onDefeated(ms[0]); ms[1].x = 999; ms[2].x = 999;
  for (let t = 0; t <= PARTY.downed.bleedOut + 0.2; t += 0.1) party.update(0.1);
  ok(ms[0].dead && !ms[0].downed && log.includes('playerBledOut') && !party.failed, 'bled out, party fine');
});
test('max 4 members; reset (checkpoint) stands everyone up', () => {
  const { party, ms } = setup(4); ok(!party.add({}), '5th refused');
  party.onDefeated(ms[0]); party.reset(); ok(!ms[0].downed && !party.failed, 'reset');
});

test('online allies: alone on this client but a teammate up elsewhere -> DOWNED; our own bleed-out still ends OUR encounter', () => {
  const { party, ms, log } = setup(1);
  let up = 1; party.allies = () => up;
  party.game.player = ms[0];
  ok(party.onDefeated(ms[0]) === 'downed' && ms[0].downed, 'downed thanks to a remote teammate');
  run(party, ms[1] || ms[0], PARTY.downed.bleedOut + 1);
  ok(ms[0].dead && party.failed && log.includes('playerBledOut'), 'bled out -> failed for us');
  const b = setup(1); b.party.allies = () => 0;
  ok(b.party.onDefeated(b.ms[0]) === 'failed', 'nobody up anywhere -> failed at once');
  up = 0;
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
