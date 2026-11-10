// The imp: an original low-poly demon built from primitives, with a procedural skeleton.
//
// Design: hunched and sinewy, digitigrade legs, long arms with bone claws, an elongated
// skull with swept-back horns, spines down the back, charred skin with glowing lava cracks.
// Faceted (flat shaded) on purpose: crisp low-poly silhouette in the Quake 3 spirit.
//
// Orientation: the model faces +Z, Y is up, the origin sits on the ground between the feet.
import * as THREE from '../lib/three.module.js';

const TAU = Math.PI * 2;
const ease = t => t * t * (3 - 2 * t); // smoothstep 0..1

// ---------- textures ----------

function skinTextures() {
  const S = 256;
  const base = document.createElement('canvas'), glow = document.createElement('canvas');
  base.width = base.height = glow.width = glow.height = S;
  const b = base.getContext('2d'), g = glow.getContext('2d');

  // charred hide: dark base with reddish-brown blotches and fine speckle
  b.fillStyle = '#2b1712'; b.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 4 + Math.random() * 22;
    const gr = b.createRadialGradient(x, y, 0, x, y, r);
    const c = Math.random() < 0.6 ? '110,48,30' : '24,12,10';
    gr.addColorStop(0, `rgba(${c},${0.25 + Math.random() * 0.3})`); gr.addColorStop(1, `rgba(${c},0)`);
    b.fillStyle = gr; b.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 3000; i++) {
    b.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`;
    b.fillRect(Math.random() * S, Math.random() * S, 1, 1);
  }

  // lava cracks: branching random walks, drawn dark on the hide and bright on the glow map
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const crack = (x, y, a, len, w, depth) => {
    const pts = [[x, y]];
    for (let i = 0; i < len; i++) {
      a += (Math.random() - 0.5) * 0.9;
      x += Math.cos(a) * 3; y += Math.sin(a) * 3;
      pts.push([x, y]);
      if (depth < 2 && Math.random() < 0.06) crack(x, y, a + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.6), len * 0.5, w * 0.6, depth + 1);
    }
    for (const [ctx, color, lw, blur] of [[b, '#120604', w + 1.5, 0], [g, '#c83a0c', w + 1, 4], [g, '#ffb050', w * 0.4, 0]]) {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = ctx.lineJoin = 'round';
      if (blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
      ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke();
      ctx.restore();
    }
  };
  for (let i = 0; i < 6; i++) crack(Math.random() * S, Math.random() * S, Math.random() * TAU, 14 + Math.random() * 18, 0.7 + Math.random() * 0.6, 0);

  const mk = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  return { map: mk(base), emissiveMap: mk(glow) };
}

function createMaterials() {
  const { map, emissiveMap } = skinTextures();
  return {
    skin: new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xff4a10, emissiveIntensity: 1.0, roughness: 0.78, metalness: 0, flatShading: true }),
    bone: new THREE.MeshStandardMaterial({ color: 0xcfc2a2, roughness: 0.55, metalness: 0, flatShading: true }),
    boneDark: new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.6, flatShading: true }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffc23a }),
    mouth: new THREE.MeshBasicMaterial({ color: 0x3a0503 }),
    fire: new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  };
}

// ---------- geometry helpers (low radial counts = faceted look) ----------

// Limb segment hanging from its joint: top at the pivot, extends along -Y.
const LIMB_THICKNESS = 1.3; // one knob for how sinewy vs. bony the imp looks

function limbDown(rTop, rBot, len, sides = 6) {
  const g = new THREE.CylinderGeometry(rTop * LIMB_THICKNESS, rBot * LIMB_THICKNESS, len, sides, 1);
  g.translate(0, -len / 2, 0);
  return g;
}
// Segment growing upward from its joint.
function limbUp(rBot, rTop, len, sides = 6) {
  const g = new THREE.CylinderGeometry(rTop * LIMB_THICKNESS, rBot * LIMB_THICKNESS, len, sides, 1);
  g.translate(0, len / 2, 0);
  return g;
}
function blob(r, sx = 1, sy = 1, sz = 1, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.scale(sx, sy, sz);
  return g;
}
// Cone with its base at the origin, pointing along +Y.
function spike(r, len, sides = 5) {
  const g = new THREE.ConeGeometry(r, len, sides, 1);
  g.translate(0, len / 2, 0);
  return g;
}

function joint(parent, x, y, z, rx = 0, ry = 0, rz = 0) {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  j.rotation.set(rx, ry, rz);
  parent.add(j);
  return j;
}
function mesh(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

// ---------- the rig ----------

export class ImpRig {
  constructor(height = 1.9) {
    this.m = createMaterials();
    this.root = new THREE.Group();   // world position + facing (set by the enemy)
    this.body = new THREE.Group();   // auto-fit scale, death fall
    this.root.add(this.body);
    this.j = {};                     // joints by name
    this._build();
    this._fit(height);
    this.rest = {};
    for (const [k, j] of Object.entries(this.j)) this.rest[k] = { rot: j.rotation.clone(), pos: j.position.clone() };
    this.time = Math.random() * 10;
    this.handFire = this._makeHandFire();
  }

  _build() {
    const { m, j } = this;
    const skin = m.skin, bone = m.bone;

    j.hips = joint(this.body, 0, 1.0, 0);
    mesh(j.hips, blob(0.14, 1.35, 0.8, 0.95), skin);

    // spine leans forward: the hunch
    j.spine = joint(j.hips, 0, 0.04, -0.02, 0.5);
    mesh(j.spine, limbUp(0.12, 0.15, 0.3, 7), skin);
    j.chest = joint(j.spine, 0, 0.28, 0);
    mesh(j.chest, blob(0.21, 1.2, 1.0, 0.82), skin, 0, 0.12, 0.01);
    mesh(j.chest, blob(0.12, 1.5, 0.6, 0.7), skin, 0, 0.0, 0.07);          // gaunt belly/rib line
    // spines down the back, biggest at the shoulders
    [[0.26, 0.11, 0.035], [0.17, 0.09, 0.03], [0.07, 0.07, 0.025]].forEach(([y, len, r]) =>
      mesh(j.chest, spike(r, len), bone, 0, y, -0.15, -1.15));
    mesh(j.spine, spike(0.022, 0.06), bone, 0, 0.14, -0.12, -1.25);

    // neck and head, tilted back up so the face looks forward despite the hunch
    j.neck = joint(j.chest, 0, 0.3, 0.05, -0.55);
    mesh(j.neck, limbUp(0.065, 0.05, 0.12, 6), skin);
    j.head = joint(j.neck, 0, 0.12, 0.02, 0.05);
    mesh(j.head, blob(0.115, 0.85, 0.9, 1.45), skin, 0, 0.05, 0.07);        // long skull
    mesh(j.head, blob(0.08, 1.25, 0.45, 0.9), skin, 0, 0.1, 0.12);          // heavy brow
    mesh(j.head, blob(0.07, 0.9, 0.8, 0.9), skin, 0, 0.08, -0.06);          // back of the skull
    for (const sx of [-1, 1]) {
      mesh(j.head, blob(0.019, 1.3, 0.7, 0.6, 0), m.eye, sx * 0.045, 0.072, 0.19);
      // cheek bones
      mesh(j.head, blob(0.035, 0.7, 0.6, 1.4, 0), skin, sx * 0.07, 0.03, 0.12);
      // horns: two segments sweeping back and up
      const h1 = joint(j.head, sx * 0.06, 0.13, 0.02, -1.0, 0, -sx * 0.45);
      mesh(h1, spike(0.032, 0.15, 6), bone);
      const h2 = joint(h1, 0, 0.14, 0, -0.55, 0, -sx * 0.15);
      mesh(h2, spike(0.019, 0.14, 5), bone);
    }
    // upper teeth along the front of the snout
    for (let i = -2; i <= 2; i++) mesh(j.head, spike(0.008, 0.035, 4), bone, i * 0.018, 0.0, 0.205 - Math.abs(i) * 0.012, Math.PI);
    // jaw hinges below the skull
    j.jaw = joint(j.head, 0, 0.0, 0.0, 0.12);
    mesh(j.jaw, blob(0.085, 0.95, 0.4, 1.55), skin, 0, -0.03, 0.08);
    mesh(j.jaw, blob(0.05, 1.1, 0.3, 1.2, 0), m.mouth, 0, -0.006, 0.12);
    for (let i = -2; i <= 2; i++) mesh(j.jaw, spike(0.007, 0.03, 4), bone, i * 0.017, -0.012, 0.19 - Math.abs(i) * 0.012);

    // arms: long, hanging forward of the body
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      const sh = joint(j.chest, sx * 0.25, 0.2, 0.0);
      mesh(sh, blob(0.075, 1.1, 0.9, 1), skin);
      const ua = j['upperArm' + side] = joint(sh, 0, 0, 0, -0.75, 0, sx * 0.2);
      mesh(ua, limbDown(0.06, 0.042, 0.4), skin);
      mesh(ua, blob(0.07, 0.9, 1.6, 0.9), skin, 0, -0.14, 0.01);            // bicep
      const fa = j['forearm' + side] = joint(ua, 0, -0.4, 0, -0.55);
      mesh(fa, limbDown(0.048, 0.034, 0.42), skin);
      mesh(fa, blob(0.055, 0.85, 1.7, 0.85), skin, 0, -0.11, 0);             // forearm muscle
      mesh(fa, spike(0.014, 0.07), bone, 0, -0.06, -0.035, -2.3);            // elbow spur
      const hand = j['hand' + side] = joint(fa, 0, -0.42, 0, -0.2);
      mesh(hand, blob(0.045, 1.15, 0.6, 1.3), skin, 0, -0.03, 0.01);
      for (let f = -1; f <= 1; f++) {
        const fj = joint(hand, f * 0.028, -0.04, 0.03, -0.5 - Math.abs(f) * 0.1, 0, f * 0.25);
        mesh(fj, limbDown(0.012, 0.01, 0.05, 5), skin);
        mesh(fj, spike(0.011, 0.075, 4), bone, 0, -0.05, 0, Math.PI - 0.35);  // curved bone claw
      }
      j['handTip' + side] = joint(hand, 0, -0.12, 0.05);
    }

    // digitigrade legs: thigh forward, shin back, long foot, clawed toes
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      const th = j['thigh' + side] = joint(j.hips, sx * 0.13, -0.02, 0, -0.6, 0, sx * 0.05);
      mesh(th, limbDown(0.085, 0.06, 0.42, 7), skin);
      mesh(th, blob(0.095, 1, 1.8, 1.05), skin, 0, -0.16, 0.015);            // quad muscle
      const kn = j['shin' + side] = joint(th, 0, -0.42, 0, 1.4);
      mesh(kn, limbDown(0.052, 0.036, 0.4), skin);
      mesh(kn, blob(0.055, 0.9, 1.8, 0.9), skin, 0, -0.1, -0.01);              // calf
      const an = j['foot' + side] = joint(kn, 0, -0.4, 0, -1.0);
      mesh(an, limbDown(0.036, 0.03, 0.3), skin);
      const toes = j['toes' + side] = joint(an, 0, -0.3, 0, -1.15);
      for (let f = -1; f <= 1; f++) {
        const t = joint(toes, f * 0.03, 0, 0, 0, 0, f * 0.3);
        mesh(t, limbDown(0.016, 0.012, 0.08, 5), skin);
        mesh(t, spike(0.012, 0.06, 4), bone, 0, -0.08, 0, Math.PI - 0.4);
      }
      mesh(an, spike(0.014, 0.06), m.boneDark, 0, -0.29, -0.03, -2.4);       // dew claw
    }
  }

  // Scale the rest pose to the requested height and stand it on y = 0.
  _fit(height) {
    this.body.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.body);
    const s = height / (box.max.y - box.min.y);
    this.body.scale.setScalar(s);
    this.baseY = -box.min.y * s;
    this.body.position.y = this.baseY;
    this.height = height;
  }

  _makeHandFire() {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 1), this.m.fire);
    f.visible = false;
    this.j.handTipR.add(f);
    return f;
  }

  // World position of the throwing hand, where fireballs start.
  handWorldPosition(out) { return this.j.handTipR.getWorldPosition(out); }

  /**
   * Pose the skeleton for this frame.
   * s = { dt, walkPhase, moveSpeed, attackT (0..1 or -1), meleeT, painT, deadT (seconds since death or -1) }
   */
  update(s) {
    const { j, rest } = this;
    this.time += s.dt;
    for (const [k, r] of Object.entries(rest)) { j[k].rotation.copy(r.rot); j[k].position.copy(r.pos); }
    const t = this.time;
    const walk = Math.min(1, s.moveSpeed / 3);       // 0 idle .. 1 full stride
    const ph = s.walkPhase * 2.4;                    // stride cycle
    const idle = 1 - walk;

    // --- locomotion ---
    for (const [side, off] of [['L', 0], ['R', Math.PI]]) {
      const p = ph + off, sw = Math.sin(p), lift = Math.max(0, Math.cos(p));
      j['thigh' + side].rotation.x -= sw * 0.5 * walk;
      j['shin' + side].rotation.x += lift * 0.55 * walk;
      j['foot' + side].rotation.x -= lift * 0.35 * walk;
      j['toes' + side].rotation.x += (sw > 0 ? 0 : -sw * 0.3) * walk;
      // arms swing against the legs; idle arms hang and twitch a little
      j['upperArm' + (side === 'L' ? 'R' : 'L')].rotation.x -= sw * 0.4 * walk;
      j['forearm' + side].rotation.x -= (0.15 + 0.15 * Math.sin(p + 1)) * walk;
    }
    j.hips.position.y -= Math.abs(Math.sin(ph)) * 0.035 * walk;
    j.hips.rotation.y += Math.sin(ph) * 0.12 * walk;
    j.spine.rotation.z += Math.sin(ph) * 0.05 * walk;
    j.spine.rotation.x += 0.1 * walk;                                 // lean into the run
    // idle: breathing, slow head scan, claws flexing
    const breath = Math.sin(t * 2.2);
    j.chest.rotation.x += breath * 0.03 * idle;
    j.head.rotation.y += Math.sin(t * 0.7) * 0.35 * idle;
    j.head.rotation.x += Math.sin(t * 1.3) * 0.05;
    j.jaw.rotation.x += (0.05 + Math.max(0, Math.sin(t * 0.9)) * 0.12) * idle;
    j.upperArmL.rotation.z += Math.sin(t * 1.1) * 0.05 * idle;
    j.upperArmR.rotation.z -= Math.sin(t * 1.2 + 1) * 0.05 * idle;

    // --- fireball throw (right arm): wind up over the head, then whip forward ---
    this.handFire.visible = false;
    if (s.attackT >= 0) {
      const a = s.attackT;
      const up = a < 0.45 ? ease(a / 0.45) : 1 - ease(Math.min(1, (a - 0.45) / 0.2));
      const fwd = a < 0.45 ? 0 : a < 0.65 ? ease((a - 0.45) / 0.2) : 1 - ease((a - 0.65) / 0.35);
      j.upperArmR.rotation.x += up * 3.4 - fwd * 1.0;   // arm swings back and up over the head
      j.upperArmR.rotation.z -= up * 0.25;
      j.forearmR.rotation.x -= up * 0.6;
      j.chest.rotation.y += up * 0.35 - fwd * 0.45;
      j.spine.rotation.x -= up * 0.2 - fwd * 0.25;
      j.jaw.rotation.x += 0.35 * Math.max(up, fwd);
      this.handFire.visible = a < 0.47;
      this.handFire.scale.setScalar(0.6 + up * 0.8 + Math.sin(t * 40) * 0.1);
    }

    // --- melee swipe with both claws ---
    if (s.meleeT >= 0) {
      const a = s.meleeT;
      const raise = a < 0.35 ? ease(a / 0.35) : 0;
      const slash = a < 0.35 ? 0 : 1 - ease((a - 0.35) / 0.65);
      for (const side of ['L', 'R']) {
        j['upperArm' + side].rotation.x += raise * 1.9 - slash * 0.6;
        j['forearm' + side].rotation.x -= raise * 0.6;
      }
      j.spine.rotation.x += slash * 0.25;
      j.jaw.rotation.x += 0.4 * (raise + slash);
    }

    // --- flinch when hit ---
    if (s.painT > 0) {
      const k = Math.sin(Math.PI * Math.min(1, s.painT));
      j.spine.rotation.x -= k * 0.4;
      j.head.rotation.x -= k * 0.35;
      j.upperArmL.rotation.x += k * 0.5;
      j.upperArmR.rotation.x += k * 0.5;
      j.jaw.rotation.x += k * 0.4;
    }
    this.m.skin.emissiveIntensity = s.deadT >= 0
      ? Math.max(0, 1.0 - s.deadT * 0.5)                                   // cracks cool down after death
      : 0.9 + Math.sin(t * 3) * 0.2 + (s.painT > 0 ? 2.5 * s.painT : 0);    // pulse, flare on hit
    this.m.eye.color.setHex(s.deadT >= 0 ? 0x2a1608 : 0xffc23a);

    // --- death: collapse backwards and lie on the ground ---
    if (s.deadT >= 0) {
      const d = ease(Math.min(1, s.deadT / 0.7));
      this.body.rotation.x = -d * Math.PI * 0.48;
      this.body.position.y = this.baseY * (1 - d) + d * 0.12;
      this.body.position.z = -d * 0.35;
      // limbs go slack: legs half straighten, arms flop out to the sides
      j.thighL.rotation.x += d * 0.4; j.thighR.rotation.x += d * 0.5;
      j.shinL.rotation.x -= d * 0.7; j.shinR.rotation.x -= d * 0.9;
      j.upperArmL.rotation.x += d * 0.75; j.upperArmR.rotation.x += d * 0.75;
      j.upperArmL.rotation.z += d * 1.25; j.upperArmR.rotation.z -= d * 1.35;
      j.forearmL.rotation.x += d * 0.45; j.forearmR.rotation.x += d * 0.3;
      j.head.rotation.x -= d * 0.5; j.jaw.rotation.x += d * 0.5;
    } else {
      this.body.rotation.x = 0;
      this.body.position.y = this.baseY;
      this.body.position.z = 0;
    }
  }
}
