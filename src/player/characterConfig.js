import { Assets } from '../core/assets.js';

// Character visual/physical standard. Every animation inherits these values; the sprite
// build step (tools/build-player.js) bakes the same canvas/pivot into atlas.json.
// Visual sprite, collision, hurtbox and attack hitboxes are separate things:
//  - collision: fixed feet circle at the root (never changes with animation)
//  - hurtbox:   same root circle (enemy strikes test against it)
//  - hitboxes:  come from skill/attack data (offset, radius/shape, direction, active time)
export const CHARACTER = {
  characterScale: 1,        // integer only — drawn 1:1 into the pixel scene
  spriteCanvas: [160, 160], // every frame (tools/build-player.js STD.canvas)
  pivot: [80, 140],         // x = centre, y = feet (ground line)
  bodyHeight: 60,           // neutral-pose body height the build normalises to
  collisionRadius: 7,       // ~14 x 10 px feet footprint
  hurtRadius: 9,
};

// Validates the loaded atlas against the standard (dev-mode report + console warnings).
export function validateSprites(preset = 'ub') {
  const atlas = Assets.data.atlases[preset];
  const rows = [];
  for (const [name, s] of Object.entries(atlas.sheets)) {
    const v = (atlas.validation || {})[name] || {};
    const issues = [...(v.issues || [])];
    if (s.fw !== CHARACTER.spriteCanvas[0] || s.fh !== CHARACTER.spriteCanvas[1]) issues.push('Canvas Size');
    if (s.ax !== CHARACTER.pivot[0] || s.ay !== CHARACTER.pivot[1]) issues.push('Pivot');
    rows.push({ name, ok: !issues.length, issues, bodyHeight: v.bodyHeight, feet: v.feetMaxOffset });
  }
  for (const r of rows) if (!r.ok) console.warn(`[SPRITE VALIDATION] ${r.name}: ${r.issues.join(', ')}`);
  return rows;
}
