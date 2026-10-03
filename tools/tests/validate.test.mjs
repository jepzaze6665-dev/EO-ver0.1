// DATA VALIDATOR (tools/validate.mjs): the real data is clean, and a broken reference is caught.
import assert from 'assert';
import { validate } from '../validate.mjs';
import { LOOT_TABLES } from '../../src/data/lootTables.js';
import { MAPS } from '../../src/maps/mapRegistry.js';

assert.deepStrictEqual(validate(), [], 'game data has no broken references');
LOOT_TABLES._t = { gold: [0, 0], drops: [{ item: 'no_such_item', chance: 1 }] };
MAPS[0].exits.push({ id: '_x', to: 'no_such_map' });
const p = validate();
assert.ok(p.some((l) => l.includes("no_such_item")), 'bad loot item caught');
assert.ok(p.some((l) => l.includes("no_such_map")), 'bad exit caught');
console.log('validate.test: 3 passed');
