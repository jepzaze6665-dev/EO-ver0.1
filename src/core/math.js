export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax, ay, bx, by) => (bx - ax) ** 2 + (by - ay) ** 2;
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
export const angleDiff = (a, b) => Math.abs(wrapAngle(a - b));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInCubic = (t) => t * t * t;
export const easeOutBack = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
// frame-rate independent exponential approach
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

// Direction index for 4-directional sprites: 0 down, 1 up, 2 right, 3 left
export function dir4(angle) {
  const a = wrapAngle(angle);
  if (a > -Math.PI * 0.25 && a <= Math.PI * 0.25) return 2;
  if (a > Math.PI * 0.25 && a <= Math.PI * 0.75) return 0;
  if (a > -Math.PI * 0.75 && a <= -Math.PI * 0.25) return 1;
  return 3;
}

// point inside a cone (sector) centred at (cx,cy) facing `ang` with half-width `half`
export function inCone(px, py, pr, cx, cy, r, ang, half) {
  const d = Math.hypot(px - cx, py - cy);
  if (d > r + pr) return false;
  if (d < pr + 4) return true;
  const a = Math.atan2(py - cy, px - cx);
  const slack = Math.asin(Math.min(1, pr / Math.max(d, 1)));
  return angleDiff(a, ang) <= half + slack;
}

// circle vs oriented rectangle (line attack): origin, angle, length, half-width
export function inLine(px, py, pr, ox, oy, ang, len, halfW) {
  const dx = px - ox, dy = py - oy;
  const c = Math.cos(ang), s = Math.sin(ang);
  const along = dx * c + dy * s;
  const side = -dx * s + dy * c;
  return along > -pr && along < len + pr && Math.abs(side) < halfW + pr;
}

export function circleHit(ax, ay, ar, bx, by, br) {
  return (ax - bx) ** 2 + (ay - by) ** 2 < (ar + br) ** 2;
}

export function formatNum(n) {
  return Math.round(n).toLocaleString('en-US');
}
