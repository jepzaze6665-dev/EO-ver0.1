import { npcSprite } from '../monsters/monsterSprites.js';
import { rand, TAU } from '../core/math.js';

// Town / field NPCs. Lightweight: idle bob, optional wandering, faces the player when talked to.
export class NPC {
  constructor(game, def) {
    this.game = game;
    this.id = def.id;
    this.name = def.name;
    this.role = def.role;
    this.x = def.x; this.y = def.y;
    this.home = { x: def.x, y: def.y };
    this.wander = (def.wander || 0) * 32;
    this.sprite = npcSprite(def.look);
    this.flip = false;
    this.t = rand(0, 3);
    this.target = null;
    this.wait = rand(1, 4);
    this.secret = def.secret || 0;
    this.radius = 8;
    this.hidden = false;
  }
  faceTo(p) { this.flip = p.x < this.x; this.talkT = 3; }
  hasNews() {
    const g = this.game, q = g.quests;
    if (this.id === 'elder') return !q.isActive('whispers') && !q.isDone('whispers');
    if (this.id === 'guide') return !q.isActive('first_steps') && !q.isDone('first_steps');
    return false;
  }
  update(dt) {
    this.t += dt;
    this.talkT = Math.max(0, (this.talkT || 0) - dt);
    if (!this.wander || this.talkT > 0) return;
    if (this.target) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
      if (d < 2) { this.target = null; this.wait = rand(2, 5); return; }
      this.x += (dx / d) * 30 * dt; this.y += (dy / d) * 30 * dt;
      this.flip = dx < 0;
    } else {
      this.wait -= dt;
      if (this.wait <= 0) {
        const a = rand(0, TAU), r = rand(0, this.wander);
        const x = this.home.x + Math.cos(a) * r, y = this.home.y + Math.sin(a) * r;
        if (!this.game.world.map.circleBlocked(x, y, 8)) this.target = { x, y };
        else this.wait = 1;
      }
    }
  }
  draw(ctx) {
    const s = this.sprite;
    const fr = s.idle[Math.floor(this.t * 1.6) % 2];
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 9, 3.5, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    if (this.flip) ctx.scale(-1, 1);
    ctx.drawImage(fr, -s.ax, -s.ay);
    ctx.restore();
    if (this.hasNews()) {
      const b = Math.sin(this.t * 4) * 2;
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y - 58 + b), 3, 8);
      ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y - 48 + b), 3, 3);
    }
  }
}
