// Runs every *.test.mjs in this folder.  node tools/tests/run.mjs
import { readdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
let failed = 0;
for (const f of readdirSync(dir).filter((n) => n.endsWith('.test.mjs'))) {
  const r = spawnSync(process.execPath, [join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} test file(s) FAILED` : '\nALL TEST FILES PASSED');
process.exit(failed ? 1 : 0);
