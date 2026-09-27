// Every source file must parse as an ES module (catches typos in files the other tests never import,
// e.g. a stray quote in item data). Run:  node tools/tests/syntax.test.mjs
import { readdirSync, readFileSync, statSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (n.endsWith('.js')) files.push(p); } };
walk(join(root, 'src'));
walk(join(root, 'tools')); // browser tools are ES modules too (the node build scripts are CommonJS and checked as such)

let pass = 0, fail = 0;
console.log('syntax');
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const isCjs = /require\(/.test(src) && !/^\s*(import|export)\s/m.test(src);
  const r = spawnSync(process.execPath, isCjs ? ['--check', f] : ['--input-type=module', '--check'], { input: isCjs ? undefined : src, encoding: 'utf8' });
  if (r.status === 0) pass++;
  else { fail++; console.log('  ✗', relative(root, f), '\n     ', (r.stderr || '').split('\n').slice(0, 4).join('\n      ')); }
}
console.log(`  ✓ ${pass} files parse`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
