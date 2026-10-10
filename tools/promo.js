// FIRST PROMO CLIP (Facebook, 30 s, 16:9 1080p, Thai captions, no sound — music is added in the editor).
//   const P = await import('/tools/promo.js?v=' + Date.now());
//   await P.record(__game)                                   // whole clip -> recordings/promo_v1.mp4
//   await P.record(__game, 'try', ['bosses'])                // one part only
//   await P.peek(__game, 'a2', 140, 114, 'pk_arch')          // scout a shot -> recordings/pk_arch.png
// Timeline (s): hook 3.5 · world 8.4 (fights, party / solo) · classes 6 · combat 3.5 · bosses 6 (2 + Varkharon tease) · end 2.6 = 30
import * as R from './recorder.js';
import { releaseInput, bot, downBoss } from './testkit.js';
import { Monster } from '../src/monsters/monster.js';
import { CLASSES } from '../src/skills/classes.js';

const TILE = 32;

// BEAT SYNC: record(g, name, parts, { beat }) makes every shot a whole number of beats, counted from the clip start, so each
// cut lands on the music's beat (frame rounding never drifts: each shot ends at round(totalBeats × beat × fps)).
let SYNC = null; // { beat, beats, rec }
function D(sec, beats) {
  if (!SYNC) return sec;
  SYNC.beats += beats;
  const endFrame = Math.round(SYNC.beats * SYNC.beat * SYNC.rec.fps);
  return (endFrame - SYNC.rec.frames()) / SYNC.rec.fps;
}

// jump to a map + tile with the camera on it (no recording)
export function place(g, map, tx, ty, classId) {
  if (g.state !== 'play' || (classId && g.player.cls.id !== classId)) { g.newGame(classId || 'umbral_sword'); closePanels(g); }
  closePanels(g);
  releaseInput(g);
  const w = g.world;
  w.transitions.autoConfirm = true;
  if (w.mapId !== map) w.changeMap(map, { entry: [tx, ty] });
  const p = g.player, pos = w.map.findOpen(tx * TILE, ty * TILE, 6);
  p.x = pos.x; p.y = pos.y;
  g.camera.snap(p.x, p.y);
  g.simulate(0.4);
  closePanels(g);
  return { map: w.mapId, x: Math.round(p.x / TILE), y: Math.round(p.y / TILE) };
}
function closePanels(g) { if (g.ui.panelOpen) g.ui.panels.close(true); }

// mouse on the player = no camera look-ahead (the camera stays centred)
function mouseOnPlayer(g) {
  const p = g.player, r = g.renderer, cam = g.camera;
  g.input.mouse.x = ((p.x - cam.left) * cam.zoom * r.scale) / r.dpr;
  g.input.mouse.y = ((p.y - 12 - cam.top) * cam.zoom * r.scale) / r.dpr;
}
const walker = (keys) => (g) => {
  const d = g.input.down; ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach((k) => d.delete(k)); keys.forEach((k) => d.add(k));
  mouseOnPlayer(g); g.player.hp = g.player.maxHp;
};
const godBot = (opts = {}) => (g, i) => { bot(g, i, { god: true, ...opts }); g.player.hp = Math.max(g.player.hp, g.player.maxHp * 0.6); };

// 1) HOOK (3.5 s): three hard cuts of the loudest moments (white flash on each cut), then the logo SLAMS in
const flashIn = (c, W, H, t) => { if (t < 0.12) { c.fillStyle = `rgba(255,255,255,${0.85 * (1 - t / 0.12)})`; c.fillRect(0, 0, W, H); } };
export async function hook(rec) {
  const g = rec.g;
  // cut 1 — Magma Beast: a rain of lava circles exploding around a solo player
  const mb = bossSetup(g, 'rift', 'boss_a2', 84, 40, 'umbral_sword', 30, [], 3);
  forceMove(mb.e, 'lava_rain'); g.simulate(0.85, godBot());
  await rec.shot(D(0.8, 1), { perStep: godBot(), fadeIn: 0, fadeOut: 0, overlay: (c, W, H, k, t) => flashIn(c, W, H, t) });
  // cut 2 — party of 4 on Hoarfang, everyone's ultimate at once (this one is meant to be loud)
  const hf = bossSetup(g, 'frost_arena', 'boss_b1', 142, 131, 'astral_weaver', 20, ['umbral_sword', 'aegis_guardian', 'nightfall_reaper'], 3);
  for (const m of [g.player, ...hf.team]) for (const id of Object.keys(m.resources.values || {})) m.resources.fill(id);
  const tb = teamBot(hf.team);
  await rec.shot(D(0.8, 1), { perStep: (gg, i) => { if (i === 1) { gg.input.pushBuffer('skill5'); hf.team.forEach((a) => a._input.pushBuffer('skill5')); } tb(gg, i); }, fadeIn: 0, fadeOut: 0, overlay: (c, W, H, k, t) => flashIn(c, W, H, t) });
  disband(g, hf.team);
  // cut 3 — Rune Knight close up, mid-combo
  bossSetup(g, 'sanctum', 'boss_a3', 84, 26, 'nightfall_reaper', 40, [], 4);
  await rec.shot(D(0.6, 1), { perStep: godBot(), fadeIn: 0, fadeOut: 0, overlay: (c, W, H, k, t) => flashIn(c, W, H, t) });
  releaseInput(g);
  // LOGO SLAM (1.3 s): the logo drops from big to its size with a flash + shake, the violet glow fades
  const { logo } = R.ART;
  await rec.card(D(1.3, 2), (c, W, H, k, t) => {
    const s = H / 1080, a = Math.min(1, t / 0.12), sc = 1 + Math.max(0, 0.6 * (1 - t / 0.18));
    const shake = t > 0.18 && t < 0.45 ? (Math.random() - 0.5) * 24 * s * (1 - (t - 0.18) / 0.27) : 0;
    const glow = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 640 * s);
    glow.addColorStop(0, `rgba(170,90,255,${0.55 * Math.max(0, 1 - t / 1.2) + 0.15})`); glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
    const lw = 1100 * s * sc, lh = lw * (logo.height / logo.width);
    c.globalAlpha = a; c.drawImage(logo, W / 2 - lw / 2 + shake, H / 2 - lh / 2 + shake * 0.6, lw, lh); c.globalAlpha = 1;
    if (t > 0.17 && t < 0.3) { c.fillStyle = `rgba(255,255,255,${0.7 * (1 - (t - 0.17) / 0.13)})`; c.fillRect(0, 0, W, H); }
  });
}
// make an AreaBoss start one of its moves now (filming: show a big pattern on cue)
export function forceMove(e, id) {
  const m = e && e.def.moves[id];
  if (!m) return false;
  e.interruptMove(); e.lastMove = id; e.cds[id] = m.cd || 2;
  e.run(e.execMove(m));
  return true;
}

// 2) WORLD (6 × 1.4 s): a fight on every field map — party of 4 and solo shots in turn
//    [map, tile x, tile y, main class, ally classes ([] = solo), monster type, count, title, sub]
export const WORLD_SHOTS = [
  ['a1', 18, 78, 'umbral_sword', ['aegis_guardian', 'astral_weaver', 'lumen_oracle'], 'treant', 4, 'ป่ากระซิบ', 'ปาร์ตี้ 4 คน'],
  ['a2', 140, 118, 'nightfall_reaper', [], 'armadillo', 3, 'หุบเขาโบราณ', 'ลุยเดี่ยว'],
  ['a3', 84, 118, 'warden_of_dawn', ['stormcaller', 'duskrunner', 'void_scribe'], 'bronze_hoplite', 4, 'นครรูนที่ล่มสลาย', 'ปาร์ตี้ 4 คน'],
  ['b1', 81, 60, 'astral_weaver', [], 'rime_wolf', 4, 'ทุ่งหิมะฟรอสต์วินด์', 'สู้ฝ่าพายุหิมะ', false, 'storm'],
  ['b2', 39, 36, 'blade_of_echoes', ['bulwark_sentinel', 'stormcaller', 'nightfall_reaper'], 'cave_spider', 4, 'ถ้ำคริสตัล', 'ปาร์ตี้ 4 คน'],
  ['b3', 66, 150, 'oathbreaker', [], 'frost_imp', 5, 'ยอดเขาฟรอสต์พีค', 'ลุยเดี่ยว', true],
];
export async function world(rec, shots = WORLD_SHOTS, sec = 1.4) {
  const g = rec.g;
  for (const [map, x, y, cls, allies, mon, n, title, sub, ult, weather] of shots) {
    heroSetup(g, cls, map, x, y, 30);
    const team = party(g, allies);
    if (weather === 'storm') blizzardNow(g);
    pack(g, mon, n, 130);
    g.simulate(1.2, teamBot(team));           // the fight is already on when the clip starts
    if (ult) for (const id of Object.keys(g.player.resources.values || {})) g.player.resources.fill(id);
    const tb = teamBot(team);
    await rec.shot(D(sec, 2), { perStep: (gg, i) => { if (ult && i === 2) gg.input.pushBuffer('skill5'); tb(gg, i); }, title, sub, fade: 0.1 }); // ult = opens with the ultimate
    disband(g, team);
  }
  releaseInput(g);
}

// AI TEAMMATES (offline, filming only): real Player objects of other classes, each driven by testkit's bot with its own
// input object (g.player / g.input are swapped while it thinks + updates), drawn with the other players.
function fakeInput(main) {
  const inp = Object.create(Object.getPrototypeOf(main));
  Object.assign(inp, { down: new Set(), pressedKeys: new Set(), buffer: new Map(), mouse: { x: 0, y: 0, left: false, right: false, leftPressed: false, rightPressed: false }, enabled: true, lastKey: null });
  return inp;
}
export function party(g, classIds) {
  const p = g.player, team = [];
  classIds.forEach((id, k) => {
    const cls = CLASSES[id], a = new p.constructor(g, cls, g.spritesFor(cls));
    const ang = Math.PI * 0.5 + (k - 1) * 0.9, pos = g.world.map.findOpen(p.x + Math.cos(ang) * 50, p.y + Math.sin(ang) * 50, 3);
    a.x = pos.x; a.y = pos.y; a.setLevel(30); a.recomputeStats(); a.hp = a.maxHp;
    a._input = fakeInput(g.input);
    g.party.add(a); team.push(a);
  });
  if (!g.online._promoDraw) {
    const orig = g.online.drawables.bind(g.online);
    g.online._promoDraw = true;
    g.online.drawables = () => orig().concat(g._promoTeam || []);
  }
  g._promoTeam = team;
  return team;
}
export function disband(g, team) {
  for (const a of team) { g.party.remove(a); a.dispose(); }
  g._promoTeam = [];
}
const STEP = 1 / 60;
// spread: around a boss each member keeps its own spot of a ring (melee close, ranged further out) and only ONE member
// at a time may use skills (the turn passes every 0.8 s), so effects don't all land on the same frame
const teamBot = (team, { spread = false } = {}) => (g, i) => {
  const main = g.player, mainInput = g.input, all = [main, ...team];
  const boss = spread && g.bosses.engagedEntity();
  const turn = Math.floor(g.time / 0.8) % all.length;
  const tidy = (m, k) => {
    if (!boss) return;
    if (k !== turn) for (const key of [...g.input.buffer.keys()]) if (/^skill|^break$/.test(key)) g.input.buffer.delete(key);
    if (m.action || m.dodging) return;
    if (g.combat.telegraphs.list.some((t) => !t.resolved && g.combat.testShape(t, m))) return; // in danger: the bot's dodge wins
    const ranged = m.cls.ratings && m.cls.ratings.range >= 4, r = ranged ? 150 : 72;
    const ang = (k / all.length) * Math.PI * 2 + Math.PI / 2;
    const tx = boss.x + Math.cos(ang) * r, ty = boss.y + Math.sin(ang) * r, d = Math.hypot(tx - m.x, ty - m.y);
    if (d > 10 && g.world.map.findOpen) { const s = Math.min(d, 2.2); m.x += ((tx - m.x) / d) * s; m.y += ((ty - m.y) / d) * s; }
  };
  godBot()(g, i); tidy(main, 0);
  team.forEach((a, k) => {
    g.player = a; g.input = a._input;
    try {
      bot(g, i + 7 + k * 11, { god: true });
      tidy(a, k + 1);
      g.input.tickBuffer(STEP);
      a.update(STEP);
      a.hp = Math.max(a.hp, a.maxHp * 0.6);
      g.input.endFrame();
    } finally { g.player = main; g.input = mainInput; }
  });
};

// 3) CLASSES (3 × 2 s): each starting class on its own map, LV 30, opens with its ultimate, then really fights the pack
//    [class, title, sub, map, tile x, tile y, monsters [[type, n]]]
export const CLASS_SHOTS = [
  ['umbral_sword', 'นักดาบเงา', 'Umbral Sword', 'a1', 47, 150, [['treant', 2], ['leafling', 2]]],
  ['astral_weaver', 'จอมเวทดวงดาว', 'Astral Weaver', 'a2', 84, 103, [['armadillo', 2], ['quill_lizard', 2]]],
  ['aegis_guardian', 'อัศวินโล่ศักดิ์สิทธิ์', 'Aegis Guardian', 'a3', 46, 116, [['bronze_hoplite', 2], ['void_scarab', 3]]],
];
function pack(g, type, n = 4, r = 90, a0 = 0.4) {
  const p = g.player, list = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + a0, pos = g.world.map.findOpen(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 3);
    const m = new Monster(g, type, pos.x, pos.y, {});
    m.mapId = g.world.mapId; g.world.monsters.push(m); list.push(m);
  }
  return list;
}
function clearNear(g, r = 600) {
  const p = g.player;
  g.world.monsters = g.world.monsters.filter((m) => Math.hypot(m.x - p.x, m.y - p.y) > r);
}
function heroSetup(g, classId, map, x, y, level = 30) {
  place(g, map, x, y, classId);
  const p = g.player;
  p.setLevel(level); p.hp = p.maxHp;
  for (const id of Object.keys(p.resources.values || {})) p.resources.fill(id);
  clearNear(g);
}
export async function classes(rec, shots = CLASS_SHOTS, sec = 2) {
  const g = rec.g;
  for (const [cls, title, sub, map, x, y, mons] of shots) {
    heroSetup(g, cls, map, x, y);
    mons.forEach(([type, n], k) => pack(g, type, n, 100 + k * 40, k));
    g.simulate(1.0, godBot());           // the pack is on you when the clip starts
    for (const id of Object.keys(g.player.resources.values || {})) g.player.resources.fill(id);
    await rec.shot(D(sec, 3), { perStep: (gg, i) => { if (i === 2) gg.input.pushBuffer('skill5'); godBot()(gg, i); }, title, sub, fade: 0.1 });
    releaseInput(g);
  }
}

// 4) COMBAT (3 s): Umbral in a wolf pack — dodges, marks, Shadow Break
export async function combat(rec, sec = 3) {
  const g = rec.g;
  heroSetup(g, 'umbral_sword', 'b1', 81, 60, 20);
  pack(g, 'rime_wolf', 5, 110);
  g.simulate(1.5, godBot());
  await rec.shot(D(sec, 4), { perStep: godBot({ dodgeLead: 0.12 }), title: 'หลบ · ปัดป้อง · โต้กลับ', sub: 'ทุกการตัดสินใจมีความหมาย', fade: 0.12 });
  releaseInput(g);
}

// 5) BOSSES (party 2.5 s + solo 2.5 s + Varkharon 1.5 s)
//    party: Hoarfang fights back — the clip starts as one of its attacks winds up, so the party is seen dodging it
//    solo: Magma Beast in its second phase, chaining its big circle patterns (lava rain -> eruption -> magma nova)
function bossSetup(g, map, bossId, x, y, cls, level, allies = [], warm = 6) {
  if (g.state !== 'play' || g.player.cls.id !== cls) { g.newGame(cls); closePanels(g); }
  for (const b of ['boss_a1', 'boss_a2', 'boss_b1', 'boss_b2']) if (b !== bossId) downBoss(g, b); // roads open, the filmed boss untouched
  g.bosses.runKills.delete(bossId);
  place(g, map, x, y, cls);
  const p = g.player; p.setLevel(level); p.hp = p.maxHp;
  const enc = g.bosses.get(bossId), e = enc.entity || g.bosses.entityOf(enc);
  if (e) { const pos = g.world.map.findOpen(e.x, e.y + 150, 4); p.x = pos.x; p.y = pos.y; g.camera.snap(p.x, p.y); }
  const team = party(g, allies);
  for (let k = 0; k < 30 && enc.state !== 'engaged'; k++) g.simulate(0.3, teamBot(team));
  g.simulate(warm, teamBot(team, { spread: true }));
  return { enc, team, e: enc.entity || g.bosses.entityOf(enc) };
}
const bossTele = (g, e) => g.combat.telegraphs.list.find((t) => !t.resolved && t.owner === e && t.total - t.time > 0.5);
export async function bosses(rec) {
  const g = rec.g;
  // PARTY vs Hoarfang
  const hf = bossSetup(g, 'frost_arena', 'boss_b1', 142, 131, 'umbral_sword', 20, ['aegis_guardian', 'astral_weaver', 'lumen_oracle']);
  for (let t = 0; t < 8 && !bossTele(g, hf.e); t += 0.1) g.simulate(0.1, teamBot(hf.team, { spread: true }));
  await rec.shot(D(2.5, 4), { perStep: teamBot(hf.team, { spread: true }), fade: 0.08, title: 'บอสที่ต้องใช้ฝีมือ', sub: 'รวมปาร์ตี้ อ่านจังหวะ แล้วล้มมันด้วยกัน' });
  disband(g, hf.team); releaseInput(g);
  // SOLO vs Magma Beast, phase 2
  const mb = bossSetup(g, 'rift', 'boss_a2', 84, 40, 'stormcaller', 30, [], 3);
  mb.e.hp = Math.floor(mb.e.maxHp * 0.45); mb.e.checkPhase(); g.simulate(3, godBot()); // past the phase-change roar
  forceMove(mb.e, 'lava_rain');
  const seq = [[54, 'eruption'], [102, 'magma_nova']]; // steps (1/60 s) into the shot
  await rec.shot(D(2.5, 4), {
    perStep: (gg, i) => { for (const [at, id] of seq) if (i === at) forceMove(mb.e, id); godBot()(gg, i); },
    fade: 0.08, title: 'ลุยเดี่ยวก็ได้', sub: 'ถ้าคุณกล้าพอ',
  });
  releaseInput(g);
  await varkharon(rec, 1.5);
}
// the secret boss, barely shown: dark red, shaking, "something is waking"
export async function varkharon(rec, sec = 2) {
  const g = rec.g;
  place(g, 'a2', 148, 176, 'umbral_sword');
  g.world.setFlag('cinderSealBroken'); downBoss(g, 'boss_a1');
  g.world.changeMap('cinder', { entry: [148, 165] }); g.simulate(0.4);
  const p = g.player; p.setLevel(52); p.hp = p.maxHp;
  const enc = g.bosses.get('boss_varkharon'), arena = enc.def.arena, trig = arena.trigger;
  arena.trigger = 0.001; // (0 counts as unset = default radius) the dragon sleeps on: the player only walks up and meets it (no fight)
  const pos = g.world.map.findOpen(148 * TILE, 163 * TILE, 2); p.x = pos.x; p.y = pos.y; g.camera.snap(p.x, p.y - 60);
  g.simulate(0.3);
  const e = enc.entity || g.bosses.entityOf(enc);
  g.camera.focus = null; g.camera.snap(e.x, e.y + 40);
  try {
    await rec.shot(D(sec, 4), {
      perStep: (gg) => {
        if (gg.player.y > e.y + 4 * TILE) walker(['KeyW'])(gg); else releaseInput(gg); // walk up, stop in front of it
        gg.camera.lookAt(e.x, e.y + 40, 0.1); // the dragon fills the frame, the player walks in from below
      },
      fade: 0.1,
      overlay: (c, W, H, k) => {
        c.fillStyle = 'rgba(30,0,0,0.45)'; c.fillRect(0, 0, W, H);
        const v = c.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.75);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.95)');
        c.fillStyle = v; c.fillRect(0, 0, W, H);
        R.bigText(c, W, H, 'บางสิ่ง...กำลังรออยู่', Math.min(1, k * 3), 72, '#ff9a6a', 330);
      },
    });
  } finally { arena.trigger = trig; }
  releaseInput(g);
}

// 6) END (2.5 s): logo + COMING SOON
export async function end(rec, sec = 2.6) {
  const { logo } = R.ART;
  await rec.card(D(sec, 3), (c, W, H, k, t) => {
    const s = H / 1080, a = Math.min(1, t / 0.5);
    const glow = c.createRadialGradient(W / 2, H / 2 - 60 * s, 0, W / 2, H / 2, 600 * s);
    glow.addColorStop(0, `rgba(150,80,220,${0.3 * a})`); glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
    const lw = 900 * s, lh = lw * (logo.height / logo.width);
    c.globalAlpha = a; c.drawImage(logo, W / 2 - lw / 2, H / 2 - lh / 2 - 70 * s, lw, lh); c.globalAlpha = 1;
    R.bigText(c, W, H, 'COMING SOON', Math.min(1, Math.max(0, (t - 0.5) / 0.5)), 64, '#e8c16a', 200);
  });
}

export const PARTS = { hook, world, classes, combat, bosses, end };
export async function record(g, name = 'promo_v1', parts = ['hook', 'world', 'classes', 'combat', 'bosses', 'end'], { beat } = {}) {
  await document.fonts.load('600 52px Kanit'); await document.fonts.load('700 72px Kanit');
  closePanels(g);
  g.newGame('umbral_sword'); closePanels(g);
  const rec = await R.start(g, { name });
  SYNC = beat ? { beat, beats: 0, rec } : null;
  const marks = {};
  try { for (const p of parts) { marks[p] = rec.seconds(); await PARTS[p](rec); } } finally { SYNC = null; }
  const res = await rec.finish();
  return { ...res, marks };
}

// place + save a 1920×1080 still (no HUD) to recordings/<name>.png
export async function peek(g, map, tx, ty, name = 'peek', classId) {
  const r = place(g, map, tx, ty, classId);
  return { ...r, ...(await still(g, name)) };
}
export async function still(g, name = 'peek', hud = false) {
  R.sizeTo(g.renderer, 1920, 1080);
  g.renderer.render(g);
  if (hud) g.ui.draw(g.renderer.ctx, 1920, 1080);
  const blob = await new Promise((ok) => g.renderer.canvas.toBlob(ok, 'image/png'));
  R.restoreSize(g.renderer);
  const res = await fetch(`/dev/recording/${name}.png`, { method: 'POST', body: blob });
  return { file: `recordings/${name}.png`, ok: res.ok };
}

// B1 map mechanic: start the blizzard now (white-out + driving snow; filming only — the cycle carries on afterwards)
export function blizzardNow(g, secs = 30) {
  const m = g.world.mapMech.get('blizzard');
  if (!m) return false;
  m.phase = 'storm'; m.t = secs; m.k = 1;
  return true;
}

// ====================================================================================================================
// SERIES 2 (owner 2026-10-09): CLASS LINE clips + one MAP MECHANICS clip. Same recorder, beat-synced (record(..., { beat })).
//   await P.record(__game, 'umbral_line', P.LINE_PARTS.umbral, { beat: 60 / 90 })   // + song boss_final p1
//   await P.record(__game, 'map_mechanics', P.MECH_PARTS, { beat: 60 / 120 })       // + song dungeon_dark
// ====================================================================================================================

// a centred end card: logo + up to 2 lines + COMING SOON (beats)
function endCard(beats, lines = []) {
  return async (rec) => {
    const { logo } = R.ART;
    await rec.card(D(beats * 0.5, beats), (c, W, H, k, t) => {
      const s = H / 1080, a = Math.min(1, t / 0.4);
      const glow = c.createRadialGradient(W / 2, H / 2 - 80 * s, 0, W / 2, H / 2, 620 * s);
      glow.addColorStop(0, `rgba(150,80,220,${0.3 * a})`); glow.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = glow; c.fillRect(0, 0, W, H);
      const lw = 820 * s, lh = lw * (logo.height / logo.width);
      c.globalAlpha = a; c.drawImage(logo, W / 2 - lw / 2, H / 2 - lh / 2 - 130 * s, lw, lh); c.globalAlpha = 1;
      lines.forEach((ln, i) => R.bigText(c, W, H, ln, Math.min(1, Math.max(0, (t - 0.25 - i * 0.2) / 0.4)), i ? 40 : 52, i ? '#d8cfe8' : '#f1e2b8', 90 + i * 64));
      R.bigText(c, W, H, 'COMING SOON', Math.min(1, Math.max(0, (t - 0.8) / 0.4)), 56, '#e8c16a', 250);
    });
  };
}
const fillAll = (p) => { for (const id of Object.keys(p.resources.values || {})) p.resources.fill(id); };

// ---------------- CLASS LINE clip: hook (the line's flashiest ultimate) -> base class + its three Class 2 -> end card
//    shot = [class, title, sub, map, tx, ty, [[monster, n]...]]
export const LINES = {
  umbral: {
    hook: ['nightfall_reaper', 'a3', 84, 118, [['bronze_hoplite', 3], ['void_scarab', 3]]],
    shots: [
      ['umbral_sword', 'Umbral Sword', 'สะสมรอยเงา แล้วปลดปล่อย Shadow Break', 'a1', 47, 150, [['treant', 3], ['leafling', 4]]],
      ['nightfall_reaper', 'Nightfall Reaper', 'ประทับเงา ส่งร่างแยกไปเก็บวิญญาณ', 'a3', 46, 116, [['bronze_hoplite', 3], ['void_scarab', 4]]],
      ['duskrunner', 'Duskrunner', 'ยิ่งวิ่ง ยิ่งแรง — โมเมนตัมไม่มีวันหยุด', 'b1', 81, 60, [['rime_wolf', 6], ['snow_hare', 3]]],
      ['blade_of_echoes', 'Blade of Echoes', 'ยิ่งเจ็บ ยิ่งแกร่ง — โต้กลับด้วยความทรงจำ', 'b2', 39, 36, [['cave_spider', 4], ['crystal_slime', 3]]],
    ],
    end: ['สายเงา · UMBRAL LINE', 'เลือกเส้นทางของคุณที่ LV 30'],
  },
};
function lineHook(line) {
  return async (rec) => {
    const g = rec.g, [cls, map, x, y, mons] = LINES[line].hook;
    heroSetup(g, cls, map, x, y, 40);
    mons.forEach(([type, n], k) => pack(g, type, n, 90 + k * 40, k));
    g.simulate(1.2, godBot()); fillAll(g.player);
    await rec.shot(D(2, 3), { perStep: (gg, i) => { if (i === 1) gg.input.pushBuffer('skill5'); godBot()(gg, i); }, fadeIn: 0, fadeOut: 0.08,
      overlay: (c, W, H, k, t) => { if (t < 0.12) { c.fillStyle = `rgba(255,255,255,${0.85 * (1 - t / 0.12)})`; c.fillRect(0, 0, W, H); } } });
    releaseInput(g);
  };
}
function lineShots(line, beats = 6) {
  return async (rec) => {
    const g = rec.g;
    for (const [cls, title, sub, map, x, y, mons] of LINES[line].shots) {
      heroSetup(g, cls, map, x, y, 30);
      mons.forEach(([type, n], k) => pack(g, type, n, 100 + k * 40, k));
      g.simulate(1.0, godBot()); fillAll(g.player);
      await rec.shot(D(beats * 0.6, beats), { perStep: (gg, i) => { if (i === 2) gg.input.pushBuffer('skill5'); godBot()(gg, i); }, title, sub, fade: 0.1 });
      releaseInput(g);
    }
  };
}
export const LINE_PARTS = {};
for (const line of Object.keys(LINES)) {
  Object.assign(PARTS, { [line + 'Hook']: lineHook(line), [line + 'Shots']: lineShots(line), [line + 'End']: endCard(4, LINES[line].end) });
  LINE_PARTS[line] = [line + 'Hook', line + 'Shots', line + 'End'];
}

// ---------------- MAP MECHANICS clip: hook (blizzard white-out) -> the six field-map mechanics -> end card
async function interactNow(g, it) { const { interact } = await import('../src/exploration/interactables.js'); if (it) interact(g.world, it); }
function quietMap(g) { const w = g.world; for (const m of w.monsters) m.removed = true; w.monsters = []; for (const sp of w.spawnPoints) sp.active = false; }
const stand = (g) => { const d = g.input.down; ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach((k) => d.delete(k)); mouseOnPlayer(g); g.player.hp = g.player.maxHp; };
const caption = (title, sub) => ({ title, sub, fade: 0.1 });

async function mechHook(rec) {
  const g = rec.g;
  heroSetup(g, 'stormcaller', 'b1', 81, 60, 30);
  pack(g, 'rime_wolf', 4, 130); blizzardNow(g);
  g.simulate(1.5, godBot());
  await rec.shot(D(2, 4), { perStep: godBot(), fadeIn: 0.15, fadeOut: 0.08,
    overlay: (c, W, H, k, t) => R.bigText(c, W, H, '6 แมพ · 6 กลไก', Math.min(1, t / 0.3), 84, '#f1e2b8', 0) });
  releaseInput(g);
}
async function mechFireflies(rec) {
  const g = rec.g;
  place(g, 'a1', 16, 100, 'umbral_sword'); quietMap(g);
  const f = g.world.mapMech.get('fireflies'); if (f) { f.flies = []; f.emitT = 0; }
  g.simulate(0.9, stand); // standing still: the swarm rises on camera
  await rec.shot(D(4, 8), { perStep: stand, ...caption('ป่ากระซิบ', 'ยืนนิ่ง… แล้วหิ่งห้อยจะนำทางไปสู่ความลับ') });
}
async function mechWater(rec) {
  const g = rec.g, w = (place(g, 'a2', 84, 186, 'astral_weaver'), g.world); quietMap(g);
  const lever = w.interactables.find((i) => i.id === 'water_lever');
  g.player.x = lever.x; g.player.y = lever.y + 20; g.simulate(0.1);
  const pos = w.map.findOpen(38 * TILE, 156 * TILE, 4); g.player.x = pos.x; g.player.y = pos.y; g.camera.snap(38 * TILE, 166 * TILE);
  // the lake is still full when the clip starts; the wheel turns (far away, by script) 0.5 s in and the water drains on camera
  await rec.shot(D(4, 8), { perStep: (gg, i) => { if (i === 30) interactNow(gg, lever); stand(gg); gg.camera.lookAt(38 * TILE, 166 * TILE, 0.1); }, ...caption('หุบเขาโบราณ', 'หมุนวงล้อ ระบายทะเลสาบ เผยสมบัติที่จมอยู่') });
}
async function mechVaults(rec) {
  const g = rec.g, w = (place(g, 'a3', 84, 196, 'warden_of_dawn'), g.world); quietMap(g);
  const rv = w.mapMech.get('rune_vaults'), v = rv.vaults[0], it = rv.items[0], s = v.sw[0];
  g.player.x = s.x; g.player.y = s.y + 24; g.camera.snap(g.player.x, g.player.y); g.simulate(0.2, stand);
  const door = { x: ((v.room[0] + v.room[2]) / 2 + 0.5) * TILE, y: (v.room[3] + 3) * TILE };
  let cut = false;
  await rec.shot(D(4, 8), {
    perStep: (gg, i) => {
      stand(gg);
      if (i === 12) interactNow(gg, it);           // light the rune switch
      if (i === 110 && !cut) {                      // ... cut to the vault door: open
        cut = true; const q = w.map.findOpen(door.x, door.y + 40, 4); gg.player.x = q.x; gg.player.y = q.y; gg.camera.snap(q.x, q.y - 30);
      }
      if (cut) gg.input.down.add('KeyW');           // walk in
    },
    ...caption('นครรูนที่ล่มสลาย', 'จุดรูน แล้ววิ่งแข่งเวลา ก่อนประตูห้องลับจะปิด'),
  });
  releaseInput(g);
}
async function mechBlizzard(rec) {
  const g = rec.g;
  heroSetup(g, 'duskrunner', 'b1', 81, 60, 30);
  const bz = g.world.mapMech.get('blizzard');
  const fire = bz.fires.slice().sort((a, b) => Math.hypot(a.x - g.player.x, a.y - g.player.y) - Math.hypot(b.x - g.player.x, b.y - g.player.y))[0];
  const start = g.world.map.findOpen(fire.x - 260, fire.y + 60, 5); g.player.x = start.x; g.player.y = start.y; g.camera.snap(start.x, start.y);
  pack(g, 'rime_wolf', 3, 200); blizzardNow(g); bz.cold = 55;
  g.simulate(0.6, stand);
  await rec.shot(D(4, 8), {
    perStep: (gg) => {                              // run for the campfire, the wolves on your heels
      const p = gg.player, d = gg.input.down, dx = fire.x - p.x, dy = fire.y - p.y;
      ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach((k) => d.delete(k));
      if (Math.hypot(dx, dy) > 50) { if (dx > 20) d.add('KeyD'); if (dx < -20) d.add('KeyA'); if (dy > 20) d.add('KeyS'); if (dy < -20) d.add('KeyW'); }
      mouseOnPlayer(gg); p.hp = Math.max(p.hp, p.maxHp * 0.6);
    },
    ...caption('ทุ่งหิมะฟรอสต์วินด์', 'พายุมาแล้ว — หากองไฟให้เจอ ก่อนหมาป่าจะเจอคุณ'),
  });
  releaseInput(g);
}
async function mechDarkness(rec) {
  const g = rec.g, w = (place(g, 'b2', 7, 12, 'lumen_oracle'), g.world); quietMap(g);
  const dk = w.mapMech.get('darkness'), z = dk.zones[0];
  for (const c of z.cr.slice(0, 2)) { g.player.x = c.x; g.player.y = c.y + 20; g.simulate(0.1); await interactNow(g, w.nearest); }
  const last = z.cr[2]; g.player.x = last.x - 70; g.player.y = last.y + 30; g.camera.snap(g.player.x, g.player.y); g.simulate(1.2, stand);
  let lit = false;
  await rec.shot(D(4, 8), {
    perStep: (gg, i) => {
      const p = gg.player, d = gg.input.down; ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach((k) => d.delete(k));
      if (!lit && Math.hypot(last.x - p.x, last.y + 20 - p.y) > 24) { if (last.x - p.x > 10) d.add('KeyD'); if (last.y + 20 - p.y < -10) d.add('KeyW'); }
      else if (!lit) { lit = true; p.x = last.x; p.y = last.y + 20; gg.world.nearest = gg.world.interactables.find((it) => it.x === last.x && it.y === last.y) || gg.world.nearest; interactNow(gg, gg.world.nearest); }
      mouseOnPlayer(gg);
    },
    ...caption('ถ้ำคริสตัล', 'ในความมืดสนิท… จุดคริสตัลให้ครบสามดวง'),
  });
  releaseInput(g);
}
async function mechAltitude(rec) {
  const g = rec.g, w = (place(g, 'b3', 96, 56, 'oathbreaker'), g.world); quietMap(g);
  const a = w.mapMech.get('altitude_cold'), p = g.player;
  const ember = a.embers.slice().sort((e1, e2) => Math.hypot(e1.x - p.x, e1.y - p.y) - Math.hypot(e2.x - p.x, e2.y - p.y))[0];
  const st = w.map.findOpen(ember.x - 200, ember.y, 5); p.x = st.x; p.y = st.y; g.camera.snap(p.x, p.y);
  a.cold = 88; g.simulate(0.4, stand);
  await rec.shot(D(4, 8), {
    perStep: (gg) => {                              // freezing high up: stagger to the warm ember
      const d = gg.input.down, dx = ember.x - p.x, dy = ember.y - p.y; ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach((k) => d.delete(k));
      if (Math.hypot(dx, dy) > 8) { if (dx > 8) d.add('KeyD'); if (dx < -8) d.add('KeyA'); if (dy > 8) d.add('KeyS'); if (dy < -8) d.add('KeyW'); }
      mouseOnPlayer(gg); p.hp = Math.max(p.hp, p.maxHp * 0.5);
    },
    ...caption('ยอดเขาฟรอสต์พีค', 'ยิ่งสูง ยิ่งหนาว — คว้าถ่านอุ่นไว้ให้รอด'),
  });
  releaseInput(g);
}
Object.assign(PARTS, { mechHook, mechFireflies, mechWater, mechVaults, mechBlizzard, mechDarkness, mechAltitude, mechEnd: endCard(6, ['สำรวจ · ไขปริศนา · เอาตัวรอด', 'ทุกแมพมีความลับของมัน']) });
export const MECH_PARTS = ['mechHook', 'mechFireflies', 'mechWater', 'mechVaults', 'mechBlizzard', 'mechDarkness', 'mechAltitude', 'mechEnd'];
