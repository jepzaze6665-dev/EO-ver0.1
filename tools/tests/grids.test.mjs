// Multi-grid world (world/levels, world/mapManager.js). Run:  node tools/tests/grids.test.mjs
import { MAPS } from '../../src/maps/mapRegistry.js';
import { MapManager } from '../../src/world/mapManager.js';
import { LEVELS, START_GRID } from '../../src/world/levels/index.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

// tiny stand-in for WorldMap: w x h tiles, every tile in zone `z`
const fakeGrid = (w, h, z) => ({ w, h, zone: new Uint8Array(w * h).fill(z), inBounds: (x, y) => x >= 0 && y >= 0 && x < w && y < h, activeArea: 0 });

console.log('grids');
test('every level has a size and a terrain builder; the start grid exists', () => {
  ok(LEVELS[START_GRID], 'start grid');
  for (const L of Object.values(LEVELS)) ok(L.size && L.size[0] > 0 && L.size[1] > 0 && typeof L.generate === 'function', L.id);
});
test('every map names a grid that exists', () => {
  for (const d of MAPS) ok(d.grid && LEVELS[d.grid], `${d.id}: grid '${d.grid}'`);
});
test('field grids keep a similar physical scale (A1 / A2 / A3 principle: depth grows, not size)', () => {
  const areas = Object.values(LEVELS).map((L) => L.size[0] * L.size[1]);
  ok(Math.max(...areas) / Math.min(...areas) <= 1.5, 'sizes ' + areas.join(', '));
});
test('exits between grids exist both ways', () => {
  const byId = Object.fromEntries(MAPS.map((d) => [d.id, d]));
  for (const d of MAPS) for (const e of d.exits || []) {
    ok(byId[e.to], `${d.id}.${e.id} -> unknown ${e.to}`);
    if (byId[e.to].grid !== d.grid) ok(byId[e.to].exits.some((b) => b.to === d.id), `${d.id}.${e.id}: no way back from ${e.to}`);
  }
});
test('map lookup by position is per grid (same tile, different maps on different grids)', () => {
  const Z1 = 5, Z2 = 9;
  const maps = [
    { id: 'm1', grid: 'g1', region: { zones: [Z1] }, exits: [] },
    { id: 'm2', grid: 'g2', region: { zones: [Z2] }, exits: [] },
  ];
  const mm = new MapManager(maps);
  mm.attach('g1', fakeGrid(10, 10, Z1));
  mm.attach('g2', fakeGrid(12, 8, Z2));
  mm.use('g1');
  ok(mm.idAtTile(3, 3) === 'm1' && mm.idAtTile(3, 3, 'g2') === 'm2', 'per-grid ids');
  mm.use('g2');
  ok(mm.idAtTile(3, 3) === 'm2' && mm.gridId === 'g2' && mm.gridOf('m1') === 'g1', 'use / gridOf');
  ok(mm.idAtTile(11, 2) === 'm2' && mm.idAtTile(11, 2, 'g1') === null, 'bounds per grid');
  const b = mm.boundsPx('m2', 0);
  ok(b.x1 === 12 * 32 && b.y1 === 8 * 32, 'box of the map on its own grid');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
