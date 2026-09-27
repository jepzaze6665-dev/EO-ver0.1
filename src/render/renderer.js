import { makeCanvas } from '../core/assets.js';
import { Z, TILE } from '../core/constants.js';
import { TAU, clamp, lerp, dir4 } from '../core/math.js';
import { vnoise } from '../core/rng.js';
import { drawSpecialProp } from './specialProps.js';
import { drawInteractable, isAvailable } from '../exploration/interactables.js';
import { MARKS } from '../data/marks.js';

// Two-canvas pipeline:
//  scene  — low-res pixel canvas (world, entities, VFX, lighting, fog) upscaled with nearest-neighbour
//  screen — full-res canvas for the HUD and crisp text
// Update and render are decoupled: the game runs a fixed 60Hz simulation, render runs per rAF.
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scene = makeCanvas(640, 360);
    this.sctx = this.scene.getContext('2d');
    this.light = makeCanvas(640, 360);
    this.lctx = this.light.getContext('2d');
    this.scale = 2;
    this.propBuf = [];
    this.drawList = [];
    this.glowCache = new Map();
    this.fogTex = this.makeFog();
    this.ambient = { r: 20, g: 12, b: 40, a: 0.4 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // never 0: a hidden / minimised window reports 0x0 and drawImage() throws on empty canvases
    const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
    this.canvas.width = Math.floor(W * dpr);
    this.canvas.height = Math.floor(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    this.dpr = dpr;
    // integer pixel scale giving a virtual height of ~340-450 px
    this.scale = Math.max(1, Math.round((H * dpr) / 400));
    const vw = Math.max(1, Math.ceil(this.canvas.width / this.scale)), vh = Math.max(1, Math.ceil(this.canvas.height / this.scale));
    this.scene.width = vw; this.scene.height = vh;
    this.light.width = vw; this.light.height = vh;
    this.sctx.imageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;
    this.vw = vw; this.vh = vh;
    if (this.onResize) this.onResize(vw, vh);
  }

  makeFog() {
    const s = 256, c = makeCanvas(s, s), g = c.getContext('2d');
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      // tileable fbm
      let v = 0, amp = 0.5, f = 1 / 32;
      for (let o = 0; o < 4; o++) {
        const nx = x * f, ny = y * f, p = s * f;
        const a = vnoise(nx, ny, o), b = vnoise(nx - p, ny, o), c2 = vnoise(nx, ny - p, o), d = vnoise(nx - p, ny - p, o);
        const u = x / s, w = y / s;
        v += amp * (a * (1 - u) * (1 - w) + b * u * (1 - w) + c2 * (1 - u) * w + d * u * w);
        amp *= 0.5; f *= 2;
      }
      const i = (y * s + x) * 4;
      img.data[i] = 200; img.data[i + 1] = 190; img.data[i + 2] = 220;
      img.data[i + 3] = Math.max(0, Math.min(255, (v - 0.35) * 600));
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  glow(color) {
    let c = this.glowCache.get(color);
    if (!c) {
      c = makeCanvas(64, 64);
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, color);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      this.glowCache.set(color, c);
    }
    return c;
  }

  // ambient darkness per zone / world state / boss phase
  targetAmbient(game) {
    const w = game.world, z = w.currentZone, restored = w.state.flags.guardianDefeated;
    switch (z) {
      case Z.VILLAGE: return { r: 30, g: 18, b: 30, a: 0.22 };
      case Z.FOREST: return restored ? { r: 10, g: 22, b: 20, a: 0.2 } : { r: 18, g: 8, b: 34, a: 0.48 };
      case Z.RUINS: return { r: 8, g: 14, b: 32, a: 0.44 };
      case Z.GATE: return { r: 6, g: 10, b: 24, a: 0.55 };
      case Z.ARENA:
        if (restored) return { r: 12, g: 24, b: 20, a: 0.18 };
        if (w.arenaPhase === 3) return { r: 30, g: 0, b: 44, a: 0.55 };
        if (w.arenaPhase === 2) return { r: 6, g: 20, b: 26, a: 0.45 };
        return { r: 6, g: 14, b: 26, a: 0.38 };
      case Z.CAVE: return { r: 10, g: 4, b: 20, a: 0.72 };
      case Z.VALLEY: return { r: 40, g: 26, b: 10, a: 0.1 };
    }
    return { r: 10, g: 10, b: 20, a: 0.4 };
  }

  render(game, alpha) {
    const cam = game.camera, ctx = this.sctx, t = game.time;
    const world = game.world, map = world.map;
    // ---------------- world pass
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#050409';
    ctx.fillRect(0, 0, this.vw, this.vh);
    const z = cam.zoom;
    const ox = -cam.left * z, oy = -cam.top * z;
    ctx.setTransform(z, 0, 0, z, Math.round(ox), Math.round(oy));
    map.drawGround(ctx, cam);
    map.prefetch(cam);
    map.drawWater(ctx, cam, t);
    this.drawAreaMask(ctx, cam, map);

    // only the current map's props (plus neutral border scenery) — other maps stay hidden
    const props = map.propsInView(cam, this.propBuf).filter((p) => this.onArea(map, p));
    // ground decals (runes, circles, fallen logs)
    for (const p of props) if (p.layer === 'ground') this.drawProp(ctx, p, game, true);
    this.drawHazards(ctx, game);
    game.vfx.drawBelow(ctx, t);

    // y-sorted objects
    const list = this.drawList;
    list.length = 0;
    for (const p of props) if (p.layer !== 'ground') list.push({ y: p.y, p });
    for (const it of world.interactables) if (it.kind !== 'npc' && cam.visible(it.x, it.y, 40) && world.onMap(it)) list.push({ y: it.y - 1, it });
    for (const n of world.npcs) if (!n.hidden && cam.visible(n.x, n.y) && world.onMap(n) && (!n.secret || map.secretsFound.has(n.secret))) list.push({ y: n.y, e: n });
    for (const m of world.monsters) if (cam.visible(m.x, m.y, 80) && world.onMap(m)) list.push({ y: m.y, e: m });
    for (const d of world.dummies) if (cam.visible(d.x, d.y, 60) && world.onMap(d)) list.push({ y: d.y, e: d });
    if (world.guardian && cam.visible(world.guardian.x, world.guardian.y, 200) && world.onMap(world.guardian)) list.push({ y: world.guardian.y, e: world.guardian });
    for (const s of world.rootSpikes) list.push({ y: s.y, spike: s });
    if (game.summons) for (const s of game.summons.list) if (cam.visible(s.x, s.y, 60)) list.push({ y: s.y, summon: s });
    const pl = game.player;
    list.push({ y: pl.y, e: pl, isPlayer: true });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) {
      if (d.p) this.drawProp(ctx, d.p, game, false);
      else if (d.it) { if (d.it.kind !== 'trigger' && d.it.kind !== 'crackInfo' && d.it.kind !== 'glyphInfo' && isAvailable(world, d.it)) this.drawHint(ctx, d.it, t); drawInteractable(ctx, world, d.it, t); }
      else if (d.spike) this.drawSpike(ctx, d.spike);
      else if (d.summon) this.drawSummon(ctx, d.summon, game);
      else d.e.draw(ctx);
    }
    this.drawThreads(ctx, game, t);
    game.combat.projectiles.draw(ctx, t);
    game.vfx.drawAbove(ctx, t);

    // ---------------- lighting (view space)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawLighting(game, props);
    // telegraphs go on top of the lighting so danger stays readable even in the darkest cave
    ctx.setTransform(z, 0, 0, z, Math.round(ox), Math.round(oy));
    game.combat.telegraphs.draw(ctx, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawAtmosphere(game);

    // ---------------- upscale to screen
    const sc = this.ctx;
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.imageSmoothingEnabled = false;
    sc.drawImage(this.scene, 0, 0, this.vw * this.scale, this.vh * this.scale);
  }

  // prop belongs to the current map, or to no map (walls / border scenery)
  onArea(map, p) {
    if (!map.activeArea) return true;
    if (p.area === undefined) p.area = map.areaAt(p.x, p.y - 2);
    return !p.area || p.area === map.activeArea;
  }
  // paint every visible tile that belongs to another map as darkness (maps are separate places)
  drawAreaMask(ctx, cam, map) {
    if (!map.activeArea) return;
    const tx0 = Math.max(0, Math.floor(cam.left / TILE) - 1), ty0 = Math.max(0, Math.floor(cam.top / TILE) - 1);
    const tx1 = Math.min(map.w - 1, Math.ceil((cam.left + cam.width) / TILE) + 1), ty1 = Math.min(map.h - 1, Math.ceil((cam.top + cam.height) / TILE) + 1);
    ctx.fillStyle = '#050409';
    for (let ty = ty0; ty <= ty1; ty++) {
      let run = -1;
      for (let tx = tx0; tx <= tx1 + 1; tx++) {
        const a = tx <= tx1 ? map.area[ty * map.w + tx] : 0;
        const other = a && a !== map.activeArea;
        if (other && run < 0) run = tx;
        if (!other && run >= 0) { ctx.fillRect(run * TILE, ty * TILE, (tx - run) * TILE, TILE); run = -1; }
      }
    }
  }

  drawProp(ctx, p, game, ground) {
    const t = game.time;
    if (!p.def) {
      if (p.canvas) {
        ctx.drawImage(p.canvas, Math.round(p.x - p.canvas.width / 2), Math.round(p.y - p.canvas.height));
        return;
      }
      const fl = game.world.breakables.find((b) => b.prop === p);
      drawSpecialProp(ctx, p, t, fl, game);
      return;
    }
    const d = p.def, s = p.scale;
    const w = d.w * s, h = d.h * s;
    let alpha = p.alpha ?? 1;
    // fade tall props when the player walks behind them
    const pl = game.player;
    if (!ground && h > 50 && pl.y < p.y - 4 && pl.y > p.y - h + 10 && Math.abs(pl.x - p.x) < w * 0.42) alpha = Math.min(alpha, 0.45);
    // gentle sway for trees
    let skew = 0;
    if (p.tree) skew = Math.sin(t * 0.9 + p.x * 0.05) * 0.015;
    let dx = 0;
    if (p.shakeT > 0) { p.shakeT -= 1 / 60; dx = Math.sin(t * 90) * 2; }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(p.x + dx), Math.round(p.y));
    if (p.rot) ctx.rotate(p.rot);
    if (skew) ctx.transform(1, 0, skew, 1, 0, 0);
    if (p.flip) ctx.scale(-1, 1);
    if (p.glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (p.alpha ?? 0.6) * (0.55 + 0.45 * Math.sin(t * 1.6 + p.x));
      ctx.drawImage(d.img, d.x, d.y, d.w, d.h, -w / 2, -h / 2 - 4, w, h);
      ctx.globalCompositeOperation = 'source-over';
    } else if (ground) {
      ctx.drawImage(d.img, d.x, d.y, d.w, d.h, -w / 2, -h / 2, w, h);
    } else {
      ctx.drawImage(d.img, d.x, d.y, d.w, d.h, -w / 2, -h, w, h);
    }
    ctx.restore();
    if (p.sparkle && Math.sin(t * 3 + p.x) > 0.8) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(p.x + Math.sin(t * 7) * 8), Math.round(p.y - 20 - Math.cos(t * 5) * 10), 2, 2);
    }
  }

  // subtle pulsing ground ring marks anything the player can interact with
  drawHint(ctx, it, t) {
    const a = 0.25 + 0.2 * Math.sin(t * 3 + it.x);
    ctx.strokeStyle = it.kind === 'chest' || it.kind === 'resource' ? `rgba(255,210,120,${a})` : `rgba(140,230,255,${a})`;
    ctx.beginPath(); ctx.ellipse(it.x, it.y, 13, 5, 0, 0, TAU); ctx.stroke();
  }

  // Summons (SummonSystem): drawn with their owner's sprites — dark body + a glow in the owner's ghost colour.
  // Fades in on arrival and out over its last half second; alpha / glow come from data/summons.js.
  drawSummon(ctx, s, game) {
    const spr = s.owner.sprites, vis = game.summons.defs[s.type].visual || {};
    if (!spr) return;
    const fade = Math.min(1, s.t / 0.25, (s.duration - s.t) / 0.5);
    const moving = !s.anim && s.busy <= 0 && Math.hypot(s.owner.vx || 0, s.owner.vy || 0) > 20;
    const anim = s.anim || (moving ? 'walk' : 'idle'), ad = spr.anims[anim];
    const t = s.anim ? s.animT / s.animDur : ad && ad.loop ? game.time : 0;
    const dir = dir4(s.facing);
    ctx.fillStyle = `rgba(0,0,0,${0.25 * fade})`;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 11, 4, 0, 0, TAU); ctx.fill();
    spr.draw(ctx, spr.frame(anim, t, dir), s.x, s.y, (vis.alpha ?? 0.7) * fade);
    ctx.globalCompositeOperation = 'lighter';
    spr.draw(ctx, spr.frame(anim, t, dir, 'ghost'), s.x, s.y, (vis.glow ?? 0.35) * fade * (0.8 + 0.2 * Math.sin(game.time * 9)));
    ctx.globalCompositeOperation = 'source-over';
  }

  // Threads (ThreadSystem): a shimmering line between the two anchors + star nodes.
  // Fades in, fades out over its last second; colours come from data/threads.js.
  drawThreads(ctx, game, t) {
    const sys = game.threads;
    if (!sys || !sys.list.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const th of sys.list) {
      const v = sys.defs[th.type].visual, [a, b] = sys.ends(th);
      const fade = Math.min(1, th.t * 6, (th.duration - th.t) / 1);
      const ay = a.y - 8, by = b.y - (a === b ? 8 : b.entity ? 14 : 8);
      const wob = Math.sin(t * 9 + th.id) * 1.5;
      const mx = (a.x + b.x) / 2 + wob, my = (ay + by) / 2 + wob;
      ctx.strokeStyle = `rgba(${v.glow},${0.28 * fade})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(a.x, ay); ctx.quadraticCurveTo(mx, my, b.x, by); ctx.stroke();
      ctx.strokeStyle = v.core; ctx.globalAlpha = 0.85 * fade; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x, ay); ctx.quadraticCurveTo(mx, my, b.x, by); ctx.stroke();
      // travelling sparkles
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.7 + i / 3 + th.id * 0.13) % 1;
        const x = (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * mx + k * k * b.x, y = (1 - k) * (1 - k) * ay + 2 * (1 - k) * k * my + k * k * by;
        ctx.fillStyle = v.core; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
      for (const [x, y] of [[a.x, ay], [b.x, by]]) {
        ctx.fillStyle = v.color; ctx.globalAlpha = 0.9 * fade;
        ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 3, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 3, y); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawSpike(ctx, s) {
    const k = s.t < 0.15 ? s.t / 0.15 : s.t > 1 ? 1 - (s.t - 1) / 0.4 : 1;
    for (let i = 0; i < 5; i++) {
      const bx = s.x - 14 + i * 7, h = (14 + (i % 2) * 10) * k;
      ctx.fillStyle = i % 2 ? '#3a5a2a' : '#4a3a24';
      ctx.beginPath(); ctx.moveTo(bx - 4, s.y); ctx.lineTo(bx, s.y - h); ctx.lineTo(bx + 4, s.y); ctx.closePath(); ctx.fill();
    }
  }

  drawHazards(ctx, game) {
    const t = game.time;
    for (const h of game.world.hazards) {
      if (h.kind === 'roots') {
        ctx.fillStyle = 'rgba(40,60,30,0.55)';
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.7, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#4a3a24'; ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.quadraticCurveTo(h.x + Math.cos(a + 0.5) * h.r * 0.6, h.y + Math.sin(a + 0.5) * h.r * 0.4, h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r * 0.7); ctx.stroke();
        }
        ctx.lineWidth = 1;
      } else if (h.kind === 'pool') {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + h.x);
        ctx.fillStyle = `rgba(90,20,130,${0.45 + pulse * 0.15})`;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.65, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(210,110,255,${0.5 + pulse * 0.4})`;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.65, 0, 0, TAU); ctx.stroke();
        // purple cracks
        ctx.strokeStyle = 'rgba(200,90,255,0.7)';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + h.x;
          ctx.beginPath(); ctx.moveTo(h.x + Math.cos(a) * h.r * 0.9, h.y + Math.sin(a) * h.r * 0.6);
          ctx.lineTo(h.x + Math.cos(a) * h.r * 1.6, h.y + Math.sin(a + 0.3) * h.r * 1.0); ctx.stroke();
        }
      }
    }
    // phase-2/3 arena cracks radiating from the centre
    const w = game.world;
    if (w.arenaPhase >= 2) {
      const c = w.regions.arenaCenter;
      ctx.strokeStyle = w.arenaPhase === 3 ? 'rgba(190,80,255,0.55)' : 'rgba(90,200,140,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.3;
        ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * 60, c.y + Math.sin(a) * 60);
        ctx.lineTo(c.x + Math.cos(a + 0.12) * 200, c.y + Math.sin(a + 0.12) * 200);
        ctx.lineTo(c.x + Math.cos(a - 0.05) * 420, c.y + Math.sin(a - 0.05) * 420);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    }
  }

  drawLighting(game, props) {
    const cam = game.camera, lc = this.lctx, z = cam.zoom;
    const tgt = this.targetAmbient(game);
    const A = this.ambient, k = 0.04;
    A.r = lerp(A.r, tgt.r, k); A.g = lerp(A.g, tgt.g, k); A.b = lerp(A.b, tgt.b, k); A.a = lerp(A.a, tgt.a, k);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, this.vw, this.vh);
    lc.fillStyle = `rgba(${A.r | 0},${A.g | 0},${A.b | 0},${A.a})`;
    lc.fillRect(0, 0, this.vw, this.vh);
    // cut holes
    lc.globalCompositeOperation = 'destination-out';
    const hole = this.glow('rgba(255,255,255,1)');
    const lights = [];
    const t = game.time;
    const push = (x, y, r, color, a = 1, flicker = false) => {
      if (!cam.visible(x, y, r + 20)) return;
      const f = flicker ? 0.9 + Math.sin(t * 13 + x) * 0.05 + Math.sin(t * 7.3 + y) * 0.05 : 1;
      lights.push({ x: (x - cam.left) * z, y: (y - cam.top) * z, r: r * z * f, color, a });
    };
    const p = game.player;
    push(p.x, p.y - 16, 95, null, 0.9);
    if (p.markId && p.marks >= p.maxMarks) push(p.x, p.y - 20, 60, MARKS[p.markId].display.color, 0.5);
    for (const L of game.world.staticLights) if (this.onArea(game.world.map, L)) push(L.x, L.y, L.r, L.color, L.a ?? 0.6, L.flicker);
    for (const pr of props) if (pr.light && pr.visible) push(pr.x, pr.y + (pr.light.oy || -10), pr.light.r, pr.light.color, pr.light.a ?? 0.6, pr.light.flicker);
    game.vfx.lights.forEach((l) => push(l.x, l.y, l.r * (l.life / l.max), l.color, l.a * (l.life / l.max)));
    game.combat.projectiles.pool.forEach((pj) => push(pj.x, pj.y, 26, pj.color, 0.5));
    if (game.threads) for (const th of game.threads.list) { const [a, b] = game.threads.ends(th); push((a.x + b.x) / 2, (a.y + b.y) / 2, 40 + Math.hypot(b.x - a.x, b.y - a.y) * 0.35, game.threads.defs[th.type].visual.color, 0.45); }
    const gd = game.world.guardian;
    if (gd && !gd.dead) push(gd.x, gd.y - 60, gd.status.has('vulnerable') ? 110 : 70, gd.phase === 3 ? '#b050ff' : '#5af0ff', 0.6);
    for (const L of lights) {
      lc.globalAlpha = Math.min(1, L.a + 0.2);
      lc.drawImage(hole, L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'source-over';
    const ctx = this.sctx;
    ctx.drawImage(this.light, 0, 0);
    // coloured additive glow
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (!L.color) continue;
      ctx.globalAlpha = L.a * 0.35;
      const s = L.r * 0.8;
      ctx.drawImage(this.glow(L.color), L.x - s, L.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawAtmosphere(game) {
    const ctx = this.sctx, cam = game.camera, w = game.world, t = game.time;
    const z = w.currentZone, restored = w.state.flags.guardianDefeated;
    // fog layer (world-anchored, drifting)
    let fogA = 0;
    if (z === Z.FOREST) fogA = restored ? 0.05 : 0.2;
    else if (z === Z.GATE) fogA = 0.22;
    else if (z === Z.RUINS) fogA = 0.18;
    else if (z === Z.ARENA) fogA = restored ? 0.04 : w.arenaPhase === 3 ? 0.25 : 0.12;
    else if (z === Z.CAVE) fogA = 0.12;
    else if (z === Z.VALLEY) fogA = 0.06;
    this.fogA = lerp(this.fogA || 0, fogA, 0.02);
    if (this.fogA > 0.01) {
      const tint = z === Z.FOREST && !restored ? 'rgba(80,40,120,' : 'rgba(180,190,210,';
      for (let layer = 0; layer < 2; layer++) {
        const s = 256 * (layer ? 2.2 : 1.5) * cam.zoom;
        const offx = ((cam.left * (0.9 + layer * 0.15) + t * (6 + layer * 5)) * cam.zoom) % s;
        const offy = ((cam.top * (0.9 + layer * 0.15) + t * (2 + layer)) * cam.zoom) % s;
        ctx.globalAlpha = this.fogA * (layer ? 0.7 : 1);
        for (let y = -offy - s; y < this.vh; y += s) for (let x = -offx - s; x < this.vw; x += s) ctx.drawImage(this.fogTex, x, y, s, s);
      }
      ctx.globalAlpha = 1;
      if (z === Z.FOREST && !restored) {
        ctx.fillStyle = 'rgba(60,20,90,0.08)';
        ctx.fillRect(0, 0, this.vw, this.vh);
      }
    }
    // restored forest / valley: warm light shafts
    if ((restored && (z === Z.FOREST || z === Z.ARENA)) || z === Z.VALLEY) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x = ((i * 190 - cam.left * 0.3 + t * 4) % (this.vw + 200)) - 100;
        const g = ctx.createLinearGradient(x, 0, x + 120, this.vh);
        g.addColorStop(0, 'rgba(255,230,160,0.10)');
        g.addColorStop(1, 'rgba(255,230,160,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 50, 0); ctx.lineTo(x + 170, this.vh); ctx.lineTo(x + 90, this.vh); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // vignette (stronger in phase 3 & low HP)
    const pl = game.player;
    const lowHp = pl.hp / pl.maxHp < 0.3;
    const p3 = z === Z.ARENA && w.arenaPhase === 3 && !restored;
    const vg = ctx.createRadialGradient(this.vw / 2, this.vh / 2, this.vh * 0.35, this.vw / 2, this.vh / 2, this.vh * 0.85);
    const vcol = lowHp ? `rgba(120,0,10,${0.45 + 0.15 * Math.sin(t * 5)})` : p3 ? `rgba(60,0,80,${0.55 + 0.1 * Math.sin(t * 2.5)})` : 'rgba(0,0,0,0.45)';
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, vcol);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.vw, this.vh);
    // slow-motion tint
    if (game.timeScale < 0.9) {
      ctx.fillStyle = `rgba(90,30,150,${(1 - game.timeScale) * 0.18})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    // screen flash
    const fl = game.vfx.screenFlash;
    if (fl.a > 0.01) {
      ctx.fillStyle = `rgba(${fl.color},${fl.a})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
  }
}
