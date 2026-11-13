// Terrain, sky, level geometry (walls, concrete bridges and ramps), collision and line-of-sight queries.
//
// Collision is a set of 3D axis-aligned boxes. A box only blocks a body whose vertical span
// overlaps it, so you can walk under a bridge, stand on it, or step onto a low ledge.
// A box may have a sloped top (ramps): its height then changes linearly along one axis.
import * as THREE from '../lib/three.module.js';
import { ARENA, WALLS, STRUCTURES, GROUND } from './config.js';
import { clamp } from './utils.js';
import { Sky } from './sky.js';

export const STEP_HEIGHT = 0.45; // ledges up to this high are stepped onto, not blocked by
export const BODY_HEIGHT = 1.95; // collision height: head plus room above the camera (eye at 1.75), player and imp alike

// Analytic height field: flat arena in the middle, rolling hills outside.
export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  const k = clamp((d - 14) / 22, 0, 1);
  return k * (4 * Math.sin(x * 0.07) * Math.cos(z * 0.05)
    + 2.6 * Math.sin(x * 0.15 + z * 0.11)
    + 1.3 * Math.cos(z * 0.21 - x * 0.08)) + k * k * 4;
}

// Lowest and highest terrain under a rectangle (corners + centre are enough for these hills).
function terrainSpan(cx, cz, w, d) {
  let lo = Infinity, hi = -Infinity;
  for (const [x, z] of [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx - w / 2, cz + d / 2], [cx + w / 2, cz + d / 2], [cx, cz]]) {
    const y = heightAt(x, z); lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  return { lo, hi };
}

function slopeHeight(s, x, z) {
  const c = s.axis === 'x' ? x : z;
  return s.ha + (s.hb - s.ha) * clamp((c - s.a) / (s.b - s.a), 0, 1);
}

// Height of a box's top at (x, z): flat, or along the ramp slope.
function topAt(b, x, z) { return b.slope ? slopeHeight(b.slope, x, z) : b.top; }

// Height of a box's underside at (x, z): ramps are slabs, so their underside follows the slope.
function baseAt(b, x, z) { return b.slope ? slopeHeight(b.slope, x, z) - b.thickness : b.base; }

// Lowest underside anywhere under a body of radius r at (x, z). Under a sloped ramp the lowest
// point is not under the centre but at the body's edge on the downhill side.
function minBaseNear(b, x, z, r) {
  if (!b.slope) return b.base;
  const alongX = b.slope.axis === 'x';
  const c = alongX ? x : z, lo = alongX ? b.minX : b.minZ, hi = alongX ? b.maxX : b.maxZ;
  const h1 = slopeHeight(b.slope, alongX ? clamp(c - r, lo, hi) : x, alongX ? z : clamp(c - r, lo, hi));
  const h2 = slopeHeight(b.slope, alongX ? clamp(c + r, lo, hi) : x, alongX ? z : clamp(c + r, lo, hi));
  return Math.min(h1, h2) - b.thickness;
}

export class World {
  constructor(scene, textures) {
    this.scene = scene;
    this.boxes = [];       // collision: { minX, maxX, minZ, maxZ, base, top, slope? }
    this.wallMeshes = [];
    this.losRay = new THREE.Raycaster();
    this._dir = new THREE.Vector3();

    this.terrain = this._buildTerrain(textures);
    this.sky = new Sky(scene);
    this.wallMaterial = new THREE.MeshStandardMaterial({
      map: textures.wall, normalMap: textures.wallNormal, roughness: 0.92, metalness: 0
    });
    this.concreteMaterial = new THREE.MeshStandardMaterial({
      map: textures.concrete, normalMap: textures.concreteNormal, roughness: 0.88, metalness: 0
    });

    for (const w of WALLS) this.addWall(...w);
    this._supports = new Set();
    for (const b of STRUCTURES.bridges) this.addBridge(b);
    for (const r of STRUCTURES.ramps) this.addRamp(r);

    this.solids = [...this.wallMeshes, this.terrain]; // everything bullets and sight lines stop at
  }

  heightAt(x, z) { return heightAt(x, z); }

  _buildTerrain(textures) {
    const g = new THREE.PlaneGeometry(ARENA.terrainSize, ARENA.terrainSize, ARENA.terrainSegments, ARENA.terrainSegments);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) {
      const h = heightAt(p.getX(i), p.getZ(i));
      p.setY(i, h);
      const t = clamp((h + 3) / 13, 0, 1);
      // subtle tint: valleys a bit darker and warmer, hilltops lighter and dustier
      cols.push(0.82 + t * 0.22, 0.76 + t * 0.2, 0.72 + t * 0.2);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      map: textures.ground, normalMap: textures.groundNormal, vertexColors: true, roughness: 0.9, metalness: 0,
      // lava cracks glow on their own, in shadow too
      emissiveMap: textures.groundEmissive, emissive: 0xffffff, emissiveIntensity: GROUND.glow
    }));
    this.scene.add(mesh);
    return mesh;
  }

  // ---------- level building ----------

  // Solid box from `base` to `top` (absolute heights). Brick UVs keep a constant scale (4 m per tile).
  addBox(cx, cz, w, d, base, top, { material = this.wallMaterial, solid = true, collide = true } = {}) {
    const H = top - base;
    const g = new THREE.BoxGeometry(w, H, d);
    const uv = g.attributes.uv, dims = [[d, H], [d, H], [w, d], [w, d], [w, H], [w, H]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / 4, uv.getY(k) * dims[f][1] / 4);
    }
    const mesh = new THREE.Mesh(g, material);
    mesh.position.set(cx, base + H / 2, cz);
    this.scene.add(mesh);
    if (solid) this.wallMeshes.push(mesh);
    if (collide) this.boxes.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, base, top });
    return mesh;
  }

  // Wall of height `h` above the highest terrain under it, sunk into the lowest point.
  addWall(cx, cz, w, d, h) {
    const { lo, hi } = terrainSpan(cx, cz, w, d);
    this.addBox(cx, cz, w, d, lo - 1.5, hi + h);
  }

  // Concrete bridge deck between two points, held up by square columns. No railings.
  addBridge({ from, to, width = 4, top, thickness = 0.6, supportEvery = 16 }) {
    const alongX = from[1] === to[1];
    const a = alongX ? Math.min(from[0], to[0]) : Math.min(from[1], to[1]);
    const b = alongX ? Math.max(from[0], to[0]) : Math.max(from[1], to[1]);
    const cross = alongX ? from[1] : from[0];
    const len = b - a, mid = (a + b) / 2;
    const opts = { material: this.concreteMaterial };
    if (alongX) this.addBox(mid, cross, len, width, top - thickness, top, opts);
    else this.addBox(cross, mid, width, len, top - thickness, top, opts);

    // columns: 2 m in from each end, then evenly spaced, at most `supportEvery` apart
    const n = Math.max(1, Math.ceil((len - 4) / supportEvery));
    for (let i = 0; i <= n; i++) {
      const t0 = a + 2 + ((len - 4) * i) / n, size = 1.4;
      // slide the column along the bridge if it would leave a crack too narrow to walk through
      const shift = [0, 1, -1, 2, -2, 3, -3, 4, -4].find(o => {
        const t = clamp(t0 + o, a + 1, b - 1), [x, z] = alongX ? [t, cross] : [cross, t];
        return !this.boxes.some(q => q.top > top - thickness - 0.01 ? false
          : Math.max(q.minX - (x + size / 2), x - size / 2 - q.maxX) < 1 && Math.max(q.minZ - (z + size / 2), z - size / 2 - q.maxZ) < 1);
      }) ?? 0;
      const t = clamp(t0 + shift, a + 1, b - 1);
      const [x, z] = alongX ? [t, cross] : [cross, t];
      const key = `${Math.round(x)},${Math.round(z)}`;
      if (this._supports.has(key)) continue; // bridges meeting at a corner share a column
      this._supports.add(key);
      const { lo } = terrainSpan(x, z, size, size);
      this.addBox(x, z, size, size, lo - 1.5, top - thickness, opts);
    }
  }

  // Concrete slab ramp, as thick as a bridge deck, rising from the ground at `from` to `top` at `to`.
  addRamp({ from, to, width = 4, top, thickness = 0.6 }) {
    const alongX = from[1] === to[1];
    const lowC = alongX ? from[0] : from[1], highC = alongX ? to[0] : to[1];
    const cross = alongX ? from[1] : from[0];
    const h0 = heightAt(from[0], from[1]) - 0.05;            // sits flush with the ground at the low end
    const len = Math.abs(highC - lowC), mid = (lowC + highC) / 2;
    const [cx, cz, w, d] = alongX ? [mid, cross, len, width] : [cross, mid, width, len];
    const slope = { axis: alongX ? 'x' : 'z', a: lowC, b: highC, ha: h0, hb: top };
    const surface = (x, z) => slopeHeight(slope, x, z);

    // a thin box whose top and bottom vertices are both moved onto the slope
    const g = new THREE.BoxGeometry(w, thickness, d);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const s = surface(cx + pos.getX(i), cz + pos.getZ(i));
      pos.setY(i, pos.getY(i) > 0 ? s : s - thickness);
    }
    const slopeLen = Math.hypot(len, top - h0);
    const [sw, sd] = alongX ? [slopeLen, width] : [width, slopeLen];
    const dims = [[sd, thickness], [sd, thickness], [sw, sd], [sw, sd], [sw, thickness], [sw, thickness]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / 4, uv.getY(k) * dims[f][1] / 4);
    }
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, this.concreteMaterial);
    mesh.position.set(cx, 0, cz);
    this.scene.add(mesh);
    this.wallMeshes.push(mesh);
    this.boxes.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, base: h0 - thickness, top, slope, thickness });
  }

  // ---------- queries ----------

  // Does a circle at (x, z) with this body span collide? feetY defaults to the terrain there.
  blocked(x, z, r, feetY = heightAt(x, z)) {
    const lo = feetY + STEP_HEIGHT, hi = feetY + BODY_HEIGHT;
    for (const b of this.boxes) {
      const nx = clamp(x, b.minX, b.maxX), nz = clamp(z, b.minZ, b.maxZ);
      if (minBaseNear(b, x, z, r) >= hi) continue;         // high enough to walk under
      if (topAt(b, nx, nz) <= lo) continue;               // low enough to step onto (or walk up a ramp)
      if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) return true;
    }
    return false;
  }

  // Highest surface the feet can stand on: terrain, or a box top within step reach.
  // With a radius, a box counts as soon as any part of the body is over it (Quake-style):
  // you stand on a ledge until you have fully stepped off, so you never fall half inside it.
  floorAt(x, z, feetY, r = 0) {
    let f = heightAt(x, z);
    for (const b of this.boxes) {
      const nx = clamp(x, b.minX, b.maxX), nz = clamp(z, b.minZ, b.maxZ);
      if ((x - nx) ** 2 + (z - nz) ** 2 > r * r) continue;
      const t = topAt(b, nx, nz);
      if (t > f && t <= feetY + STEP_HEIGHT) f = t;
    }
    return f;
  }

  // Lowest box underside above the feet: what the head bumps into when jumping.
  ceilingAt(x, z, feetY, r = 0) {
    let c = Infinity;
    for (const b of this.boxes) {
      const nx = clamp(x, b.minX, b.maxX), nz = clamp(z, b.minZ, b.maxZ);
      if ((x - nx) ** 2 + (z - nz) ** 2 > r * r) continue;
      const base = minBaseNear(b, x, z, r);
      if (base >= feetY + 0.5 && base < c) c = base;
    }
    return c;
  }

  // Safety net: if the body ended up overlapping a solid, push it out the shortest way.
  // Normal movement never causes this, but it makes getting permanently stuck impossible.
  pushOut(p, r) {
    const lo = p.y + STEP_HEIGHT, hi = p.y + BODY_HEIGHT;
    for (const b of this.boxes) {
      const nx = clamp(p.x, b.minX, b.maxX), nz = clamp(p.z, b.minZ, b.maxZ);
      const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (topAt(b, nx, nz) <= lo || minBaseNear(b, p.x, p.z, r) >= hi) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), k = (r - d + 0.001) / d;
        p.x += dx * k; p.z += dz * k;
      } else {
        // centre inside the footprint: leave through the nearest side
        const exits = [[b.minX - r - 0.001 - p.x, 0], [b.maxX + r + 0.001 - p.x, 0], [0, b.minZ - r - 0.001 - p.z], [0, b.maxZ + r + 0.001 - p.z]];
        const [ex, ez] = exits.reduce((m, e) => Math.hypot(...e) < Math.hypot(...m) ? e : m);
        p.x += ex; p.z += ez;
      }
    }
  }

  // Move with per-axis sliding. Returns distance actually moved.
  slide(p, dx, dz, r) {
    let moved = 0;
    if (!this.blocked(p.x + dx, p.z, r, p.y)) { p.x += dx; moved += Math.abs(dx); }
    if (!this.blocked(p.x, p.z + dz, r, p.y)) { p.z += dz; moved += Math.abs(dz); }
    return moved;
  }

  // Point inside any solid volume (used by projectiles).
  insideWall(p, pad = 0.2) {
    for (const b of this.boxes) {
      if (p.y > baseAt(b, p.x, p.z) && p.y < topAt(b, p.x, p.z) && p.x > b.minX - pad && p.x < b.maxX + pad && p.z > b.minZ - pad && p.z < b.maxZ + pad) return true;
    }
    return false;
  }

  hasLineOfSight(a, b) {
    this._dir.subVectors(b, a);
    const d = this._dir.length();
    this.losRay.set(a, this._dir.normalize());
    this.losRay.far = d;
    return this.losRay.intersectObjects(this.solids, false).length === 0;
  }

  randomFreePoint(cx, cz, rMin, rMax, radius = 1) {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (Math.abs(x) < ARENA.spawnLimit && Math.abs(z) < ARENA.spawnLimit && !this.blocked(x, z, radius)) return [x, z];
    }
    return [0, -30];
  }
}
