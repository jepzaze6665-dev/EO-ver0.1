import { clamp, damp, rand } from '../core/math.js';

// Smooth top-down follow camera with bounds, zoom punch, trauma-based shake,
// aim look-ahead and an optional arena lock rectangle.
export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.viewW = 640; this.viewH = 360; // virtual (unzoomed) view size in world px
    this.zoom = 1; this.baseZoom = 1; this.zoomPunch = 0; this.targetZoom = 1;
    this.trauma = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.bounds = null; // {x0,y0,x1,y1} world px
    this.lock = null;   // arena lock rect (overrides bounds)
    this.focus = null;  // optional cinematic focus point {x,y,t}
    this.time = 0;
  }

  setView(w, h) { this.viewW = w; this.viewH = h; }

  snap(x, y) { this.x = x; this.y = y; this.clampToBounds(); }

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  // Pixel-art rule: zoom stays an exact 1x (integer scaling only). A 'punch' is delivered
  // as a short directional screen impulse instead of a fractional zoom.
  punch(amount) { this.trauma = Math.min(1, this.trauma + amount * 1.6); }

  // cinematic pan to a point for `dur` seconds
  lookAt(x, y, dur) { this.focus = { x, y, t: dur }; }

  update(dt, target, aim) {
    this.time += dt;
    let tx = target.x, ty = target.y - 8;
    if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) { // a bad mouse value must never poison the camera
      tx += clamp((aim.x - target.x) * 0.12, -48, 48);
      ty += clamp((aim.y - target.y) * 0.12, -32, 32);
    }
    if (this.focus) {
      tx = this.focus.x; ty = this.focus.y;
      this.focus.t -= dt;
      if (this.focus.t <= 0) this.focus = null;
    }
    const speed = this.focus ? 3 : 9;
    this.x = damp(this.x, tx, speed, dt);
    this.y = damp(this.y, ty, speed, dt);

    this.zoom = 1;

    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma;
    this.shakeX = Math.round(s * 14 * rand(-1, 1)); // whole pixels only
    this.shakeY = Math.round(s * 14 * rand(-1, 1));
    this.clampToBounds();
  }

  clampToBounds() {
    const b = this.lock || this.bounds;
    if (!b) return;
    const hw = this.viewW / 2 / this.zoom, hh = this.viewH / 2 / this.zoom;
    if (b.x1 - b.x0 < hw * 2) this.x = (b.x0 + b.x1) / 2;
    else this.x = clamp(this.x, b.x0 + hw, b.x1 - hw);
    if (b.y1 - b.y0 < hh * 2) this.y = (b.y0 + b.y1) / 2;
    else this.y = clamp(this.y, b.y0 + hh, b.y1 - hh);
  }

  // top-left world coordinate of the visible area (including shake)
  get left() { return this.x - this.viewW / 2 / this.zoom + this.shakeX; }
  get top() { return this.y - this.viewH / 2 / this.zoom + this.shakeY; }
  get width() { return this.viewW / this.zoom; }
  get height() { return this.viewH / this.zoom; }

  // view-space (virtual pixel) <-> world
  toWorld(vx, vy) {
    return { x: this.left + vx / this.zoom, y: this.top + vy / this.zoom };
  }
  toView(wx, wy) {
    return { x: (wx - this.left) * this.zoom, y: (wy - this.top) * this.zoom };
  }
  visible(x, y, margin = 64) {
    return x > this.left - margin && x < this.left + this.width + margin && y > this.top - margin && y < this.top + this.height + margin;
  }
}
