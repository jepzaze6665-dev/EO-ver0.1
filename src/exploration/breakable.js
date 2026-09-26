import { Entity } from '../core/entity.js';
import { TEAM } from '../core/constants.js';
import { rand } from '../core/math.js';

// Attackable world objects: cracked cave wall, glyph wall, bramble, corrupted totem.
// They sit in the same hurt list as monsters, so every class skill can break them.
export class Breakable extends Entity {
  constructor(game, x, y, opts) {
    super(x, y);
    this.game = game;
    this.team = TEAM.ENEMY;
    this.kind = opts.kind;
    this.maxHp = this.hp = opts.hp || 60;
    this.radius = opts.radius || 20;
    this.height = opts.height || 40;
    this.mass = 1000;
    this.superArmor = true;
    this.defense = 0;
    this.isBreakable = true;
    this.onBreak = opts.onBreak;
    this.canHit = opts.canHit || (() => true);
    this.prop = opts.prop || null;
    this.label = opts.label || '';
  }
  get hurtable() { return !this.dead && this.canHit(); }
  set hurtable(v) {}
  onHurt(amount) {
    const g = this.game;
    g.vfx.shards(this.x, this.y - this.height * 0.5, this.kind === 'bramble' ? '#4a3a24' : '#8a7aa0', 6, 120);
    g.camera.shake(0.08);
    if (this.prop) this.prop.shakeT = 0.15;
  }
  onDeath() {
    this.dead = true;
    const g = this.game;
    g.vfx.shards(this.x, this.y - this.height * 0.5, this.kind === 'bramble' ? '#5a4a2a' : '#6a5a80', 30, 220);
    g.vfx.burst(this.x, this.y - 20, this.kind === 'crack' ? '#c080ff' : this.kind === 'glyph' ? '#5af0ff' : '#b0a070', 24, 160);
    g.camera.shake(0.4);
    g.audio.sfx('rubble');
    if (this.onBreak) this.onBreak();
  }
  update() {}
  draw() {}
}
