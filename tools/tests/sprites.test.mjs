// Sprite / animation integrity for every class preset. Run:  node tools/tests/sprites.test.mjs
// Catches "the character disappears for a frame": an animation that points at a frame with no
// character body (tools/build-player.js records those in atlas.json -> emptyFrames).
import { readFileSync } from 'fs';
import { CLASSES } from '../../src/skills/classes.js';
import { PLAYER_PRESETS } from '../../src/core/assets.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

console.log('sprites');
for (const cls of Object.values(CLASSES)) {
  const atlas = JSON.parse(readFileSync(new URL('../../' + PLAYER_PRESETS[cls.preset], import.meta.url), 'utf8'));
  test(`${cls.name}: every animation uses existing, non-empty frames in all 4 directions`, () => {
    const bad = [];
    for (const [anim, a] of Object.entries(cls.anims)) {
      const s = atlas.sheets[a.sheet];
      ok(s, `animation "${anim}" -> missing sheet "${a.sheet}"`);
      const empty = new Set((s.emptyFrames || []).map(([r, c]) => r + ',' + c));
      const base = a.rowOffset || 0;
      for (const col of a.cols) {
        ok(col >= 0 && col < s.cols, `animation "${anim}" -> column ${col} out of range`);
        for (let r = base; r < base + 4; r++) if (empty.has(r + ',' + col)) bad.push(`${anim}[row ${r}, col ${col}]`);
      }
    }
    ok(!bad.length, 'empty frames used: ' + bad.join(', '));
  });
  test(`${cls.name}: every sheet passes the visual standard (scale / ground / pivot)`, () => {
    const bad = Object.entries(atlas.validation).filter(([, v]) => !v.ok).map(([k, v]) => `${k}: ${v.issues.join('/')}`);
    ok(!bad.length, bad.join('; '));
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
