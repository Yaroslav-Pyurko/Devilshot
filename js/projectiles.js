// Enemy fireballs: straight-flying sprites that explode on walls, ground or the player.
import * as THREE from '../lib/three.module.js';
import { FIREBALL } from './config.js';
import { sfx, Voice, Roar } from './audio.js';

export class Fireballs {
  constructor(scene, texture, world, particles) {
    this.scene = scene;
    this.texture = texture;
    this.world = world;
    this.particles = particles;
    this.items = [];
    this._eye = new THREE.Vector3();
    this._toBall = new THREE.Vector3();
  }

  spawn(from, target, volume = 1) {
    const vel = target.clone().sub(from).normalize().multiplyScalar(FIREBALL.speed);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthWrite: false, fog: false }));
    sprite.scale.setScalar(0.9);
    sprite.position.copy(from);
    this.scene.add(sprite);
    // Three sounds per fireball: launch at the imp's hand, a synthesized roar that flies with the ball, a hit.
    if (Voice.has('fireballLaunch') && this._player) {
      const { volume: v, pan } = this._player.hear(from, FIREBALL.soundRange);
      new Voice('fireballLaunch', FIREBALL.launchVolume * v, pan);
    } else sfx.fireball(volume);   // samples not loaded yet: old synthesized whoosh
    const voice = new Roar(0);   // volume, pan and pitch follow the ball (updateAudio)
    this.items.push({ sprite, vel, life: FIREBALL.lifetime, voice });
  }

  // Called every rendered frame: each ball's sound follows its position; muted while paused.
  updateAudio(player, audible) {
    this._player = player;   // remembered so spawn() can place the launch sound
    for (const fb of this.items) {
      const p = fb.sprite.position;
      const { volume, pan } = player.hear(p, FIREBALL.soundRange);
      // Doppler: pitch rises while the ball comes at you and drops once it has flown past
      const d = this._toBall.subVectors(p, player.pos), len = d.length() || 1;
      const approach = -fb.vel.dot(d) / len / FIREBALL.speed;   // +1 straight at you, -1 straight away
      fb.voice.set(audible ? FIREBALL.flightVolume * volume : 0, pan, 1 + FIREBALL.doppler * approach);
    }
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
        if (Voice.has('fireballHit')) {
          const { volume: v, pan } = player.hear(p, FIREBALL.soundRange);
          new Voice('fireballHit', FIREBALL.hitVolume * Math.max(v, 0.04), pan);   // a faint thud even far away
        } else sfx.explode(player.volumeAt(p));
      }
      if (hit || fb.life <= 0) this._remove(i);
    }
  }

  clear() { for (let i = this.items.length - 1; i >= 0; i--) this._remove(i); }

  _remove(i) {
    const fb = this.items[i];
    fb.voice.stop();
    this.scene.remove(fb.sprite);
    fb.sprite.material.dispose();
    this.items.splice(i, 1);
  }
}
