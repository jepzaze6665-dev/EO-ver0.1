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
  const need = ['slot_normal', 'slot_hover', 'slot_pressed', 'slot_disabled', 'bar_frame', 'crystal', 'plate', 'frame', 'frame_corner_tl', 'frame_corner_tr', 'frame_corner_bl', 'frame_corner_br', 'frame_edge_top', 'frame_edge_bottom', 'frame_edge_left', 'frame_edge_right'];
  for (const n of need) { ok(atlas[n], 'missing ' + n); ok(existsSync(new URL(atlas[n].file, ROOT)), 'no file ' + atlas[n].file); }
});
test('sizes in ui.json match the files', () => {
  for (const [n, a] of Object.entries(atlas)) { const im = img(n); ok(im.width === a.w && im.height === a.h, `${n} ${im.width}x${im.height} vs ${a.w}x${a.h}`); }
});
test('background removed: corners of every piece are transparent', () => {
  for (const n of ['plate', 'frame', 'frame_corner_tl', 'frame_edge_top', 'slot_normal', 'bar_frame', 'crystal']) { const im = img(n); ok(alphaAt(im, 0, 0) < 40 && alphaAt(im, 1, 1) < 40, `${n} corner alpha ${alphaAt(im, 0, 0)}`); }
});
test('the window frame is see-through in the middle; the plate stays filled', () => {
  ok(alphaAt(img('frame'), 0.5, 0.5) < 40, 'frame middle'); ok(alphaAt(img('plate'), 0.5, 0.5) > 200, 'plate filled');
  ok(alphaAt(img('slot_normal'), 0.5, 0.5) < 40, 'slot middle'); ok(alphaAt(img('bar_frame'), 0.5, 0.5) < 40, 'bar slot');
});
test('old painterly kit is gone (the owner replaced it with the pixel-art kit)', () => {
  for (const n of ['btn_normal', 'panel_frame', 'ring_frame', 'boss_bar', 'emblem', 'slot_cooldown']) ok(!atlas[n], n + ' still listed');
});
test('slot states are generated from one art: same size, grey is grey, hover is brighter', () => {
  const n = img('slot_normal'), gr = img('slot_disabled'), hv = img('slot_hover');
  ok(gr.width === n.width && hv.height === n.height, 'sizes');
  let sat = 0, lumN = 0, lumH = 0;
  for (let i = 0; i < n.data.length; i += 4) if (n.data[i + 3] > 200) { sat += Math.abs(gr.data[i] - gr.data[i + 2]); lumN += n.data[i] + n.data[i + 2]; lumH += hv.data[i] + hv.data[i + 2]; }
  ok(lumH > lumN && sat / (n.width * n.height) < 5, `hover ${lumH} > ${lumN}, grey tint ${(sat / (n.width * n.height)).toFixed(2)}`);
});
test('stretchable frames carry a 9-slice border', () => {
  for (const n of ['frame', 'plate']) ok(atlas[n].slice > 0 && atlas[n].slice * 2 < Math.min(atlas[n].w, atlas[n].h), n);
  ok(atlas.bar_frame.slice > 0 && atlas.bar_frame.slice * 2 < atlas.bar_frame.w, 'bar_frame: horizontal end caps');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
