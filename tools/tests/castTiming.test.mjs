// Cast timing: for every class whose animations name their RELEASE / impact columns (anims[x].hit), every event of its
// basic attacks and skills must fire while one of those columns is on screen — the bolt leaves the staff when the
// character throws it, not a pose earlier. (Frame shown at time t = cols[floor(t / dur × cols.length)], playerSprites.)
// Run:  node tools/tests/castTiming.test.mjs
import { CLASSES } from '../../src/skills/classes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };

// a do-nothing world: any property is a callable stub (cast() only builds the action timeline here)
const stub = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : stub), apply: () => stub });
const mkPlayer = (cls) => new Proxy({ cls, x: 0, y: 0, facing: 0, stats: {}, castMods: null, skillValue: (id, k, d) => d, skillFlag: () => false }, {
  get: (o, k) => (k in o ? o[k] : stub),
});

for (const cls of Object.values(CLASSES)) {
  if (!Object.values(cls.anims || {}).some((a) => a.hit)) continue;
  test(`${cls.id}: every basic / skill event fires on its animation's release column`, () => {
    const p = mkPlayer(cls), g = stub, bad = [];
    const acts = [0, 1, 2].map((k) => cls.basic(p, g, 0, k));
    for (const s of [...cls.skills, cls.special].filter(Boolean)) { try { acts.push(s.cast(p, g, 0)); } catch (e) { /* a cast needing real world data is skipped */ } }
    let checked = 0;
    for (const a of acts) {
      const an = a && cls.anims[a.anim];
      if (!an || !an.hit || !a.events) continue;
      for (const [t] of a.events) {
        const col = an.cols[Math.min(an.cols.length - 1, Math.floor((t / a.dur) * an.cols.length))];
        checked++;
        if (!an.hit.includes(col)) bad.push(`${a.name} @${t}s shows col ${col} (release ${an.hit})`);
      }
    }
    if (checked < 6) throw new Error('only ' + checked + ' events checked');
    if (bad.length) throw new Error(bad.join('; '));
  });
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
