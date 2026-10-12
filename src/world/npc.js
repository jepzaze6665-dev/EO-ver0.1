import { npcSprite } from '../monsters/monsterSprites.js';
import { rand, TAU } from '../core/math.js';
import { Assets } from '../core/assets.js';
import { NPC_ART } from '../data/npcArt.js';
import { CLASS_MASTERS } from '../data/classMasters.js';
import { CLASS_TREE } from '../data/classTree.js';

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
    this.art = Assets.npcs && Assets.npcs[def.art || NPC_ART[def.id]]; // painted strip, else the canvas figure
    this.face = 'front'; // art view: front / back / left / right
    this.moving = false;
    this.flip = false;
    this.t = rand(0, 3);
    this.target = null;
    this.wait = rand(1, 4);
    this.secret = def.secret || 0;
    this.radius = 8;
    this.hidden = false;
  }
  faceTo(p) { this.flip = p.x < this.x; this.face = viewToward(p.x - this.x, p.y - this.y); this.talkT = 3; }
  hasNews() {
    return this.game.quests.npcHasNews(this.id) || this.masterNews(); // quest data decides (giver / turn-in), not the NPC
  }
  // a class master (data/classMasters.js) shows "!" when it can start a class quest for you (Quest Q2-Q4)
  masterNews() {
    const m = CLASS_MASTERS[this.id], g = this.game, p = g.player, pr = g.progression;
    if (!m || !p || !pr || p.cls.id !== m.line) return false;
    if (Object.values(pr.trials).some((t) => t.state === 'active' && CLASS_TREE[t.node] && CLASS_TREE[t.node].parent === m.line)) return false;
    return pr.paths().some((x) => x.ready && !x.unlocked && x.trial && x.trial.state !== 'passed');
  }
  update(dt) {
    this.t += dt;
    this.talkT = Math.max(0, (this.talkT || 0) - dt);
    this.moving = false;
    if (this.talkT <= 0 && !this.wander) this.face = 'front';
    if (!this.wander || this.talkT > 0) return;
    if (this.target) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
      if (d < 2) { this.target = null; this.wait = rand(2, 5); return; }
      this.x += (dx / d) * 30 * dt; this.y += (dy / d) * 30 * dt;
      this.flip = dx < 0;
      this.face = viewToward(dx, dy);
      this.moving = true;
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
    if (this.art) return this.drawArt(ctx);
    const s = this.sprite;
    const fr = s.idle[Math.floor(this.t * 1.6) % 2];
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 9, 3.5, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    if (this.flip) ctx.scale(-1, 1);
    ctx.drawImage(fr, -s.ax, -s.ay);
    ctx.restore();
    this.drawNews(ctx, 58);
  }
  drawNews(ctx, h) {
    if (this.hasNews()) {
      const b = Math.sin(this.t * 4) * 2;
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y - h + b), 3, 8);
      ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y - h + 10 + b), 3, 3);
    }
  }
  // painted strip (front, back, left, right, walk1, walk2): walking toward the camera alternates walk1 / walk2, other
  // walks and the idle breathe with a small bob
  drawArt(ctx) {
    const a = this.art, F = a.frames;
    let k = F.indexOf(this.face);
    if (this.moving && this.face === 'front') k = F.indexOf(Math.floor(this.t * 5) % 2 ? 'walk1' : 'walk2');
    const bob = this.moving ? -Math.abs(Math.sin(this.t * 10)) * 1.5 : Math.sin(this.t * 2) * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 11, 4, 0, 0, TAU); ctx.fill();
    ctx.drawImage(a.img, k * a.cw, 0, a.cw, a.ch, Math.round(this.x - a.ax), Math.round(this.y - a.ay + bob), a.cw, a.ch);
    this.drawNews(ctx, a.ch + 2);
  }
}

// which art view looks along (dx, dy)
function viewToward(dx, dy) {
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? 'front' : 'back';
  return dx < 0 ? 'left' : 'right';
}
