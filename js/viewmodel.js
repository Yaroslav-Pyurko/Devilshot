// First-person weapon: a procedural chrome double-barrel shotgun rendered in its own pass.
//
// The gun lives in a separate scene with its own camera and is drawn after the world
// with the depth buffer cleared, so it never clips into walls (standard FPS "viewmodel").
import * as THREE from '../lib/three.module.js';
import { VIEWMODEL } from './config.js';
import { reduceMotion } from './utils.js';

// ---------- materials ----------

// Small studio-like environment for reflections: chrome is only as good as what it reflects.
function createEnvironment(renderer) {
  const env = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 32, 16), p = g.attributes.position, cols = [];
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / 10; // -1 bottom .. 1 top
    // mostly neutral studio greys so chrome reads as chrome, with a faint warm bias from the hellish sky
    const sky = new THREE.Color(0.9, 0.88, 0.86), horizon = new THREE.Color(0.32, 0.27, 0.25), ground = new THREE.Color(0.05, 0.04, 0.04);
    const c = t > 0 ? horizon.clone().lerp(sky, Math.pow(t, 0.6)) : horizon.clone().lerp(ground, Math.pow(-t, 0.5));
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  env.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  // bright "softbox" panels give the chrome its crisp highlight streaks
  const panel = (w, h, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(7, 1.4, 0xffffff, 0, 7, -3);
  panel(1.6, 6, 0xf4f0ea, -7, 2, 2);
  panel(3, 3, 0xffb070, 6, 1, -5);   // one warm panel = glow of the fiery world

  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#5a2c14'; g.fillRect(0, 0, 512, 128);
  // grain: wavy dark and light streaks along the length
  for (let i = 0; i < 90; i++) {
    const y0 = Math.random() * 128, amp = 2 + Math.random() * 5, freq = 0.005 + Math.random() * 0.01, ph = Math.random() * 6;
    g.strokeStyle = Math.random() < 0.6 ? `rgba(40,16,6,${0.15 + Math.random() * 0.35})` : `rgba(150,82,40,${0.15 + Math.random() * 0.3})`;
    g.lineWidth = 0.6 + Math.random() * 2.2;
    g.beginPath();
    for (let x = 0; x <= 512; x += 8) g.lineTo(x, y0 + Math.sin(x * freq + ph) * amp);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.5, 7); // extrusion UVs are in metres, so tile the grain densely
  t.anisotropy = 4;
  return t;
}

function createMaterials(envMap) {
  const wood = woodTexture();
  return {
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.1, envMap, envMapIntensity: 1.3 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x6c7078, metalness: 1, roughness: 0.32, envMap, envMapIntensity: 1 }),
    blued: new THREE.MeshStandardMaterial({ color: 0x23262c, metalness: 0.9, roughness: 0.38, envMap, envMapIntensity: 0.8 }),
    bore: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd8a84a, metalness: 1, roughness: 0.25, envMap }),
    wood: new THREE.MeshPhysicalMaterial({ map: wood, color: 0xffffff, roughness: 0.55, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.25, envMap, envMapIntensity: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x18120f, roughness: 0.9 })
  };
}

// ---------- geometry helpers ----------

// Box with rounded long edges: rounded-rect cross-section (w x h) extruded along Z by `len`.
function roundedBox(w, h, len, r, bevel = 0.003) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: len - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -len / 2 + bevel);
  return g;
}

// Cylinder lying along Z.
function tube(r, len, seg = 32, rTop = r) {
  const g = new THREE.CylinderGeometry(rTop, r, len, seg, 1);
  g.rotateX(Math.PI / 2);
  return g;
}

// Side-profile shape (s = distance backwards, y = up) extruded to `thick` across X.
function profile(points, thick, bevel = 0.004) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 12 });
  g.translate(0, 0, -thick / 2 + bevel);
  g.rotateY(-Math.PI / 2); // shape X (backwards) -> world +Z, extrusion -> world X
  return g;
}

// ---------- the shotgun ----------
// Units are metres. Origin = centre of the receiver, barrels point to -Z.

function buildShotgun(m) {
  const gun = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); gun.add(mesh); return mesh; };

  const BARREL_R = 0.0175, BARREL_LEN = 0.62, BX = 0.0182, BY = 0.012;
  const front = -0.06, muzzleZ = front - BARREL_LEN;

  // receiver (action) and its darker side plates
  add(roundedBox(0.068, 0.062, 0.13, 0.012), m.chrome, 0, -0.004, 0.005);
  add(roundedBox(0.07, 0.03, 0.09, 0.008), m.steel, 0, -0.012, 0.012);
  // screws on both side plates
  for (const sx of [-0.0352, 0.0352]) {
    for (const [sy, sz] of [[-0.004, -0.025], [-0.018, 0.04], [0.012, 0.045]]) {
      const screw = add(new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 16), m.brass, sx, sy, sz);
      screw.rotation.z = Math.PI / 2;
    }
  }
  // hinge pin
  const pin = add(tube(0.009, 0.074, 20), m.steel, 0, -0.028, front + 0.008);
  pin.rotation.y = Math.PI / 2;
  // top lever and safety
  const lever = add(roundedBox(0.012, 0.008, 0.05, 0.003, 0.0015), m.chrome, 0.012, 0.03, 0.05);
  lever.rotation.y = -0.35;
  add(roundedBox(0.01, 0.006, 0.018, 0.0025, 0.001), m.blued, 0, 0.029, 0.03);

  // barrels side by side, with a breech step and a muzzle band
  for (const sx of [-BX, BX]) {
    add(tube(BARREL_R, BARREL_LEN), m.chrome, sx, BY, front - BARREL_LEN / 2);
    add(tube(BARREL_R * 1.12, 0.07), m.chrome, sx, BY, front - 0.035);       // thicker chamber end
    add(tube(BARREL_R * 1.06, 0.018), m.steel, sx, BY, muzzleZ + 0.009);     // muzzle band
    add(tube(BARREL_R * 0.72, 0.004), m.bore, sx, BY, muzzleZ - 0.0005);     // dark bore
  }
  // rib between the barrels on top, and the lower filler rib
  add(roundedBox(0.012, 0.006, BARREL_LEN, 0.002, 0.001), m.steel, 0, BY + BARREL_R * 0.95, front - BARREL_LEN / 2);
  add(roundedBox(0.01, 0.012, BARREL_LEN - 0.12, 0.002, 0.001), m.blued, 0, BY - BARREL_R * 0.8, front - (BARREL_LEN - 0.12) / 2 - 0.12);
  // front bead sight
  add(new THREE.SphereGeometry(0.0035, 16, 12), m.brass, 0, BY + BARREL_R + 0.006, muzzleZ + 0.012);

  // wooden fore-end under the barrels, with a steel latch
  add(roundedBox(0.058, 0.032, 0.21, 0.013), m.wood, 0, BY - 0.025, front - 0.14);
  add(roundedBox(0.018, 0.006, 0.03, 0.002, 0.001), m.chrome, 0, BY - 0.047, front - 0.04);

  // trigger guard and trigger
  const guard = add(new THREE.TorusGeometry(0.022, 0.0035, 10, 24, Math.PI * 1.1), m.chrome, 0, -0.04, 0.035);
  guard.rotation.set(0, Math.PI / 2, Math.PI * 0.95);
  const trigger = add(roundedBox(0.006, 0.026, 0.006, 0.002, 0.001), m.steel, 0, -0.048, 0.032);
  trigger.rotation.x = 0.35;

  // stock with a pistol-grip wrist (side profile, s = backwards from the receiver)
  const stock = add(profile([
    [0.06, 0.024],
    [0.2, 0.012, 0.42, -0.006],
    [0.43, -0.012],
    [0.43, -0.12],
    [0.3, -0.112, 0.18, -0.072],
    [0.14, -0.06, 0.12, -0.082],
    [0.1, -0.09, 0.075, -0.066],
    [0.062, -0.034]
  ], 0.046), m.wood, 0, 0, 0);
  stock.position.z = 0.005;
  add(roundedBox(0.048, 0.11, 0.014, 0.008, 0.002), m.rubber, 0, -0.066, 0.443); // butt pad

  // muzzle point (in gun space) for the flash
  gun.userData.muzzles = [new THREE.Vector3(-BX, BY, muzzleZ - 0.02), new THREE.Vector3(BX, BY, muzzleZ - 0.02)];
  return gun;
}

// ---------- viewmodel controller ----------

export class ViewModel {
  constructor(renderer, fireTexture) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(VIEWMODEL.fov, innerWidth / innerHeight, 0.01, 10);

    const envMap = createEnvironment(renderer);
    this.materials = createMaterials(envMap);

    // lighting tuned to match the hellish world: warm key from above, dim red fill from below
    this.scene.add(new THREE.HemisphereLight(0xfff0e6, 0x2a0c06, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(-1, 2, 1);
    this.scene.add(key);
    this.flashLight = new THREE.PointLight(0xffb050, 0, 1.6, 2);
    this.scene.add(this.flashLight);

    this.root = new THREE.Group();   // animated: bob, sway, recoil
    this.gun = buildShotgun(this.materials);
    this.root.add(this.gun);
    this.scene.add(this.root);

    this.flashes = this.gun.userData.muzzles.map(p => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.position.copy(p);
      s.visible = false;
      this.gun.add(s);
      return s;
    });

    this.sway = new THREE.Vector2();
    this.lastYaw = null;
    this.lastPitch = 0;
    this.kick = 0;        // spring-driven recoil, 0 = rest
    this.kickVel = 0;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt, player, weapon) {
    // look sway: the gun lags behind fast mouse movement, then settles
    if (this.lastYaw === null) { this.lastYaw = player.yaw; this.lastPitch = player.pitch; }
    const dYaw = player.yaw - this.lastYaw, dPitch = player.pitch - this.lastPitch;
    this.lastYaw = player.yaw; this.lastPitch = player.pitch;
    const S = VIEWMODEL.swayAmount;
    this.sway.x = THREE.MathUtils.clamp(this.sway.x + dYaw * S, -0.04, 0.04);
    this.sway.y = THREE.MathUtils.clamp(this.sway.y + dPitch * S, -0.04, 0.04);
    const settle = 1 - Math.exp(-dt * 9);
    this.sway.multiplyScalar(1 - settle);

    // recoil spring: a shot injects velocity, the spring pulls back to rest
    if (weapon.justFired) { this.kickVel += VIEWMODEL.recoilImpulse; weapon.justFired = false; }
    const k = 160, damp = 16;
    this.kickVel += (-k * this.kick - damp * this.kickVel) * dt;
    this.kick += this.kickVel * dt;

    // walk bob: figure-eight, damped when standing or airborne
    const moving = player.ground ? 1 : 0.2;
    const bobAmt = reduceMotion ? 0 : VIEWMODEL.bobAmount * moving;
    const bx = Math.cos(player.bob * 0.5) * bobAmt;
    const by = -Math.abs(Math.sin(player.bob * 0.5)) * bobAmt * 0.7;

    const [px, py, pz] = VIEWMODEL.position;
    this.root.position.set(px + bx - this.sway.x * 0.6, py + by + this.sway.y * 0.4 - this.kick * 0.02, pz + this.kick * 0.09);
    this.root.rotation.set(this.sway.y * 0.5 + this.kick * 0.35, VIEWMODEL.yaw + this.sway.x, -this.sway.x * 0.8);

    // muzzle flash
    const flashing = weapon.flash > 0;
    for (const f of this.flashes) {
      f.visible = flashing;
      if (flashing) {
        f.material.rotation = Math.random() * Math.PI * 2;
        f.scale.setScalar(0.09 + Math.random() * 0.05);
      }
    }
    this.flashLight.intensity = flashing ? 3 : 0;
    if (flashing) this.flashLight.position.set(this.root.position.x, this.root.position.y + 0.05, this.root.position.z - 0.5);
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
