// Map select data (src/data/worldMap.js). Run: node tools/tests/worldMap.test.mjs
import { readFileSync } from 'fs';
import { WORLD_MAP } from '../../src/data/worldMap.js';
import { ONLINE } from '../../src/data/online.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const monsters = JSON.parse(readFileSync(new URL('../../assets/monsters/monsters.json', import.meta.url)));

test('every dungeon area has a pin inside the map with a real boss portrait and a description', () => {
  for (const a of ONLINE.dungeon.areas) {
    const p = WORLD_MAP.pins[a.id];
    ok(p, 'no pin for ' + a.id);
    ok(p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100, a.id + ' pin outside the map');
    ok(monsters[p.boss] && monsters[p.boss].anims && monsters[p.boss].anims.idle, a.id + ': no atlas / idle for ' + p.boss);
    ok(p.desc && p.desc.length > 20, a.id + ' needs a description');
  }
});

test('roads A / B start at Lumina and end at Asteria', () => {
  const at = (id) => WORLD_MAP.cities.find((c) => c.id === id);
  for (const r of ['A', 'B']) {
    const road = WORLD_MAP.roads[r];
    ok(road[0][0] === at('lumina').x && road[0][1] === at('lumina').y, r + ' starts at Lumina');
    ok(road.at(-1)[0] === at('city2').x && road.at(-1)[1] === at('city2').y, r + ' ends at Asteria');
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
