// Hitscan shotgun: cooldown, ammo, raycast, muzzle flash and recoil state for the HUD.
import * as THREE from '../lib/three.module.js';
import { WEAPON } from './config.js';
import { sfx } from './audio.js';

export class Weapon {
  constructor(camera, world, particles) {
    this.camera = camera;
    this.world = world;
    this.particles = particles;
    this.ray = new THREE.Raycaster();
    this.ray.far = WEAPON.range;
    // Light is created once with intensity 0: adding/removing lights forces shader recompiles.
    this.muzzleLight = new THREE.PointLight(0xffc070, 0, 20);
    this.muzzleLight.position.set(0, 0, -1);
    camera.add(this.muzzleLight);
    this.reset();
  }

  reset() {
    this.cooldown = 0;
    this.flash = 0;   // seconds the muzzle flash stays visible
    this.recoil = 0;  // 0..1, kicks the gun sprite down
  }

  update(dt) {
    this.cooldown -= dt;
    this.flash -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 30);
  }

  // Targets are objects that implement { sprite, alive, takeDamage(n) }.
  tryFire(player, targets) {
    if (this.cooldown > 0 || !player.alive) return;
    if (player.ammo <= 0) { sfx.empty(); this.cooldown = 0.3; return; }

    player.ammo--;
    this.cooldown = WEAPON.cooldown;
    this.flash = 0.07;
    this.recoil = 1;
    this.muzzleLight.intensity = 3.5;
    sfx.shot();

    const s = WEAPON.spread;
    this.ray.setFromCamera({ x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s }, this.camera);
    const live = targets.filter(t => t.alive);
    const hits = this.ray.intersectObjects([...this.world.solids, ...live.map(t => t.sprite)], false);
    if (!hits.length) return;

    const hit = hits[0];
    const target = live.find(t => t.sprite === hit.object);
    if (target) {
      target.takeDamage(WEAPON.damage);
      this.particles.burst(hit.point, 0xb01010, 7, 3);
    } else {
      this.particles.burst(hit.point, 0xa89878, 5, 1.6);
    }
  }
}
