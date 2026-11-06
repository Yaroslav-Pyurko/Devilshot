// Short-lived sprite particles: bullet puffs, blood, explosion sparks.
import * as THREE from '../lib/three.module.js';
import { clamp } from './utils.js';

export class Particles {
  constructor(scene, texture) {
    this.scene = scene;
    this.texture = texture;
    this.items = [];
  }

  burst(point, color, count, spread) {
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, color, transparent: true }));
      sprite.scale.setScalar(0.12 + Math.random() * 0.1);
      sprite.position.copy(point);
      this.scene.add(sprite);
      this.items.push({
        sprite,
        life: 0.35 + Math.random() * 0.2,
        vel: new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * spread, (Math.random() - 0.5) * spread)
      });
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      p.vel.y -= 6 * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.material.opacity = clamp(p.life * 3, 0, 1);
      if (p.life <= 0) this._remove(i);
    }
  }

  clear() { for (let i = this.items.length - 1; i >= 0; i--) this._remove(i); }

  _remove(i) {
    const p = this.items[i];
    this.scene.remove(p.sprite);
    p.sprite.material.dispose();
    this.items.splice(i, 1);
  }
}
