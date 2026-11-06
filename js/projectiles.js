// Enemy fireballs: straight-flying sprites that explode on walls, ground or the player.
import * as THREE from '../lib/three.module.js';
import { FIREBALL } from './config.js';
import { sfx } from './audio.js';

export class Fireballs {
  constructor(scene, texture, world, particles) {
    this.scene = scene;
    this.texture = texture;
    this.world = world;
    this.particles = particles;
    this.items = [];
    this._eye = new THREE.Vector3();
  }

  spawn(from, target, volume = 1) {
    const vel = target.clone().sub(from).normalize().multiplyScalar(FIREBALL.speed);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthWrite: false, fog: false }));
    sprite.scale.setScalar(0.9);
    sprite.position.copy(from);
    this.scene.add(sprite);
    this.items.push({ sprite, vel, life: FIREBALL.lifetime });
    sfx.fireball(volume);
  }

  update(dt, time, player) {
    const eye = player.eye(this._eye);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const fb = this.items[i], p = fb.sprite.position;
      fb.life -= dt;
      p.addScaledVector(fb.vel, dt);
      fb.sprite.scale.setScalar(0.85 + Math.sin(time * 40 + i) * 0.12);

      let hit = false;
      if (player.alive && p.distanceTo(eye) < FIREBALL.hitRadius) { player.hurt(FIREBALL.damage); hit = true; }
      else if (p.y < this.world.heightAt(p.x, p.z) || this.world.insideWall(p)) hit = true;

      if (hit) {
        this.particles.burst(p, 0xff8a20, 8, 3);
        sfx.explode(player.volumeAt(p));
      }
      if (hit || fb.life <= 0) this._remove(i);
    }
  }

  clear() { for (let i = this.items.length - 1; i >= 0; i--) this._remove(i); }

  _remove(i) {
    const fb = this.items[i];
    this.scene.remove(fb.sprite);
    fb.sprite.material.dispose();
    this.items.splice(i, 1);
  }
}
