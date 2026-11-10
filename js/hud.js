// HUD: crosshair on a native-resolution canvas, plus the DOM status bar.
// The weapon itself is a 3D model (js/viewmodel.js).

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
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(innerWidth * this.dpr);
    this.canvas.height = Math.round(innerHeight * this.dpr);
    this._drawCrosshair(0);
  }

  update(dt, player, weapon, enemy) {
    this._drawCrosshair(weapon.recoil);
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

  // Four short lines with a centre gap that opens up briefly after each shot.
  _drawCrosshair(recoil) {
    const g = this.ctx, d = this.dpr;
    const w = this.canvas.width, h = this.canvas.height, cx = w / 2, cy = h / 2;
    g.clearRect(0, 0, w, h);
    const gap = (5 + recoil * 6) * d, len = 7 * d;
    g.lineCap = 'round';
    for (const [stroke, width] of [['rgba(0,0,0,0.6)', 4 * d], ['#ffe2a8', 2 * d]]) {
      g.strokeStyle = stroke; g.lineWidth = width;
      g.beginPath();
      g.moveTo(cx - gap - len, cy); g.lineTo(cx - gap, cy);
      g.moveTo(cx + gap, cy); g.lineTo(cx + gap + len, cy);
      g.moveTo(cx, cy - gap - len); g.lineTo(cx, cy - gap);
      g.moveTo(cx, cy + gap); g.lineTo(cx, cy + gap + len);
      g.stroke();
    }
  }
}
