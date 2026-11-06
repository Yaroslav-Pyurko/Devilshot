// HUD: pixel-art weapon and crosshair on a low-res canvas, plus the DOM status bar.
import { reduceMotion } from './utils.js';

const HUD_WIDTH = 320; // logical pixels; the canvas is upscaled with nearest-neighbour

export class Hud {
  constructor(canvas, els) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.els = els; // { hp, ammo, kills, ai, fps, flash }
    this.statusTimer = 0;
    this.fpsTime = 0;
    this.fpsFrames = 0;
    this.resize();
  }

  resize() {
    this.w = HUD_WIDTH;
    this.h = Math.max(160, Math.round(HUD_WIDTH * innerHeight / innerWidth));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  update(dt, player, weapon, enemy) {
    this._draw(player, weapon);
    this.els.flash.style.opacity = (player.hurtFlash * 0.9).toFixed(2);

    this.statusTimer -= dt;
    if (this.statusTimer <= 0) {
      this.statusTimer = 0.1;
      this.els.hp.textContent = player.hp;
      this.els.hp.classList.toggle('warn', player.hp <= 50 && player.hp > 25);
      this.els.ammo.textContent = player.ammo;
      this.els.kills.textContent = player.kills;
      this.els.ai.textContent = enemy.statusLabel;
    }

    this.fpsTime += dt; this.fpsFrames++;
    if (this.fpsTime >= 0.5) {
      this.els.fps.textContent = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsTime = 0; this.fpsFrames = 0;
    }
  }

  _draw(player, weapon) {
    const g = this.ctx, w = this.w, h = this.h;
    g.clearRect(0, 0, w, h);
    const r = (x, y, rw, rh, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), rw, rh); };

    // crosshair
    const cx = w / 2, cy = h / 2;
    r(cx - 5, cy, 3, 1, '#ffd88a'); r(cx + 3, cy, 3, 1, '#ffd88a');
    r(cx, cy - 5, 1, 3, '#ffd88a'); r(cx, cy + 3, 1, 3, '#ffd88a');

    // weapon position with walk bob and recoil
    const bx = reduceMotion ? 0 : Math.cos(player.bob * 0.5) * 5;
    const by = reduceMotion ? 0 : Math.abs(Math.sin(player.bob * 0.5)) * 4;
    const gx = cx + 18 + bx, gy = h - 34 + by + weapon.recoil * 14;

    if (weapon.flash > 0) {
      g.fillStyle = '#ff9a20'; g.beginPath();
      g.moveTo(gx - 16, gy - 62); g.lineTo(gx, gy - 92); g.lineTo(gx + 16, gy - 62); g.lineTo(gx, gy - 54); g.fill();
      g.fillStyle = '#fff3a8'; g.beginPath();
      g.moveTo(gx - 8, gy - 62); g.lineTo(gx, gy - 80); g.lineTo(gx + 8, gy - 62); g.lineTo(gx, gy - 58); g.fill();
    }
    // double barrel
    r(gx - 8, gy - 62, 16, 3, '#18181c');
    r(gx - 7, gy - 59, 6, 30, '#3a3a42'); r(gx + 1, gy - 59, 6, 30, '#3a3a42');
    r(gx - 6, gy - 59, 2, 30, '#6c6c78'); r(gx + 2, gy - 59, 2, 30, '#6c6c78');
    // wooden pump
    r(gx - 11, gy - 36, 22, 11, '#7a4a22'); r(gx - 11, gy - 36, 22, 2, '#a06a34'); r(gx - 11, gy - 30, 22, 1, '#5a3418');
    // receiver
    r(gx - 13, gy - 25, 26, 40, '#2a2a30'); r(gx - 13, gy - 25, 26, 3, '#4c4c56');
    // hands
    r(gx - 24, gy - 33, 13, 10, '#c88a62'); r(gx - 24, gy - 25, 13, 2, '#8a5a3c');
    r(gx + 9, gy - 14, 14, 18, '#c88a62'); r(gx + 9, gy - 14, 14, 2, '#e0a882'); r(gx + 9, gy - 2, 14, 2, '#8a5a3c');
  }
}
