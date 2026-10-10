// F3 glow layer (src/vfx/glowLayer.js): mask picks bright saturated pixels in the hue range; pulse in range.
// Run:  node tools/tests/glowLayer.test.mjs
import { glowMask, glowAlpha } from '../../src/vfx/glowLayer.js';
let pass = 0, fail = 0;
const test = (n, fn) => { try { fn(); pass++; console.log('  ✓', n); } catch (e) { fail++; console.log('  ✗', n, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const px = (...c) => new Uint8ClampedArray(c.flat());
test('bright purple lit, dark / grey / transparent not', () => {
  const d = px([200, 80, 255, 255], [40, 20, 60, 255], [200, 200, 200, 255], [200, 80, 255, 0]);
  const m = glowMask(d, { minLum: 0.4 });
  ok(m.lit === 1 && m.data[3] === 255 && m.data[7] === 0 && m.data[11] === 0 && m.data[15] === 0, JSON.stringify([...m.data]));
});
test('hue range filters colours', () => {
  const d = px([255, 60, 60, 255], [60, 120, 255, 255]);
  ok(glowMask(d, { minLum: 0.4, hue: [330, 30] }).lit === 1, 'red only');
  ok(glowMask(d, { minLum: 0.4, hue: [200, 250] }).lit === 1, 'blue only');
});
test('tint colours the glow', () => { const m = glowMask(px([255, 60, 60, 255]), { minLum: 0.4, tint: '#00ff00' }); ok(m.data[1] === 255 && m.data[0] === 0, 'tint'); });
test('pulse alpha stays 0..2 and changes over time', () => {
  const v = []; for (let t = 0; t < 1; t += 0.02) v.push(glowAlpha({ pulse: 1 }, t));
  ok(Math.min(...v) >= 0 && Math.max(...v) <= 2 && Math.max(...v) - Math.min(...v) > 0.5, v.join());
});
console.log(`glowLayer: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
