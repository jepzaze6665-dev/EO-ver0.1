import { T, Z } from '../core/constants.js';

// ASHEN BADLANDS terrain (A2) — PLACEHOLDER layout (W1: proves the multi-grid world). Same size as the Whispering grid
// (168 × 208 tiles). The real A2 design (badlands tiles, lava, monsters, boss) replaces the look in W3; the route
// shape below is the skeleton it keeps:
//   Scorched Pass (south entry) -> Ember Canyon (main route, winding north) -> Magma Caldera (boss area, north)
//   side routes: Ash Flats (west, wide open) · Cinder Rift (east, broken ruins) · a hidden pocket slot (south-east)
// Existing tiles only (no new art yet): cliff walls, dirt / sand floor, ruin stone, arena stone.
export function buildAshenTerrain(b) {
  const m = b.m;
  b.rect(0, 0, m.w - 1, m.h - 1, T.CLIFF);
  b.zoneRect(0, 0, m.w - 1, m.h - 1, Z.BADLANDS);
  const S = (name, extra = {}) => m.addSubArea({ name, zone: Z.BADLANDS, ...extra });
  const A = { pass: S('Scorched Pass'), canyon: S('Ember Canyon'), flats: S('Ash Flats'), rift: S('Cinder Rift'), caldera: S('Magma Caldera'), pocket: S('Smouldering Hollow', { secret: 0 }) };
  const D = T.DIRT, SA = T.SAND;

  // main route (south -> north)
  const main = [[84, 203], [84, 192], [79, 176], [88, 158], [92, 140], [80, 122], [74, 104], [86, 86], [92, 68], [84, 50], [84, 34]];
  b.line(main, 8, D, { noise: 1.4 });
  b.line(main, 3, SA, { only: [D], noise: 0.6 });
  b.disc(84, 194, 9, D);                        // Scorched Pass (arrival)
  b.disc(80, 122, 11, D);                       // canyon combat basin 1
  b.disc(90, 68, 10, D);                        // canyon combat basin 2
  b.disc(84, 22, 15, T.ARENA, { noise: 0.6 });  // Magma Caldera (boss area)
  b.line([[84, 36], [84, 30]], 7, T.ARENA);
  // side routes
  b.line([[76, 116], [58, 118], [44, 122]], 6, D);
  b.ellipse(36, 124, 20, 15, SA, { noise: 2 });  // Ash Flats (wide, open ground)
  b.line([[92, 140], [112, 128], [128, 108], [132, 94]], 5, D);
  b.disc(134, 88, 12, T.RUIN, { noise: 1.2 });   // Cinder Rift (broken ruins)
  b.line([[124, 84], [104, 76], [92, 70]], 4, D); // rift rejoins the canyon (loop)
  // hidden pocket slot: narrow crack off the pass (content later: data/hidden.js)
  b.line([[90, 190], [118, 184], [136, 176]], 2, D, { noise: 0.3 });
  b.disc(140, 172, 6, SA);

  b.subDisc(84, 194, 11, A.pass);
  for (const [x, y] of main.slice(2, 9)) b.subDisc(x, y, 9, A.canyon);
  b.subDisc(80, 122, 12, A.canyon); b.subDisc(90, 68, 11, A.canyon);
  b.subDisc(36, 124, 21, A.flats);
  b.subDisc(134, 88, 13, A.rift);
  b.subDisc(84, 22, 17, A.caldera);
  b.subDisc(140, 172, 7, A.pocket);

  // ember glow (lava comes with the W3 tiles)
  for (const [x, y, r] of [[84, 22, 150], [70, 30, 90], [98, 30, 90], [80, 122, 80], [134, 88, 90], [36, 124, 70], [140, 172, 60]]) b.light(x, y, r, '#ff6a2a', { a: 0.45, flicker: true });
  b.regions.playerSpawn = { x: 84.5 * 32, y: 192 * 32 };
}
