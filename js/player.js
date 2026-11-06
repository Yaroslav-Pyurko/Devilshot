// Player state, first-person movement, gravity and damage.
import * as THREE from '../lib/three.module.js';
import { ARENA, PLAYER } from './config.js';
import { clamp } from './utils.js';
import { sfx } from './audio.js';

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.onDeath = () => {};
    this.reset();
  }

  reset() {
    const { x, z } = PLAYER.start;
    this.pos.set(x, this.world.heightAt(x, z), z);
    this.vy = 0;
    this.ground = true;
    this.yaw = 0;
    this.pitch = 0;
    this.hp = PLAYER.maxHp;
    this.ammo = PLAYER.startAmmo;
    this.kills = 0;
    this.alive = true;
    this.bob = 0;        // walk cycle phase, drives head and weapon bob
    this.hurtFlash = 0;  // seconds of red screen left
  }

  eye(out) { return out.set(this.pos.x, this.pos.y + PLAYER.eyeHeight, this.pos.z); }

  look(dx, dy) {
    this.yaw -= dx * PLAYER.mouseSensitivity;
    this.pitch = clamp(this.pitch - dy * PLAYER.mouseSensitivity, -PLAYER.maxPitch, PLAYER.maxPitch);
  }

  update(dt, input) {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (!this.alive) return;

    const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let mx = -sy * f + cy * s, mz = -cy * f - sy * s;
    const len = Math.hypot(mx, mz);
    const speed = input.down('ShiftLeft') || input.down('ShiftRight') ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (len > 0) {
      mx /= len; mz /= len;
      this.world.slide(this.pos, mx * speed * dt, mz * speed * dt, PLAYER.radius);
      this.bob += dt * speed * 1.1;
    }
    this.pos.x = clamp(this.pos.x, -ARENA.limit, ARENA.limit);
    this.pos.z = clamp(this.pos.z, -ARENA.limit, ARENA.limit);

    const g = this.world.heightAt(this.pos.x, this.pos.z);
    if (this.ground && input.down('Space')) { this.vy = PLAYER.jumpSpeed; this.ground = false; }
    this.vy -= PLAYER.gravity * dt;
    this.pos.y += this.vy * dt;
    // Snap to the ground when landing or walking down a slope.
    if (this.pos.y <= g || (this.ground && this.pos.y - g < 0.5 && this.vy <= 0)) {
      this.pos.y = g; this.vy = 0; this.ground = true;
    } else this.ground = false;
  }

  hurt(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtFlash = 0.45;
    sfx.playerHurt();
    if (this.hp <= 0) {
      this.alive = false;
      sfx.death();
      this.onDeath();
    }
  }

  // 0..1 loudness for a sound at point p.
  volumeAt(p) { return clamp(1 - p.distanceTo(this.pos) / 60, 0.08, 1); }
}
