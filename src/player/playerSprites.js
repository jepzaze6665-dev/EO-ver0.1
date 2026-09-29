import { Assets, makeCanvas } from '../core/assets.js';

// Wraps one class preset's sheets (atlas from tools/build-player.js) + that class's animation table.
// Sheet layout: 6 columns; each 4-row group = [down, up, side, side]. Which side row faces right/left
// (or needs mirroring) is detected at build time and stored in atlas.json "sides".
// To swap in new art, export sheets with the same grid + anchor and update atlas.json.

// animation name -> sheet + column sequence (Umbral Sword table; other classes pass their own)
//   side: { sheet?, cols?, fps? } — used instead for the left / right views (dir 2 / 3), for AI sheets whose side rows
//   draw the head and the blow facing different ways (the character seemed to spin mid-attack)
export const ANIMS = {
  idle: { sheet: 'walk', cols: [0] },
  walk: { sheet: 'walk', cols: [1, 2, 3, 4, 5], fps: 10, loop: true },
  run: { sheet: 'run', cols: [1, 2, 3, 4, 5], fps: 13, loop: true },
  atk1: { sheet: 'atk1', cols: [1, 2, 3, 4, 5] },
  atk2: { sheet: 'atk2', cols: [1, 2, 3, 4, 5] },
  atk3: { sheet: 'vfx', cols: [1, 2, 3, 4, 5], rowOffset: 0 },
  dodge: { sheet: 'vfx', cols: [1, 2, 3, 4], rowOffset: 4 },
  shadowSlash: { sheet: 'sk1', cols: [1, 2, 3, 4, 5] },
  shadeStep: { sheet: 'sk2', cols: [1, 2, 3, 4] },
  twinFang: { sheet: 'sk3', cols: [1, 2, 3, 4, 5] },
  aura: { sheet: 'sk4', cols: [1, 2, 3, 4, 5] },
  shadowArc: { sheet: 'sk5', cols: [1, 2, 3, 4, 5] },
  shadowBreak: { sheet: 'sk6', cols: [1, 2, 3, 3, 4] }, // sk6 has 5 source frames (explosion held)
  eclipse: { sheet: 'ult', cols: [1, 2, 3, 3, 4, 4, 5] },
  counter: { sheet: 'pr', cols: [1, 2, 3, 4, 5] },
  guard: { sheet: 'guard', cols: [1, 2, 3, 4, 5] },
  hurt: { sheet: 'hit', cols: [1, 2, 3] },
  death: { sheet: 'hit', cols: [1, 2, 3, 3] },
};

export class PlayerSprites {
  constructor(preset = 'ub', anims = ANIMS, ghostColor = '#8a3aff') {
    const atlas = Assets.data.atlases[preset];
    if (!atlas) throw new Error(`Unknown character preset "${preset}"`);
    this.preset = preset;
    this.anims = anims;
    this.sheets = {};
    for (const [name, s] of Object.entries(atlas.sheets)) {
      const img = Assets.images[`player_${preset}_${name}`];
      this.sheets[name] = { ...s, img, flash: tint(img, '#ffffff'), ghost: tint(img, ghostColor) };
    }
    // every animation must point at a sheet that exists (catches typos at load, not mid-fight)
    for (const [k, a] of Object.entries(anims)) for (const sh of [a.sheet, a.side && a.side.sheet]) if (sh && !this.sheets[sh]) throw new Error(`Animation "${k}" uses missing sheet "${sh}" (${preset})`);
  }

  // returns a drawable frame descriptor
  frame(animName, t, dir, variant = 'img') {
    const a0 = this.anims[animName] || this.anims.idle;
    const a = dir >= 2 && a0.side ? { ...a0, ...a0.side } : a0;
    const s = this.sheets[a.sheet];
    let idx;
    if (a.fps) idx = Math.floor(t * a.fps) % a.cols.length;
    else idx = Math.min(a.cols.length - 1, Math.floor(t * a.cols.length)); // t is 0..1 progress
    const col = a.cols[idx];
    const base = a.rowOffset || 0;
    const side = s.sides ? s.sides[base / 4] : { right: base + 2, left: base + 3 };
    let row = base + dir, flip = false;
    if (dir === 2) { row = side.right; flip = !!side.flipRight; }
    if (dir === 3) { row = side.left; flip = !!side.flipLeft; }
    return { img: s[variant], sx: col * s.fw, sy: row * s.fh, sw: s.fw, sh: s.fh, ax: s.ax, ay: s.ay, flip };
  }

  draw(ctx, f, x, y, alpha = 1) {
    if (alpha !== 1) ctx.globalAlpha = alpha;
    if (f.flip) {
      ctx.save();
      ctx.translate(Math.round(x), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, -f.ax, Math.round(y - f.ay), f.sw, f.sh);
      ctx.restore();
    } else ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, Math.round(x - f.ax), Math.round(y - f.ay), f.sw, f.sh);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }
}

function tint(img, color) {
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
