// Wires all systems together and runs the main loop.
import * as THREE from '../lib/three.module.js';
import { RENDER, PLAYER, WEAPON } from './config.js';
import { reduceMotion } from './utils.js';
import { unlockAudio } from './audio.js';
import { createTextures } from './textures.js';
import { World } from './world.js';
import { Particles } from './particles.js';
import { Fireballs } from './projectiles.js';
import { Player } from './player.js';
import { Weapon } from './weapon.js';
import { Imp } from './enemy.js';
import { Hud } from './hud.js';
import { ViewModel } from './viewmodel.js';
import { Input } from './input.js';
import { Overlay } from './overlay.js';

const $ = id => document.getElementById(id);

export class Game {
  constructor() {
    this.playing = false;
    this.time = 0;
    this.lastFrame = performance.now();

    this._initRenderer();
    const textures = createTextures(this.renderer);

    this.world = new World(this.scene, textures);
    this.particles = new Particles(this.scene, textures.dot);
    this.fireballs = new Fireballs(this.scene, textures.fire, this.world, this.particles);
    this.player = new Player(this.world);
    this.weapon = new Weapon(this.camera, this.world, this.particles);
    this.enemy = new Imp(this.scene, this.world, this.fireballs, this.player);
    this.enemies = [this.enemy]; // add more imps here later; weapon already takes a list
    this.viewModel = new ViewModel(this.renderer, textures.fire);

    this.hud = new Hud($('hud'), { hp: $('hp'), ammo: $('ammo'), kills: $('kills'), ai: $('ai'), fps: $('fps'), flash: $('flash') });
    this.overlay = new Overlay({ root: $('overlay'), title: $('ovTitle'), text: $('ovText'), button: $('goBtn'), sens: $('sens'), sensValue: $('sensValue'), lang: $('lang') });
    this.input = new Input(this.renderer.domElement);

    this._wireEvents();
    addEventListener('resize', () => this._resize());
    this._resize();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this._pixelRatio());
    this.renderer.autoClear = false; // world and weapon are drawn in two passes
    $('stage').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(RENDER.fogColor, RENDER.fogNear, RENDER.fogFar);
    this.scene.background = new THREE.Color(RENDER.fogColor);

    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 500);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.scene.add(new THREE.HemisphereLight(0xffc8a0, 0x2a0e06, 0.75));
    const sun = new THREE.DirectionalLight(0xffa070, 0.85);
    sun.position.set(40, 60, 20);
    this.scene.add(sun);
  }

  _wireEvents() {
    const { input, overlay, player } = this;

    overlay.onActivate = () => {
      unlockAudio();
      if (!player.alive) this.reset();
      input.requestLock();
    };

    input.onLockChange = locked => {
      if (locked) { overlay.hide(); this._setPlaying(true); }
      else if (player.alive) this._pause('pause');
      else this._pause('dead');
    };
    input.onPauseRequested = () => this._pause('pause');
    input.onLook = (dx, dy) => player.look(dx, dy);
    input.onFirePressed = () => this.weapon.tryFire(player, this.enemies);

    player.onDeath = () => {
      this._pause('dead');
      input.exitLock();
    };
    this.enemy.onKilled = () => {
      player.kills++;
      player.ammo += WEAPON.ammoPerKill;
    };
  }

  _setPlaying(on) {
    this.playing = on;
    this.input.enabled = on;
    if (!on) this.input.releaseAll();
  }

  _pause(kind) {
    this._setPlaying(false);
    this.overlay.show(kind, { kills: this.player.kills });
  }

  reset() {
    this.player.reset();
    this.weapon.reset();
    this.fireballs.clear();
    this.particles.clear();
    for (const e of this.enemies) e.reset();
  }

  // Native resolution, capped so 4K / high-DPI screens keep a steady frame rate.
  _pixelRatio() { return Math.min(devicePixelRatio || 1, RENDER.maxPixelRatio); }

  _resize() {
    this.renderer.setPixelRatio(this._pixelRatio());
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    // Three.js takes a vertical FOV; derive it so the horizontal FOV stays fixed.
    const h = THREE.MathUtils.degToRad(RENDER.fovHorizontal);
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / this.camera.aspect));
    this.camera.updateProjectionMatrix();
    if (this.viewModel) this.viewModel.resize(this.camera.aspect);
    this.hud.resize();
  }

  start() {
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.update(dt);
      this.render(dt);
    };
    requestAnimationFrame(loop);
  }

  update(dt) {
    this.weapon.update(dt);
    if (!this.playing) { this.player.hurtFlash = Math.max(0, this.player.hurtFlash - dt); return; }
    this.time += dt;
    this.player.update(dt, this.input);
    if (this.input.fireHeld) this.weapon.tryFire(this.player, this.enemies);
    for (const e of this.enemies) e.update(dt);
    this.fireballs.update(dt, this.time, this.player);
    this.particles.update(dt);
  }

  render(dt) {
    const p = this.player;
    // head bob scales with actual speed, so it fades in and out with acceleration
    const speedK = Math.min(1, p.speed / PLAYER.runSpeed);
    const headBob = reduceMotion || !p.ground ? 0 : Math.sin(p.bob) * PLAYER.headBob * speedK;
    this.camera.position.set(p.pos.x, p.pos.y + PLAYER.eyeHeight + headBob + p.landOffset, p.pos.z);
    this.camera.rotation.set(p.pitch, p.yaw, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.viewModel.update(dt, p, this.weapon);
    this.viewModel.render(this.renderer);
    this.hud.update(dt, p, this.weapon, this.enemy);
  }
}
