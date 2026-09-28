// UI kit (tools/build-ui.js -> assets/ui). Run:  node tools/tests/ui.test.mjs
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const png = require('../png.js');

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ROOT = new URL('../../', import.meta.url);
const atlas = JSON.parse(readFileSync(new URL('assets/ui/ui.json', ROOT)));
const img = (name) => png.read(new URL(atlas[name].file, ROOT));
const alphaAt = (im, fx, fy) => im.data[(Math.floor(fy * (im.height - 1)) * im.width + Math.floor(fx * (im.width - 1))) * 4 + 3];

console.log('ui kit');
test('every piece named by the game exists with a real file', () => {
  const need = ['slot_normal', 'slot_hover', 'slot_pressed', 'slot_disabled', 'slot_cooldown', 'btn_normal', 'btn_hover', 'btn_selected', 'btn_disabled', 'panel_frame', 'ring_frame', 'boss_bar', 'emblem'];
  for (const n of need) { ok(atlas[n], 'missing ' + n); ok(existsSync(new URL(atlas[n].file, ROOT)), 'no file ' + atlas[n].file); }
});
test('sizes in ui.json match the files', () => {
  for (const [n, a] of Object.entries(atlas)) { const im = img(n); ok(im.width === a.w && im.height === a.h, `${n} ${im.width}x${im.height} vs ${a.w}x${a.h}`); }
});
test('background removed: corners of every piece are transparent', () => {
  for (const n of ['slot_normal', 'btn_normal', 'ring_frame', 'boss_bar', 'emblem']) { const im = img(n); ok(alphaAt(im, 0, 0) < 40 && alphaAt(im, 1, 1) < 40, `${n} corner alpha ${alphaAt(im, 0, 0)}`); }
});
test('frames are see-through in the middle (skill slot, ring); panels / buttons stay filled', () => {
  ok(alphaAt(img('slot_normal'), 0.5, 0.5) < 40, 'slot middle'); ok(alphaAt(img('ring_frame'), 0.5, 0.5) < 40, 'ring middle');
  ok(alphaAt(img('panel_frame'), 0.5, 0.5) > 200, 'panel filled'); ok(alphaAt(img('btn_normal'), 0.5, 0.5) > 200, 'button filled');
});
test('stretchable frames carry a 9-slice border', () => {
  for (const n of ['panel_frame', 'btn_normal']) ok(atlas[n].slice > 0 && atlas[n].slice * 2 < Math.min(atlas[n].w, atlas[n].h), n);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
