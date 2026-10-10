// Map select data (src/data/worldMap.js). Run: node tools/tests/worldMap.test.mjs
import { readFileSync, existsSync } from 'fs';
import { WORLD_MAP, AREA_DROPS } from '../../src/data/worldMap.js';
import { MONSTERS } from '../../src/monsters/monsterTypes.js';
import { BOSSES } from '../../src/data/bosses.js';
import { LOOT_TABLES } from '../../src/data/lootTables.js';
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

test('the painted map exists when WORLD_MAP.image names it', () => {
  if (WORLD_MAP.image) ok(existsSync(new URL('../../' + WORLD_MAP.image, import.meta.url)), 'missing ' + WORLD_MAP.image);
});

test('AREA_DROPS: every dungeon area lists real monsters / mini-bosses with loot tables', () => {
  for (const a of ONLINE.dungeon.areas.map((x) => x.id || x)) {
    const d = AREA_DROPS[a];
    if (!d) throw new Error('no AREA_DROPS for ' + a);
    for (const m of d.monsters) if (!MONSTERS[m] || !LOOT_TABLES[MONSTERS[m].loot]) throw new Error(`${a}: monster ${m}`);
    for (const b of d.minis) if (!BOSSES[b] || !LOOT_TABLES[BOSSES[b].rewards.loot]) throw new Error(`${a}: mini ${b}`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
