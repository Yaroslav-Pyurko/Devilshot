// Procedural pixel-art textures drawn on canvases. Swap these for image files later.
import * as THREE from '../lib/three.module.js';
import { seededRandom } from './utils.js';

function canvasTexture(w, h, draw, nearest = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; }
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function drawGround(g, rnd) {
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = 0.75 + rnd() * 0.25;
    g.fillStyle = `rgb(${(150 * v) | 0},${(118 * v) | 0},${(92 * v) | 0})`;
    g.fillRect(x, y, 1, 1);
  }
  g.fillStyle = 'rgba(40,20,10,0.5)';
  for (let i = 0; i < 9; i++) {
    let x = rnd() * 64, y = rnd() * 64;
    for (let k = 0; k < 14; k++) { g.fillRect(x | 0, y | 0, 1, 1); x += rnd() * 2 - 0.6; y += rnd() * 2 - 1; }
  }
}

function drawBricks(g, rnd) {
  g.fillStyle = '#231c18'; g.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 8 : 0;
    for (let col = -1; col < 4; col++) {
      const x = col * 16 + off, y = row * 8, v = 0.8 + rnd() * 0.3;
      g.fillStyle = `rgb(${(108 * v) | 0},${(102 * v) | 0},${(88 * v) | 0})`;
      g.fillRect(x + 1, y + 1, 14, 6);
      g.fillStyle = 'rgba(255,240,210,0.12)'; g.fillRect(x + 1, y + 1, 14, 1);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 1, y + 6, 14, 1);
    }
  }
  g.fillStyle = 'rgba(90,20,10,0.35)';
  for (let i = 0; i < 40; i++) g.fillRect(rnd() * 64 | 0, 40 + rnd() * 24 | 0, 1, 2 + rnd() * 6 | 0);
}

// 32x32 imp. Frames: walk1, walk2, attack, pain, dead.
function drawImp(g, frame) {
  const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const C = { skin: '#8a3f1f', dark: '#5a2412', light: '#b45a2c', horn: '#e0d2a8', eye: '#ffd83a', mouth: '#1a0505', claw: '#ece2c8', gore: '#7a0a06' };
  if (frame === 'dead') {
    r(4, 25, 24, 6, C.dark); r(7, 22, 18, 4, C.skin); r(10, 21, 3, 2, C.horn); r(19, 21, 3, 2, C.horn);
    r(5, 29, 5, 3, C.gore); r(20, 28, 8, 3, C.gore); r(13, 23, 2, 1, '#6a5a1a');
    return;
  }
  const up = frame === 'attack';
  const la = frame === 'walk2' ? 2 : 0, lb = frame === 'walk1' ? 2 : 0;
  r(10, 22, 4, 10 - la, C.dark); r(18, 22, 4, 10 - lb, C.dark);
  r(9, 31 - la, 6, 1, C.claw); r(17, 31 - lb, 6, 1, C.claw);
  r(8, 11, 16, 12, C.skin); r(10, 12, 12, 8, C.light); r(8, 20, 16, 3, C.dark);
  r(12, 14, 2, 4, C.skin); r(18, 14, 2, 4, C.skin);
  if (up) {
    r(3, 4, 4, 10, C.skin); r(25, 4, 4, 10, C.skin); r(2, 2, 6, 2, C.claw); r(24, 2, 6, 2, C.claw);
    r(13, 0, 6, 2, '#ffb43a');
  } else {
    r(4, 12, 4, 10, C.skin); r(24, 12, 4, 10, C.skin); r(3, 21, 6, 2, C.claw); r(23, 21, 6, 2, C.claw);
  }
  r(11, 3, 10, 9, C.skin); r(12, 4, 8, 2, C.light);
  r(9, 2, 2, 4, C.horn); r(8, 0, 2, 3, C.horn); r(21, 2, 2, 4, C.horn); r(22, 0, 2, 3, C.horn);
  r(13, 6, 2, 2, C.eye); r(17, 6, 2, 2, C.eye);
  if (up) { r(13, 8, 6, 3, C.mouth); r(14, 8, 1, 1, C.claw); r(17, 8, 1, 1, C.claw); }
  else r(14, 9, 4, 1, C.mouth);
  if (frame === 'pain') {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(0, 0, 32, 32);
    g.globalCompositeOperation = 'source-over';
  }
}

export function createTextures() {
  const rnd = seededRandom(7);

  const ground = canvasTexture(64, 64, g => drawGround(g, rnd));
  ground.repeat.set(48, 48);

  const wall = canvasTexture(64, 64, g => drawBricks(g, rnd));

  const imp = {};
  for (const f of ['walk1', 'walk2', 'attack', 'pain', 'dead']) imp[f] = canvasTexture(32, 32, g => drawImp(g, f));

  const dot = canvasTexture(8, 8, g => { g.fillStyle = '#fff'; g.fillRect(2, 0, 4, 8); g.fillRect(0, 2, 8, 4); });

  const fire = canvasTexture(32, 32, g => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.3, '#ffd040');
    gr.addColorStop(0.65, '#ff5a10'); gr.addColorStop(1, 'rgba(120,10,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  }, false);

  return { ground, wall, imp, dot, fire };
}
