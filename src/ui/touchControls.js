// MOBILE M1 — on-screen touch controls (landscape). A DOM layer over the canvas that writes the SAME input the keyboard /
// mouse do (input/input.js), so no game system knows about touch:
//   left half of the screen : a floating JOYSTICK appears where the thumb lands -> input.touchMove (analog)
//   ATK (big, bottom right) : hold = basic attacks (mouse.left)
//   1-4 + ULT (arc round ATK): TAP = cast at the auto-aim target; DRAG then release = cast toward the drag direction
//   Q                        : the special (guard classes: hold = guard)
//   DODGE                    : Space (direction = the joystick, else the aim)
//   E (bottom centre)        : appears only near something to use / a downed teammate; hold = revive
//   potion, ≡ menu, bag      : R / Escape / I
// AUTO-AIM every frame: the current target, else the nearest foe within TOUCH_RULES.autoAim px, else the way you walk.
// Shown on touch devices ('(pointer: coarse)'), or with ?touch in the URL; ?notouch hides it. Hidden while a window is open.
import { skillIconURL } from './icons.js';

export const TOUCH_RULES = { stick: 62, dead: 0.18, drag: 22, autoAim: 460 };

const CSS = `
#touch{position:fixed;inset:0;z-index:40;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none;font-family:var(--font-title,sans-serif)}
#touch.off{display:none}
#touch .zone{position:absolute;left:0;top:18%;width:46%;bottom:0;pointer-events:auto}
#touch .base,#touch .knob{position:absolute;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);display:none}
#touch .base{width:130px;height:130px;border:2px solid rgba(240,225,200,.35);background:rgba(10,8,18,.25)}
#touch .knob{width:58px;height:58px;background:rgba(240,225,200,.35);border:2px solid rgba(255,240,215,.6)}
#touch .b{position:absolute;pointer-events:auto;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff4e0;
  background:rgba(12,9,20,.55) center/72% no-repeat;border:2px solid rgba(240,225,200,.45);font-size:13px;letter-spacing:1px;text-shadow:0 1px 2px #000}
#touch .b.on{border-color:#ffd27a;background-color:rgba(60,40,10,.6)}
#touch .b .cd{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;background:conic-gradient(rgba(0,0,0,.65) var(--p,0%),transparent 0)}
#touch .atk{width:92px;height:92px;right:4%;bottom:7%;font-size:16px}
#touch .sk,#touch .ult{background-size:cover;overflow:hidden;box-shadow:inset 0 0 0 3px rgba(8,6,14,.85),inset 0 0 10px 4px rgba(0,0,0,.55),0 2px 6px rgba(0,0,0,.6)}
#touch .sk{width:58px;height:58px}
#touch .ult{width:64px;height:64px;border-color:#e8c060}
#touch .q{width:56px;height:56px;border-color:#b98cff;background-size:cover;box-shadow:inset 0 0 0 3px rgba(8,6,14,.85),inset 0 0 10px 4px rgba(0,0,0,.55),0 2px 6px rgba(0,0,0,.6)}
#touch .potion{width:52px;height:52px;font-size:20px;border-color:#ff8a8a}
#touch .dodge{width:56px;height:56px}
#touch .use{width:64px;height:64px;left:50%;bottom:calc(6% + 46px);transform:translateX(-50%);display:none;border-color:#9dffb4}
#touch .use.show{display:flex}
#touch .small{width:42px;height:42px;font-size:16px}
#touch .aimline{position:absolute;height:3px;background:linear-gradient(90deg,rgba(255,210,120,.9),rgba(255,210,120,0));transform-origin:0 50%;display:none;pointer-events:none}
#rotate{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:#07060c;color:#f0e1c8;font:16px sans-serif;text-align:center;padding:24px}
@media (orientation:portrait){body.touch #rotate{display:flex}}
`;

export class TouchControls {
  static wanted() {
    const q = location.search;
    if (/[?&]notouch\b/.test(q)) return false;
    if (/[?&]touch\b/.test(q)) return true;
    // several signals: some phone browsers ("desktop site" mode, some Android browsers) do not report pointer: coarse
    const mm = (s) => !!(window.matchMedia && window.matchMedia(s).matches);
    const ua = navigator.userAgent || '';
    return mm('(pointer: coarse)') || mm('(any-pointer: coarse)') || /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
      || ((navigator.maxTouchPoints || 0) > 0 && mm('(hover: none)'));
  }
  // a real finger on the screen = a phone / tablet, whatever the checks above said: turn the controls on then
  static watch(game) {
    if (/[?&]notouch\b/.test(location.search)) return;
    const on = (e) => { if (e.pointerType && e.pointerType !== 'touch') return; window.removeEventListener('pointerdown', on, true); window.removeEventListener('touchstart', on, true); if (!game.touch) game.touch = new TouchControls(game); };
    window.addEventListener('pointerdown', on, true);
    window.addEventListener('touchstart', on, true);
  }
  constructor(game) {
    this.game = game;
    this.input = game.input;
    this.drag = null;   // { key, x0, y0, angle } a skill button being dragged
    this.stick = null;  // { id, x0, y0 }
    this.build();
  }

  build() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    document.body.classList.add('touch');
    // M2: the first touch asks for fullscreen + a landscape lock (Android Chrome; iOS ignores both — use "Add to Home Screen")
    const full = () => {
      window.removeEventListener('pointerdown', full, true);
      const d = document.documentElement;
      if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
    };
    if (!/[?&]touch\b/.test(location.search)) window.addEventListener('pointerdown', full, true); // not on a desktop test (?touch)
    const rot = document.createElement('div'); rot.id = 'rotate'; rot.textContent = 'Turn your phone sideways to play'; document.body.appendChild(rot);
    const el = this.el = document.createElement('div'); el.id = 'touch';
    el.innerHTML = `<div class="zone"></div><div class="base"></div><div class="knob"></div><div class="aimline"></div>
      <div class="b atk" data-k="atk">ATK</div>
      <div class="b sk" data-k="Digit1"></div><div class="b sk" data-k="Digit2"></div><div class="b sk" data-k="Digit3"></div><div class="b sk" data-k="Digit4"></div>
      <div class="b ult" data-k="Digit5"></div><div class="b q" data-k="KeyQ"></div><div class="b dodge" data-k="Space">DODGE</div>
      <div class="b use" data-k="KeyE">E</div>
      <div class="b small" data-k="Escape" style="left:calc(50% - 48px);top:30px">≡</div>
      <div class="b small" data-k="KeyI" style="left:calc(50% + 6px);top:30px">▣</div>
      <div class="b potion" data-k="KeyR">✚</div>`;
    document.body.appendChild(el);
    this.base = el.querySelector('.base'); this.knob = el.querySelector('.knob'); this.line = el.querySelector('.aimline');
    this.layout();
    window.addEventListener('resize', () => this.layout());
    // joystick
    const zone = el.querySelector('.zone');
    zone.addEventListener('pointerdown', (e) => { e.preventDefault(); try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic / lost pointer */ } this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; this.moveStick(e); });
    zone.addEventListener('pointermove', (e) => { if (this.stick && e.pointerId === this.stick.id) this.moveStick(e); });
    const endStick = (e) => { if (this.stick && e.pointerId === this.stick.id) { this.stick = null; this.input.touchMove = null; this.base.style.display = this.knob.style.display = 'none'; } };
    zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);
    // buttons
    for (const b of el.querySelectorAll('.b')) {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch { /* synthetic / lost pointer */ } this.press(b, e); });
      b.addEventListener('pointermove', (e) => this.dragMove(b, e));
      b.addEventListener('pointerup', (e) => this.release(b, e));
      b.addEventListener('pointercancel', (e) => this.release(b, e, true));
    }
  }
  // the skill buttons sit on an arc to the upper left of ATK (angle 0 = left of it, PI/2 = above it)
  layout() {
    const s = Math.min(1.25, Math.max(0.8, Math.min(innerWidth, innerHeight) / 420));
    const atk = this.el.querySelector('.atk'), ax = innerWidth * 0.04 + 46 * s, ay = innerHeight * 0.05 + 46 * s;
    atk.style.bottom = (innerHeight * 0.05) + 'px';
    atk.style.transform = `scale(${s})`; atk.style.transformOrigin = '100% 100%';
    const put = (sel, ang, r) => { const b = this.el.querySelector(sel); b.style.right = `${ax + Math.cos(ang) * r * s - 29}px`; b.style.bottom = `${ay + Math.sin(ang) * r * s - 29}px`; b.style.transform = `scale(${s})`; };
    // a low, tight arc: every button within reach of the right thumb (owner: skills sat too high)
// owner: buttons spaced apart (inner ring 1-4, outer ring Q / ULT / DODGE / potion)
    put('[data-k=Digit1]', -0.1, 128); put('[data-k=Digit2]', 0.4, 128); put('[data-k=Digit3]', 0.9, 128); put('[data-k=Digit4]', 1.4, 128);
    put('[data-k=KeyQ]', 0.1, 212); put('[data-k=Digit5]', 0.6, 212); put('[data-k=Space]', 1.1, 212); put('[data-k=KeyR]', -0.04, 292); // potion: low, left of Q
  }
  moveStick(e) {
    const s = this.stick, R = TOUCH_RULES.stick;
    let dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    const l = Math.hypot(dx, dy);
    if (l > R) { s.x0 += (dx / l) * (l - R); s.y0 += (dy / l) * (l - R); dx = e.clientX - s.x0; dy = e.clientY - s.y0; } // the base follows a thumb that runs off
    Object.assign(this.base.style, { display: 'block', left: s.x0 + 'px', top: s.y0 + 'px' });
    Object.assign(this.knob.style, { display: 'block', left: s.x0 + dx + 'px', top: s.y0 + dy + 'px' });
    const m = Math.min(1, Math.hypot(dx, dy) / R);
    this.input.touchMove = m < TOUCH_RULES.dead ? null : { x: (dx / R), y: (dy / R) };
  }

  press(b, e) {
    const k = b.dataset.k, inp = this.input;
    b.classList.add('on');
    if (k === 'atk') { inp.mouse.left = true; inp.mouse.leftPressed = true; return; }
    if (/^Digit/.test(k)) { this.drag = { key: k, x0: e.clientX, y0: e.clientY, angle: null }; return; } // fires on release (tap or drag)
    if (k === 'KeyQ' && !(this.game.player && this.game.player.cls.guard)) { inp.touchDown('KeyQ'); return; }
    inp.touchDown(k);
  }
  dragMove(b, e) {
    const d = this.drag;
    if (!d || d.key !== b.dataset.k) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (Math.hypot(dx, dy) < TOUCH_RULES.drag) { d.angle = null; this.line.style.display = 'none'; return; }
    d.angle = Math.atan2(dy, dx);
    // show the aim from the character's place on screen
    const g = this.game, p = g.player, c = g.camera, r = g.renderer;
    const sx = ((p.x - c.left) * c.zoom * r.scale) / r.dpr, sy = ((p.y - 12 - c.top) * c.zoom * r.scale) / r.dpr;
    Object.assign(this.line.style, { display: 'block', left: sx + 'px', top: sy + 'px', width: '160px', transform: `rotate(${d.angle}rad)` });
  }
  release(b, e, cancel = false) {
    const k = b.dataset.k, inp = this.input;
    b.classList.remove('on');
    if (k === 'atk') { inp.mouse.left = false; return; }
    if (/^Digit/.test(k)) {
      const d = this.drag; this.drag = null; this.line.style.display = 'none';
      if (cancel || !d) return;
      if (d.angle !== null) { this.manualAim = d.angle; this.manualT = 0.35; } // the cast goes where it was dragged
      inp.touchDown(k); setTimeout(() => inp.touchUp(k), 60);
      return;
    }
    inp.touchUp(k);
  }

  // every frame (Game.frame): show / hide, auto-aim, cooldowns, the E button
  update(dt) {
    const g = this.game, p = g.player, inp = this.input;
    const on = g.state === 'play' && p && !g.ui.panelOpen;
    this.el.classList.toggle('off', !on);
    if (!on) { inp.aimAngle = null; return; }
    // aim: a dragged skill for a moment, else auto-aim
    if (this.manualT > 0) { this.manualT -= dt; inp.aimAngle = this.manualAim; }
    else inp.aimAngle = this.autoAim(p, g);
    // skill icons + cooldowns (cheap: every 0.1 s)
    this.iconT = (this.iconT || 0) - dt;
    if (this.iconT <= 0) {
      this.iconT = 0.1;
      const binds = p.loadout.bindings(), byKey = Object.fromEntries(binds.map((x) => ['Digit' + x.key, x.skill]));
      for (const b of this.el.querySelectorAll('[data-k^=Digit]')) {
        const s = byKey[b.dataset.k];
        b.style.visibility = s ? 'visible' : 'hidden';
        if (!s) continue;
        if (b.dataset.sid !== s.id) { b.dataset.sid = s.id; b.style.backgroundImage = `url("${skillIconURL(s)}")`; b.innerHTML = '<div class="cd"></div>'; }
        const cd = b.firstChild; if (cd) cd.style.setProperty('--p', Math.round(p.skillSys.cooldowns.ratio(s.id) * 100) + '%');
        const locked = p.skillUnlocked && !p.skillUnlocked(s); // skill tree: not learned yet -> dark with its level
        b.style.filter = locked ? 'grayscale(1) brightness(.45)' : '';
        if (cd) cd.textContent = locked ? `LV ${(s.unlock && s.unlock.classLevel) || ""}` : "";
      }
      const q = this.el.querySelector('[data-k=KeyQ]'), sp = p.cls.special;
      if (sp && q.dataset.sid !== sp.id) { q.dataset.sid = sp.id; q.style.backgroundImage = `url("${skillIconURL(sp)}")`; q.innerHTML = '<div class="cd"></div>'; }
      if (sp && q.firstChild) q.firstChild.style.setProperty('--p', Math.round(p.skillSys.cooldowns.ratio(sp.id) * 100) + '%');
      const use = this.el.querySelector('.use'), w = g.world;
      use.classList.toggle('show', !!(w && w.nearest) || !!(g.party && g.party.downedNear && g.party.downedNear(p)) || !!(g.online && g.online.revive && g.online.revive.target && g.online.revive.target(p)));
    }
  }
  autoAim(p, g) {
    // joystick pushed: face where the thumb points; snap only to a foe inside that 50° cone (player chooses the direction)
    const mv = this.input.touchMove;
    if (mv && (mv.x || mv.y)) {
      const want = Math.atan2(mv.y, mv.x);
      let best = null, bd = TOUCH_RULES.autoAim;
      for (const m of (g.world ? g.world.hostiles() : [])) {
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        const off = Math.abs(Math.atan2(Math.sin(Math.atan2(m.y - p.y, m.x - p.x) - want), Math.cos(Math.atan2(m.y - p.y, m.x - p.x) - want)));
        if (d < bd && off < 0.44) { bd = d; best = m; }
      }
      return best ? Math.atan2(best.y - (best.height ? best.height * 0.4 : 12) - (p.y - 12), best.x - p.x) : want;
    }
    const tgt = g.targets && g.targets.current;
    let best = tgt && !tgt.dead ? tgt : null;
    if (!best && g.world) {
      let bd = TOUCH_RULES.autoAim;
      for (const m of g.world.hostiles()) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; best = m; } }
    }
    if (best) return Math.atan2(best.y - (best.height ? best.height * 0.4 : 12) - (p.y - 12), best.x - p.x);
    return p.aim;
  }
}
