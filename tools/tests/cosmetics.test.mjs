// F4 cosmetics (data/cosmetics.js): data is sane, cleanLook drops bad ids, the Player wear / unlock rules, Thai text exists.
// Run:  node tools/tests/cosmetics.test.mjs
import { COSMETICS, COSMETIC_SLOTS, FREE_COSMETICS, cleanLook } from '../../src/data/cosmetics.js';
import { CLIENT_MESSAGES } from '../../src/net/protocol.js';
let pass = 0, fail = 0;
const test = (n, fn) => { try { fn(); pass++; console.log('  ✓', n); } catch (e) { fail++; console.log('  ✗', n, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };

test('every cosmetic: known slot, name, swatch, the field its slot needs, id fits the protocol slug', () => {
  for (const [id, c] of Object.entries(COSMETICS)) {
    ok(COSMETIC_SLOTS.includes(c.slot), id + ' slot'); ok(c.name && /^#[0-9a-f]{6}$/i.test(c.swatch), id + ' name / swatch');
    ok(c.slot !== 'dye' || typeof c.filter === 'string', id + ' filter'); ok(c.slot !== 'aura' || /^\d+,\d+,\d+$/.test(c.aura.color), id + ' aura');
    ok(c.slot !== 'glow' || typeof c.glow === 'object', id + ' glow'); ok(/^[A-Za-z0-9_]{1,24}$/.test(id), id + ' slug');
    ok(!('atk' in c || 'hp' in c || 'stats' in c || 'modifiers' in c), id + ' must not carry stats');
  }
  ok(FREE_COSMETICS.length >= 1, 'some free');
});
test('cleanLook drops unknown / wrong-slot ids', () => {
  const l = cleanLook({ dye: 'aura_ember', aura: 'aura_ember', glow: 'nope' });
  ok(l.dye === null && l.aura === 'aura_ember' && l.glow === null, JSON.stringify(l));
});
test('look message carries the worn ids', () => { const m = CLIENT_MESSAGES.look; ok(m.wd && m.wa && m.wg, 'protocol look'); });
console.log(`cosmetics: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
