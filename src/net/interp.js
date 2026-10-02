// ONLINE — where to draw something that only arrives as snapshots ({ t, x, y }, t in seconds of performance.now()).
// Drawn ONLINE.puppetDelay in the past, between the two snapshots around that moment. If the next snapshot is late, it
// keeps moving the way it was going for at most `maxExtra` s (extrapolation), then holds the last known spot — so a
// late packet does not freeze a charging boss, and a stopped one never drifts far.
export function sampleSnaps(s, t, maxExtra = 0.1) {
  if (!s || !s.length) return null;
  const last = s[s.length - 1];
  if (t >= last.t) {
    const late = t - last.t;
    if (s.length < 2 || late > maxExtra * 1.5) return { x: last.x, y: last.y };
    const p = s[s.length - 2], dt = Math.max(1e-3, last.t - p.t), e = Math.min(late, maxExtra);
    return { x: last.x + ((last.x - p.x) / dt) * e, y: last.y + ((last.y - p.y) / dt) * e };
  }
  if (t <= s[0].t) return { x: s[0].x, y: s[0].y };
  for (let i = s.length - 1; i > 0; i--) {
    const a = s[i - 1], b = s[i];
    if (t >= a.t) { const f = Math.min(1, (t - a.t) / Math.max(1e-3, b.t - a.t)); return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; }
  }
  return { x: last.x, y: last.y };
}
