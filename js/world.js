// Terrain, sky, walls, collision and line-of-sight queries.
import * as THREE from '../lib/three.module.js';
import { ARENA, WALLS } from './config.js';
import { clamp } from './utils.js';

// Analytic height field: flat arena in the middle, rolling hills outside.
export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  const k = clamp((d - 14) / 22, 0, 1);
  return k * (4 * Math.sin(x * 0.07) * Math.cos(z * 0.05)
    + 2.6 * Math.sin(x * 0.15 + z * 0.11)
    + 1.3 * Math.cos(z * 0.21 - x * 0.08)) + k * k * 4;
}

export class World {
  constructor(scene, textures) {
    this.scene = scene;
    this.walls = [];       // { minX, maxX, minZ, maxZ, top } for collision
    this.wallMeshes = [];
    this.losRay = new THREE.Raycaster();
    this._dir = new THREE.Vector3();

    this.terrain = this._buildTerrain(textures.ground);
    this._buildSky();
    this.wallMaterial = new THREE.MeshLambertMaterial({ map: textures.wall });
    for (const w of WALLS) this.addWall(...w);
    this.solids = [...this.wallMeshes, this.terrain]; // everything bullets and sight lines stop at
  }

  heightAt(x, z) { return heightAt(x, z); }

  _buildTerrain(tex) {
    const g = new THREE.PlaneGeometry(ARENA.terrainSize, ARENA.terrainSize, ARENA.terrainSegments, ARENA.terrainSegments);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) {
      const h = heightAt(p.getX(i), p.getZ(i));
      p.setY(i, h);
      const t = clamp((h + 3) / 13, 0, 1);
      cols.push(0.62 + t * 0.4, 0.45 + t * 0.12, 0.36 - t * 0.06);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ map: tex, vertexColors: true, flatShading: true, shininess: 0 }));
    this.scene.add(mesh);
    return mesh;
  }

  _buildSky() {
    const g = new THREE.SphereGeometry(400, 16, 10), p = g.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) {
      const t = clamp(p.getY(i) / 400, 0, 1);
      cols.push(0.23 - 0.15 * t, 0.10 - 0.07 * t, 0.07 - 0.02 * t);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  }

  addWall(cx, cz, w, d, h) {
    const minX = cx - w / 2, maxX = cx + w / 2, minZ = cz - d / 2, maxZ = cz + d / 2;
    let lo = Infinity, hi = -Infinity;
    for (const [x, z] of [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ], [cx, cz]]) {
      const y = heightAt(x, z); lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    const base = lo - 1.5, top = hi + h, H = top - base;
    const g = new THREE.BoxGeometry(w, H, d);
    // Scale UVs per face so bricks keep their size (texture covers 4x4 m).
    const uv = g.attributes.uv, dims = [[d, H], [d, H], [w, d], [w, d], [w, H], [w, H]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / 4, uv.getY(k) * dims[f][1] / 4);
    }
    const mesh = new THREE.Mesh(g, this.wallMaterial);
    mesh.position.set(cx, base + H / 2, cz);
    this.scene.add(mesh);
    this.wallMeshes.push(mesh);
    this.walls.push({ minX, maxX, minZ, maxZ, top });
  }

  // Circle (XZ) vs wall AABBs.
  blocked(x, z, r) {
    for (const w of this.walls) {
      const nx = clamp(x, w.minX, w.maxX), nz = clamp(z, w.minZ, w.maxZ);
      if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) return true;
    }
    return false;
  }

  // Move with per-axis sliding. Returns distance actually moved.
  slide(p, dx, dz, r) {
    let moved = 0;
    if (!this.blocked(p.x + dx, p.z, r)) { p.x += dx; moved += Math.abs(dx); }
    if (!this.blocked(p.x, p.z + dz, r)) { p.z += dz; moved += Math.abs(dz); }
    return moved;
  }

  // Point inside a wall volume (used by projectiles).
  insideWall(p, pad = 0.2) {
    for (const w of this.walls) {
      if (p.x > w.minX - pad && p.x < w.maxX + pad && p.z > w.minZ - pad && p.z < w.maxZ + pad && p.y < w.top) return true;
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
