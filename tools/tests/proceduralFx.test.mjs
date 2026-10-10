// Procedural VFX (src/vfx/proceduralFx.js) + presets (src/data/fxPresets.js).  Run:  node tools/tests/proceduralFx.test.mjs
import { FX_DEFAULTS, FX_SHAPES, renderFx, bakeStrip, heartbeat, noise2 } from '../../src/vfx/proceduralFx.js';
import { FX_PRESETS } from '../../src/data/fxPresets.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const opaque = (img) => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0) n++; return n; };

test('noise is deterministic and in 0..1', () => {
  ok(noise2(1.3, 2.7, 4) === noise2(1.3, 2.7, 4), 'same input, same value');
  for (let i = 0; i < 200; i++) { const v = noise2(i * 0.37, i * 0.91, 1); ok(v >= 0 && v <= 1, 'range ' + v); }
});
test('every shape draws something, nothing outside the canvas', () => {
  for (const shape of FX_SHAPES) { const img = renderFx({ shape, size: 48 }, 0.3); ok(img.data.length === 48 * 48 * 4, shape); ok(opaque(img) > 50, shape + ' empty'); }
});
test('orb: back + front layers both exist; both = composite', () => {
  const b = renderFx({ size: 48 }, 0, 'back'), f = renderFx({ size: 48 }, 0, 'front'), all = renderFx({ size: 48 }, 0, 'both');
  ok(opaque(b) > 50 && opaque(f) > 50, 'layers'); ok(opaque(all) >= Math.max(opaque(b), opaque(f)), 'composite');
});
test('dissolve: more hole = fewer pixels', () => {
  ok(opaque(renderFx({ size: 48, hole: 0.6 })) < opaque(renderFx({ size: 48, hole: 0 })), 'holes');
});
test('animation changes the picture', () => {
  const a = renderFx({ size: 32 }, 0), b = renderFx({ size: 32 }, 0.5);
  ok(a.data.some((v, i) => v !== b.data[i]), 'static');
});
test('heartbeat 0..1 with a rest', () => { let mx = 0, mn = 1; for (let x = 0; x < 1; x += 0.01) { const v = heartbeat(x); mx = Math.max(mx, v); mn = Math.min(mn, v); } ok(mx > 0.9 && mn === 0, mx + ' ' + mn); });
test('strip = frames side by side', () => { const s = bakeStrip({ size: 24, frames: 5 }); ok(s.w === 120 && s.h === 24 && s.data.length === 120 * 24 * 4, 'size'); });
test('presets only use known fields + render', () => {
  for (const [id, p] of Object.entries(FX_PRESETS)) {
    for (const k in p) ok(k in FX_DEFAULTS, `${id}.${k} unknown`);
    ok(!p.shape || FX_SHAPES.includes(p.shape), id + ' shape');
    ok(opaque(renderFx({ ...p, size: 32 }, 0.2)) > 20, id + ' empty');
  }
});
console.log(`proceduralFx: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
