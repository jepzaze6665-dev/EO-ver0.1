// Class files: no top-level key written twice. In an object literal the later key silently wins, so a method named like
// a data field (e.g. `ink: {...}` and `ink(p, g) {}`) erases the data — this broke Shock and Void Ink once.
// Run:  node tools/tests/classKeys.test.mjs
import { readFileSync, readdirSync } from 'fs';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const DIR = new URL('../../src/skills/', import.meta.url);

console.log('class files');
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.js') && f !== 'classes.js')) {
  test(`${file}: no top-level key defined twice`, () => {
    const src = readFileSync(new URL(file, DIR), 'utf8').replace(/\r\n/g, '\n');
    const dup = [];
    let keys = null, name = '';
    for (const line of src.split('\n')) {
      const head = /^export const (\w+) = \{$/.exec(line); // every exported object (anim table, the class itself)
      if (head) { keys = new Map(); name = head[1]; continue; }
      if (!keys) continue;
      if (line.startsWith('};')) { for (const [k, n] of keys) if (n > 1) dup.push(`${name}.${k}`); keys = null; continue; }
      const m = /^ {2}([A-Za-z_$][\w$]*)\s*(?::|\()/.exec(line); // exactly 2 spaces = a key of that object
      if (m) keys.set(m[1], (keys.get(m[1]) || 0) + 1);
    }
    if (dup.length) throw new Error('defined twice: ' + dup.join(', '));
  });
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
