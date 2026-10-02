// Skill tree view layout (src/ui/skillTreeUI.js layoutTree, pure). Run: node tools/tests/skillTreeUI.test.mjs
import { layoutTree } from '../../src/ui/skillTreeUI.js';
import { CLASSES } from '../../src/skills/classes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

test('every class: one node per skill + special, special at the bottom, ultimate on top, no two nodes on one spot', () => {
  for (const [id, c] of Object.entries(CLASSES)) {
    const L = layoutTree(c), want = c.skills.length + (c.special ? 1 : 0);
    ok(L.nodes.length === want, `${id}: ${L.nodes.length} nodes, want ${want}`);
    const ult = L.nodes.find((n) => n.kind === 'ultimate'), sp = L.nodes.find((n) => n.kind === 'special');
    if (sp) ok(L.nodes.every((n) => n.y >= sp.y), id + ': special must be lowest');
    if (ult) ok(L.nodes.every((n) => n.y <= ult.y), id + ': ultimate must be highest');
    const spots = new Set(L.nodes.map((n) => n.x + ':' + n.y));
    ok(spots.size === L.nodes.length, id + ': two nodes overlap');
    const ids = new Set(L.nodes.map((n) => n.id));
    ok(L.edges.every(([a, b]) => ids.has(a) && ids.has(b)), id + ': edge to a missing node');
  }
});

test('Umbral: a skill sits above the skill it requires (Twin Fang over Shadow Slash, Shadow Arc over Twin Fang)', () => {
  const L = layoutTree(CLASSES.umbral_sword), n = Object.fromEntries(L.nodes.map((x) => [x.id, x]));
  ok(n.twin_fang.y > n.shadow_slash.y && n.shadow_arc.y > n.twin_fang.y, 'rows follow requires');
  ok(L.edges.some(([a, b]) => a === 'shadow_slash' && b === 'twin_fang'), 'edge slash -> twin fang');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
