import { StatusSet } from '../status/status.js';
import { TEAM } from './constants.js';

let NEXT_ID = 1;

// Base for anything that can be hit: player, monsters, boss, breakable world objects.
export class Entity {
  constructor(x, y) {
    this.id = NEXT_ID++;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.kx = 0; this.ky = 0; // knockback velocity
    this.radius = 10;
    this.team = TEAM.ENEMY;
    this.hp = 1; this.maxHp = 1;
    this.dead = false;
    this.flash = 0;
    this.facing = 0;
    this.status = new StatusSet();
    this.height = 40; // visual height for damage numbers / bars
    this.hurtable = true;
    this.mass = 1;
  }
  get alive() { return !this.dead; }
  knockback(angle, force) {
    const f = force / this.mass;
    this.kx += Math.cos(angle) * f;
    this.ky += Math.sin(angle) * f;
  }
  // integrate knockback with friction; returns true if any movement happened
  applyKnockback(dt, map) {
    if (Math.abs(this.kx) < 1 && Math.abs(this.ky) < 1) { this.kx = this.ky = 0; return false; }
    map.moveCircle(this, this.kx * dt, this.ky * dt);
    const fr = Math.exp(-10 * dt);
    this.kx *= fr; this.ky *= fr;
    return true;
  }
}
