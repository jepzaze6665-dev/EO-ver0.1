// Sound files -> the game.  node tools/build-audio.js [--list]
// Reads desgin/SOUND/{sfx,music,amb}/ (mp3 / ogg / wav / m4a), copies them to assets/audio/<kind>/ and writes
// assets/audio/audio.json = { sfx: { name: [files] }, music: { track: [file] }, amb: { name: [file] }, loops }.
// Variants: hit_1.mp3, hit_2.mp3 ... -> sfx 'hit' with 2 files (one picked at random each play).
// Loop points (optional): desgin/SOUND/loops.json = { "music/lumina.mp3": [startSec, endSec] }.
// --list = print every name the game can use and whether it has a file yet.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'desgin', 'SOUND');
const OUT = path.join(ROOT, 'assets', 'audio');
const EXT = /\.(mp3|ogg|wav|m4a)$/i;
const KINDS = ['sfx', 'music', 'amb'];

// every sfx name the code calls (audio.sfx('name' ...)) + the synth list in audio.js
function knownSfx() {
  const names = new Set();
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js')) {
      const t = fs.readFileSync(p, 'utf8');
      for (const m of t.matchAll(/sfx\(\s*'([a-z0-9_]+)'/g)) names.add(m[1]);
      for (const m of t.matchAll(/case '([a-z0-9_]+)':/g)) if (p.endsWith('audio.js')) names.add(m[1]);
    } } };
  walk(path.join(ROOT, 'src'));
  return names;
}

function scan(kind) {
  const dir = path.join(SRC, kind), out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!EXT.test(f)) continue;
    const base = f.replace(EXT, '').toLowerCase().replace(/[\s-]+/g, '_');
    const name = kind === 'sfx' ? base.replace(/_\d+$/, '') : base;
    (out[name] = out[name] || []).push({ src: path.join(dir, f), file: `${kind}/${base}${path.extname(f).toLowerCase()}` });
  }
  return out;
}

function main() {
  const list = process.argv.includes('--list');
  const manifest = { sfx: {}, music: {}, amb: {}, loops: {} };
  let copied = 0;
  for (const kind of KINDS) {
    const found = scan(kind);
    for (const [name, files] of Object.entries(found)) {
      manifest[kind][name] = files.map((x) => x.file);
      for (const x of files) {
        const dst = path.join(OUT, x.file);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(x.src, dst); copied++;
      }
    }
  }
  const loopsFile = path.join(SRC, 'loops.json');
  if (fs.existsSync(loopsFile)) {
    const loops = JSON.parse(fs.readFileSync(loopsFile, 'utf8'));
    for (const [k, v] of Object.entries(loops)) if (Array.isArray(v) && v.length === 2 && v[1] > v[0]) manifest.loops[k.toLowerCase()] = v;
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'audio.json'), JSON.stringify(manifest, null, 1));

  const known = knownSfx();
  const unknown = Object.keys(manifest.sfx).filter((n) => !known.has(n));
  console.log(`audio: ${copied} file(s) — sfx ${Object.keys(manifest.sfx).length}, music ${Object.keys(manifest.music).length}, ambience ${Object.keys(manifest.amb).length}`);
  if (unknown.length) console.log('  ! sfx names the game never plays (typo?):', unknown.join(', '));
  if (list) {
    const all = [...known].sort();
    console.log(`\nsfx (${all.filter((n) => manifest.sfx[n]).length}/${all.length} have files):`);
    for (const n of all) console.log(`  ${manifest.sfx[n] ? '✓' : '·'} ${n}${manifest.sfx[n] ? '  (' + manifest.sfx[n].length + ')' : ''}`);
  }
}
main();
