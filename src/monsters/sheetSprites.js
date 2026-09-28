import { makeCanvas, Assets } from '../core/assets.js';
import { MONSTER_ART } from '../data/monsterArt.js';

// Sprite sets cut from the owner's monster sheets (atlas: tools/build-monsters.js, frame choice: data/monsterArt.js).
// A set has the same fields as the canvas placeholder sets in monsterSprites.js — w, h, ax, ay (feet pivot) and
// idle / move / windup / attack / hurt frame lists — plus:
//   sheet: true · anims { name: [canvas] } (every anim of the entry) · fps { name } · attacks { id: { windup, attack } }
//   poses (boss pose map) · death
// Every frame is its own canvas so hit flashes (flashOf) and tints work per frame.

function cutFrames(img, meta, list) {
  return list.map(([x, y]) => {
    const c = makeCanvas(meta.fw, meta.fh);
    c.getContext('2d').drawImage(img, x, y, meta.fw, meta.fh, 0, 0, meta.fw, meta.fh);
    return c;
  });
}

// the corrupted look: same pixels, hue + saturation pulled to `rgb`, light kept (canvas 'color' blend)
function tint(frame, rgb) {
  const c = makeCanvas(frame.width, frame.height);
  const g = c.getContext('2d');
  g.drawImage(frame, 0, 0);
  g.globalCompositeOperation = 'color';
  g.fillStyle = `rgba(${rgb},0.75)`;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(frame, 0, 0);
  return c;
}

// anim spec -> frame positions from the atlas meta. A spec may also be a LIST of pieces joined in order
// ([['walk', [2]], ['idle', [2]]] = a 2-step walk from sheets that draw one pose per action)
function framesOf(meta, spec) {
  if (Array.isArray(spec) && Array.isArray(spec[0])) return spec.flatMap((s) => framesOf(meta, s) || []);
  const [row, idx] = Array.isArray(spec) ? spec : [spec, null];
  const all = meta.anims[row];
  if (!all) return null;
  return idx ? idx.map((i) => all[i]).filter(Boolean) : all;
}

export function buildSheetSet(art, meta, img, tintRgb = null) {
  const anims = {};
  for (const [name, spec] of Object.entries(art.anims)) {
    const pos = framesOf(meta, spec);
    if (!pos || !pos.length) continue;
    let fr = cutFrames(img, meta, pos);
    if (tintRgb) fr = fr.map((f) => tint(f, tintRgb));
    anims[name] = fr;
  }
  const idle = anims.idle || anims.move || Object.values(anims)[0];
  const attacks = {};
  for (const [id, a] of Object.entries(art.attacks || {})) {
    attacks[id] = {};
    for (const k of ['windup', 'attack']) if (a[k]) {
      let fr = cutFrames(img, meta, framesOf(meta, a[k]) || []);
      if (tintRgb) fr = fr.map((f) => tint(f, tintRgb));
      if (fr.length) attacks[id][k] = fr;
    }
  }
  return {
    sheet: true, w: meta.fw, h: meta.fh, ax: meta.ax, ay: meta.ay,
    idle, move: anims.move || idle, windup: anims.windup || idle, attack: anims.attack || anims.windup || idle,
    hurt: anims.hurt || idle, death: anims.death || null,
    anims, attacks, fps: { idle: 5, move: 8, ...(art.fps || {}) }, poses: art.poses || null,
  };
}

// -> { spriteKey: set } for every art entry whose atlas loaded (missing atlas = the placeholder stays)
export function buildSheetSprites(meta = Assets.data.monsters || {}) {
  const out = {};
  for (const art of Object.values(MONSTER_ART)) {
    const m = meta[art.sheet], img = Assets.images['monster_' + art.sheet];
    if (!m || !img) continue;
    const set = buildSheetSet(art, m, img);
    const cset = art.corrupt ? buildSheetSet(art, m, img, art.corrupt) : null;
    for (const key of art.replaces) {
      out[key] = set;
      if (cset) out[key + 'C'] = cset;
    }
  }
  return out;
}

// frame of a looping / one-shot anim at time t (seconds since it started)
export function frameAt(frames, t, fps, loop = true) {
  const i = Math.floor(Math.max(0, t) * fps);
  return frames[loop ? i % frames.length : Math.min(frames.length - 1, i)];
}
