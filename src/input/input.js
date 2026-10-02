// Keyboard + mouse state with per-frame "pressed" edges and a short input buffer,
// so an attack or dodge pressed slightly early still comes out (responsive feel).
const BUFFER_TIME = 0.16;

export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressedKeys = new Set();
    this.buffer = new Map(); // action -> remaining time
    this.mouse = { x: 0, y: 0, left: false, right: false, leftPressed: false, rightPressed: false };
    this.enabled = true;
    this.lastKey = null;

    window.addEventListener('keydown', (e) => {
      // typing in a text field (online name on the title screen) is not game input
      const el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const k = normKey(e);
      if (['Space', 'Tab', 'F1'].includes(k) || (e.ctrlKey && k === 'KeyS')) e.preventDefault();
      if (!this.down.has(k)) this.pressedKeys.add(k);
      this.down.add(k);
      this.lastKey = k;
    });
    window.addEventListener('keyup', (e) => this.down.delete(normKey(e)));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouse.left = this.mouse.right = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(k) { return this.enabled && this.down.has(k); }
  pressed(k) { return this.enabled && this.pressedKeys.has(k); }

  // Called once per rendered frame after the fixed updates consumed the edges.
  endFrame() {
    this.pressedKeys.clear();
    this.mouse.leftPressed = false;
    this.mouse.rightPressed = false;
  }

  // Buffered actions: pushed on press, consumed by gameplay when possible.
  pushBuffer(action) { this.buffer.set(action, BUFFER_TIME); }
  consume(action) {
    if (this.buffer.has(action)) { this.buffer.delete(action); return true; }
    return false;
  }
  peek(action) { return this.buffer.has(action); }
  tickBuffer(dt) {
    for (const [k, t] of this.buffer) {
      if (t - dt <= 0) this.buffer.delete(k);
      else this.buffer.set(k, t - dt);
    }
  }
  clearAll() {
    this.buffer.clear();
    this.pressedKeys.clear();
    this.mouse.leftPressed = this.mouse.rightPressed = false;
  }

  moveVector() {
    let x = 0, y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    const l = Math.hypot(x, y);
    return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
  }
}

function normKey(e) {
  return e.code || e.key;
}
