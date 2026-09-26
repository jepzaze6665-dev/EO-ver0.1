import { Entity } from '../core/entity.js';
import { TEAM } from '../core/constants.js';
import { TAU } from '../core/math.js';

// TRAINING DUMMY — a stationary target for testing any class on the shared combat core.
// Takes damage through the normal pipeline (damage numbers, hit stop, events), shows HP,
// DPS and marks, "dies", then resets itself. It never attacks.
const RESET_AFTER = 4;   // seconds without being hit -> back to full HP
const RESPAWN_AFTER = 1.5;

export class TrainingDummy extends Entity {
  constructor(game, x, y, opts = {}) {
    super(x, y);
    this.game = game;
    this.type = 'training_dummy';
    this.name = opts.name || 'Training Dummy';
    this.team = TEAM.ENEMY;
    this.maxHp = this.hp = opts.hp || 3000;
    this.defense = opts.defense ?? 0;
    this.weakness = opts.weakness || [];
    this.radius = 12;
    this.height = 44;
    this.mass = 1e6;          // immovable
    this.superArmor = true;
    this.isDummy = true;
    this.sinceHit = 99;
    this.respawnT = 0;
    this.hits = [];           // [time, amount] for the DPS meter (bounded, see onHurt)
    this.dps = 0;
    this.wobble = 0;
  }

  onHurt(amount) {
    this.sinceHit = 0;
    this.wobble = 1;
    this.hits.push([this.game.time, amount]);
    if (this.hits.length > 200) this.hits.splice(0, this.hits.length - 200);
  }
  onDeath() {
    this.dead = true;
    this.respawnT = RESPAWN_AFTER;
    this.game.vfx.burst(this.x, this.y - 24, '#d8c090', 24, 140);
  }
  reset() {
    this.dead = false;
    this.hp = this.maxHp;
    this.hits.length = 0;
    this.dps = 0;
    this.status.clear();
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.wobble = Math.max(0, this.wobble - dt * 3);
    this.status.update(dt);
    if (this.dead) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.reset();
      return;
    }
    this.sinceHit += dt;
    if (this.sinceHit > RESET_AFTER && (this.hp < this.maxHp || this.hits.length)) this.reset();
    // DPS over the last 5 seconds
    const now = this.game.time;
    let sum = 0, first = now;
    for (const [t, a] of this.hits) if (now - t <= 5) { sum += a; first = Math.min(first, t); }
    this.dps = sum ? Math.round(sum / Math.max(1, now - first)) : 0;
    this.kx = this.ky = 0;
  }

  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y, 13, 5, 0, 0, TAU); ctx.fill();
    if (this.dead) { ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 2, y - 10, 4, 10); return; }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(this.game.time * 30) * 0.12 * this.wobble);
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(-2, -44, 4, 44);          // post
    ctx.fillStyle = '#4a3018'; ctx.fillRect(-12, -32, 24, 3);           // arms
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#c8a868';             // straw body
    ctx.beginPath(); ctx.ellipse(0, -26, 9, 12, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#0b0a12'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#b08a50';
    ctx.beginPath(); ctx.arc(0, -42, 6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#a02030'; ctx.lineWidth = 1.5;                   // target rings
    ctx.beginPath(); ctx.arc(0, -26, 5, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#a02030'; ctx.fillRect(-1, -27, 2, 2);
    ctx.restore();
  }
}
