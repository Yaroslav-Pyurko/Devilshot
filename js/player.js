// Player state, first-person movement, gravity and damage.
import * as THREE from '../lib/three.module.js';
import { ARENA, PLAYER } from './config.js';
import { clamp } from './utils.js';
import { sfx } from './audio.js';
import { settings } from './settings.js';
import { BODY_HEIGHT } from './world.js';

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
    this.vel = new THREE.Vector3(); // horizontal velocity lives in x/z
    this.vy = 0;
    this.speed = 0;
    this.ground = true;
    this.landOffset = 0; // camera dip after landing (metres, negative = down)
    this.landVel = 0;
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
    const k = PLAYER.mouseSensitivity * settings.sensitivity;
    this.yaw -= dx * k;
    this.pitch = clamp(this.pitch - dy * k, -PLAYER.maxPitch, PLAYER.maxPitch);
  }

  // Quake 3 style movement (PM_Friction / PM_Accelerate / PM_AirMove), in metres.
  update(dt, input) {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this._updateLanding(dt);
    if (!this.alive) return;

    // wish direction from keys, relative to where we look (flattened to XZ)
    const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * f + cy * s, wz = -cy * f - sy * s;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const wishSpeed = wl > 0 ? (running ? PLAYER.runSpeed : PLAYER.walkSpeed) : 0;

    if (this.ground) {
      this._friction(dt);
      this._accelerate(wx, wz, wishSpeed, PLAYER.groundAccel, dt);
      if (input.down('Space')) { this.vy = PLAYER.jumpSpeed; this.ground = false; }
    } else {
      this._accelerate(wx, wz, wishSpeed, PLAYER.airAccel, dt);
    }

    // move horizontally; hitting a wall kills the velocity into it so we slide along it
    const dx = this.vel.x * dt, dz = this.vel.z * dt, r = PLAYER.radius, feet = this.pos.y;
    this.world.pushOut(this.pos, r);
    if (this.world.blocked(this.pos.x + dx, this.pos.z, r, feet)) this.vel.x = 0; else this.pos.x += dx;
    if (this.world.blocked(this.pos.x, this.pos.z + dz, r, feet)) this.vel.z = 0; else this.pos.z += dz;
    if (Math.abs(this.pos.x) > ARENA.limit) { this.pos.x = clamp(this.pos.x, -ARENA.limit, ARENA.limit); this.vel.x = 0; }
    if (Math.abs(this.pos.z) > ARENA.limit) { this.pos.z = clamp(this.pos.z, -ARENA.limit, ARENA.limit); this.vel.z = 0; }

    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.ground) this.bob += dt * this.speed * 1.1; // step cycle follows actual speed

    // vertical: gravity, head bumps, landing on terrain, ramps and bridges
    const wasGround = this.ground, fallSpeed = this.vy;
    this.vy -= PLAYER.gravity * dt;
    const ceiling = this.world.ceilingAt(this.pos.x, this.pos.z, this.pos.y, PLAYER.radius);
    this.pos.y += this.vy * dt;
    if (this.vy > 0 && this.pos.y + BODY_HEIGHT > ceiling) { this.pos.y = ceiling - BODY_HEIGHT; this.vy = 0; }
    const floor = this.world.floorAt(this.pos.x, this.pos.z, this.pos.y, PLAYER.radius);
    if (this.pos.y <= floor || (this.ground && this.pos.y - floor < 0.5 && this.vy <= 0)) {
      this.pos.y = floor; this.vy = 0; this.ground = true;
      if (!wasGround) this._land(fallSpeed);
    } else this.ground = false;
  }

  // Q3 PM_Friction: slow down proportionally, but never slower than stopSpeed allows.
  _friction(dt) {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed < 0.01) { this.vel.x = this.vel.z = 0; return; }
    const control = Math.max(speed, PLAYER.stopSpeed);
    const k = Math.max(speed - control * PLAYER.friction * dt, 0) / speed;
    this.vel.x *= k; this.vel.z *= k;
  }

  // Q3 PM_Accelerate: only add speed along the wish direction, up to wishSpeed.
  _accelerate(wx, wz, wishSpeed, accel, dt) {
    if (wishSpeed <= 0) return;
    const current = this.vel.x * wx + this.vel.z * wz;
    const add = wishSpeed - current;
    if (add <= 0) return;
    const step = Math.min(accel * wishSpeed * dt, add);
    this.vel.x += step * wx; this.vel.z += step * wz;
  }

  // Camera dip on hard landings: a damped spring, deeper for longer falls.
  _land(fallSpeed) {
    if (!PLAYER.landDip || fallSpeed > -4) return;
    this.landVel -= Math.min(1.2, -fallSpeed * 0.12);
  }

  _updateLanding(dt) {
    const k = 120, damp = 18;
    this.landVel += (-k * this.landOffset - damp * this.landVel) * dt;
    this.landOffset += this.landVel * dt;
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
