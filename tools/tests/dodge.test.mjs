// Combat 2.0 phase C2 — dodge rules + Perfect Dodge reward data. Run:  node tools/tests/dodge.test.mjs
import { DODGE, isPerfectDodge } from '../../src/data/dodge.js';
import { STATUSES } from '../../src/data/statuses.js';
import { CLASSES } from '../../src/skills/classes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

console.log('dodge');
test('i-frames cover the dash; the perfect window sits inside the i-frames', () => {
  ok(DODGE.iframes >= DODGE.time, 'iframes >= dash');
  ok(DODGE.perfectWindow > 0 && DODGE.perfectWindow < DODGE.iframes, 'window inside iframes (normal dodge stays useful)');
  ok(DODGE.recovery >= 0 && DODGE.recovery <= 0.15, 'small recovery');
});
test('isPerfectDodge: inside the window only, blocked by its cooldown', () => {
  ok(isPerfectDodge(10.1, 10, 0), 'inside');
  ok(!isPerfectDodge(10 + DODGE.perfectWindow + 0.01, 10, 0), 'late');
  ok(!isPerfectDodge(9.9, 10, 0), 'before pressing');
  ok(!isPerfectDodge(10.1, 10, 0.2), 'cooldown');
  ok(isPerfectDodge(10 + DODGE.perfectWindow + 0.05, 10, 0, 0.06), 'item bonus window');
});
test('every class: Perfect Dodge reward data is valid (known fields, real statuses, small numbers)', () => {
  const known = new Set(['marks', 'resource', 'stamina', 'cooldownCut', 'statuses']);
  for (const [id, c] of Object.entries(CLASSES)) {
    const r = c.perfectDodge || DODGE.perfectDefault;
    for (const k of Object.keys(r)) ok(known.has(k), `${id}: unknown field ${k}`);
    ok(!r.cooldownCut || (r.cooldownCut > 0 && r.cooldownCut <= 1.5), `${id}: cooldownCut`);
    ok(!r.marks || r.marks <= 1, `${id}: at most +1 mark (spec §44)`);
    for (const s of r.statuses || []) ok(STATUSES[s.id] && s.dur > 0, `${id}: status ${s.id}`);
  }
});
test('Umbral Sword: +1 Shadow Mark + counter opportunity (spec §44)', () => {
  const r = CLASSES.umbral_sword.perfectDodge;
  ok(r.marks === 1 && r.statuses.some((s) => s.id === 'counter_ready'), 'mark + counter_ready');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
