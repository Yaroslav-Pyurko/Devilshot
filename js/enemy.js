// Imp: 3D low-poly demon (js/impModel.js) driven by a small finite state machine.
//
//   wander ──(sees player)──► chase ──(loses sight, reaches last seen spot)──► search
//     ▲                          │                                              │
//     └───────────(search timer runs out)───────────────────────────────────────┘
//
// While chasing with line of sight it throws fireballs, strafes when close and claws in melee.
import * as THREE from '../lib/three.module.js';
import { ENEMY } from './config.js';
import { randRange } from './utils.js';
import { sfx } from './audio.js';
import { ImpRig } from './impModel.js';

const THROW_TIME = 0.6, THROW_RELEASE = 0.45; // fireball leaves the hand at 45% of the throw
const MELEE_TIME = 0.45, MELEE_HIT = 0.35;

export const AI_STATE = { WANDER: 'wander', CHASE: 'chase', SEARCH: 'search' };

export class Imp {
  constructor(scene, world, fireballs, player) {
    this.world = world;
    this.fireballs = fireballs;
    this.player = player;
    this.onKilled = () => {};

    this.pos = new THREE.Vector3();
    this.lastSeen = new THREE.Vector2();
    this.wanderTarget = new THREE.Vector2();
    this.rig = new ImpRig(ENEMY.height);
    scene.add(this.rig.root);
    this.hitTarget = this.rig.root; // the weapon raycasts against the whole model
    this.yaw = 0;

    this._eye = new THREE.Vector3();
    this._playerEye = new THREE.Vector3();
    this._goal = new THREE.Vector2();
    this.reset();
  }

  reset() {
    this.placeAt(ENEMY.start.x, ENEMY.start.z);
    this.attackCooldown = 1;
  }

  placeAt(x, z) {
    this.pos.set(x, this.world.heightAt(x, z), z);
    this.hp = ENEMY.maxHp;
    this.alive = true;
    this.state = AI_STATE.WANDER;
    this.sees = false;
    this.losTimer = 0;
    this.attackCooldown = 1.5;
    this.attackAnim = 0;
    this.painTimer = 0;
    this.steerTimer = 0;
    this.steerAngle = 0;
    this.strafeDir = 1;
    this.strafeTimer = 0;
    this.searchTimer = 0;
    this.meleeCooldown = 0;
    this.walkPhase = 0;
    this.moveSpeed = 0;
    this.respawnTimer = 0;
    this.throwT = -1;   // seconds into the throw animation, -1 = not throwing
    this.meleeT = -1;
    this.deadT = -1;
    this._pickWanderTarget();
    this.yaw = Math.atan2(this.wanderTarget.x - x, this.wanderTarget.y - z);
    this._syncModel(0);
  }

  respawnAwayFrom(p) {
    const [min, max] = ENEMY.respawnDistance;
    const [x, z] = this.world.randomFreePoint(p.x, p.z, min, max);
    this.placeAt(x, z);
  }

  // Readable status for the HUD.
  get statusLabel() {
    if (!this.alive) return `dead, respawn in ${Math.max(0, this.respawnTimer).toFixed(1)}s`;
    if (this.state === AI_STATE.CHASE) return this.sees ? 'attacking' : 'chasing';
    if (this.state === AI_STATE.SEARCH) return 'searching';
    return 'wandering';
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.painTimer = 0.2;
    if (this.state !== AI_STATE.CHASE) sfx.enemyAlert();
    this.state = AI_STATE.CHASE;
    this.lastSeen.set(this.player.pos.x, this.player.pos.z);
    if (this.hp <= 0) {
      this.alive = false;
      this.respawnTimer = ENEMY.respawnDelay;
      this.deadT = 0;
      this.throwT = this.meleeT = -1;
      sfx.death();
      this.onKilled();
    } else sfx.enemyPain();
  }

  update(dt) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      this.deadT += dt;
      if (this.respawnTimer <= 0) this.respawnAwayFrom(this.player.pos);
      this._syncModel(dt);
      return;
    }
    this.attackCooldown -= dt; this.attackAnim -= dt; this.painTimer -= dt; this.losTimer -= dt;
    this.steerTimer -= dt; this.strafeTimer -= dt; this.meleeCooldown -= dt;

    const player = this.player;
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    this._perceive(dx, dz, dist);
    if (this.sees) { this.state = AI_STATE.CHASE; this.lastSeen.set(player.pos.x, player.pos.z); }

    const speed = this._think(dt, dx, dz, dist);
    this._move(dt, speed);
    this._updateAttacks(dt);
    this._face(dt, dx, dz);
    this._syncModel(dt);
  }

  // Sight check, throttled because raycasts against the terrain are not free.
  _perceive(dx, dz, dist) {
    if (this.losTimer > 0) return;
    this.losTimer = ENEMY.losInterval;
    let inView = dist < ENEMY.sightRange;
    if (this.state === AI_STATE.WANDER && inView && dist > ENEMY.closeSenseRange) {
      const fx = this.wanderTarget.x - this.pos.x, fz = this.wanderTarget.y - this.pos.z;
      const fl = Math.hypot(fx, fz) || 1;
      inView = (fx * dx + fz * dz) / (fl * (dist || 1)) > ENEMY.viewConeDot;
    }
    const was = this.sees;
    this._eye.set(this.pos.x, this.pos.y + ENEMY.eyeHeight, this.pos.z);
    this.sees = this.player.alive && inView && this.world.hasLineOfSight(this._eye, this.player.eye(this._playerEye));
    if (this.sees && !was && this.state !== AI_STATE.CHASE) sfx.enemyAlert();
  }

  // Decide where to go and whether to attack. Returns movement speed.
  _think(dt, dx, dz, dist) {
    const goal = this._goal;
    let speed = 0;

    if (this.state === AI_STATE.CHASE) {
      if (this.sees) {
        if (dist > ENEMY.keepDistance) { goal.set(this.player.pos.x, this.player.pos.z); speed = ENEMY.chaseSpeed; }
        else {
          if (this.strafeTimer <= 0) { this.strafeDir *= -1; this.strafeTimer = 1 + Math.random(); }
          goal.set(this.pos.x - dz / dist * this.strafeDir * 5, this.pos.z + dx / dist * this.strafeDir * 5);
          speed = ENEMY.strafeSpeed;
        }
        const busy = this.throwT >= 0 || this.meleeT >= 0;
        if (!busy && dist < ENEMY.meleeRange && this.meleeCooldown <= 0) {
          this.meleeT = 0;
          this.meleeCooldown = ENEMY.meleeCooldown;
          this.attackAnim = MELEE_TIME;
        } else if (!busy && dist < ENEMY.attackRange && this.attackCooldown <= 0) {
          this.throwT = 0;
          this.attackCooldown = randRange(ENEMY.attackCooldown);
          this.attackAnim = THROW_TIME;
        }
      } else {
        goal.copy(this.lastSeen); speed = ENEMY.chaseSpeed;
        if (Math.hypot(this.lastSeen.x - this.pos.x, this.lastSeen.y - this.pos.z) < 1.5) {
          this.state = AI_STATE.SEARCH;
          this.searchTimer = ENEMY.searchTime;
          this._pickWanderTarget();
        }
      }
    } else if (this.state === AI_STATE.SEARCH) {
      this.searchTimer -= dt;
      goal.copy(this.wanderTarget); speed = ENEMY.searchSpeed;
      if (this.searchTimer <= 0) this.state = AI_STATE.WANDER;
    } else {
      this.wanderTimer -= dt;
      goal.copy(this.wanderTarget); speed = ENEMY.wanderSpeed;
      if (this.wanderTimer <= 0 || Math.hypot(this.wanderTarget.x - this.pos.x, this.wanderTarget.y - this.pos.z) < 1.5) this._pickWanderTarget();
    }

    if (this.painTimer > 0 || this.attackAnim > 0) speed *= 0.15;
    return speed;
  }

  // Steer toward the goal; when stuck on a wall, turn ~75° for a moment (cheap obstacle avoidance).
  _move(dt, speed) {
    let gx = this._goal.x - this.pos.x, gz = this._goal.y - this.pos.z;
    const gl = Math.hypot(gx, gz);
    this.moveSpeed = 0;
    if (gl > 0.05 && speed > 0) {
      gx /= gl; gz /= gl;
      if (this.steerTimer > 0) {
        const c = Math.cos(this.steerAngle), s = Math.sin(this.steerAngle);
        [gx, gz] = [gx * c - gz * s, gx * s + gz * c];
      }
      const step = speed * dt;
      const moved = this.world.slide(this.pos, gx * step, gz * step, ENEMY.radius);
      if (moved < step * 0.3 && this.steerTimer <= 0) {
        this.steerTimer = 0.8;
        this.steerAngle = (Math.random() < 0.5 ? 1 : -1) * 1.3;
        if (this.state === AI_STATE.WANDER) this._pickWanderTarget();
      }
      this.walkPhase += dt * speed;
      this.moveSpeed = moved / dt;
      this.moveDir = Math.atan2(gx, gz);
    }
    // Don't walk into the player.
    const p = this.player.pos;
    const nx = this.pos.x - p.x, nz = this.pos.z - p.z, nd = Math.hypot(nx, nz);
    if (nd < 1.1 && nd > 0.001) { this.pos.x = p.x + nx / nd * 1.1; this.pos.z = p.z + nz / nd * 1.1; }
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);
  }

  // Advance attack animations and fire their effects at the right moment.
  _updateAttacks(dt) {
    if (this.throwT >= 0) {
      const before = this.throwT;
      this.throwT += dt;
      if (before < THROW_TIME * THROW_RELEASE && this.throwT >= THROW_TIME * THROW_RELEASE) {
        const from = this.rig.handWorldPosition(new THREE.Vector3());
        this.fireballs.spawn(from, this.player.eye(new THREE.Vector3()), this.player.volumeAt(from));
      }
      if (this.throwT >= THROW_TIME) this.throwT = -1;
    }
    if (this.meleeT >= 0) {
      const before = this.meleeT;
      this.meleeT += dt;
      const hitAt = MELEE_TIME * MELEE_HIT;
      if (before < hitAt && this.meleeT >= hitAt) {
        const p = this.player.pos;
        if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < ENEMY.meleeRange + 0.4) this.player.hurt(ENEMY.meleeDamage);
      }
      if (this.meleeT >= MELEE_TIME) this.meleeT = -1;
    }
  }

  // Turn smoothly: toward the player while fighting, otherwise along the walking direction.
  _face(dt, dx, dz) {
    let target = this.yaw;
    if (this.state === AI_STATE.CHASE && this.sees) target = Math.atan2(dx, dz);
    else if (this.moveSpeed > 0.2) target = this.moveDir;
    let diff = ((target - this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.yaw += diff * (1 - Math.exp(-dt * 8));
  }

  _pickWanderTarget() {
    const [x, z] = this.world.randomFreePoint(this.pos.x, this.pos.z, 8, 30);
    this.wanderTarget.set(x, z);
    this.wanderTimer = 8;
  }

  _syncModel(dt) {
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    this.rig.update({
      dt,
      walkPhase: this.walkPhase,
      moveSpeed: this.alive ? this.moveSpeed : 0,
      attackT: this.throwT >= 0 ? this.throwT / THROW_TIME : -1,
      meleeT: this.meleeT >= 0 ? this.meleeT / MELEE_TIME : -1,
      painT: this.painTimer > 0 ? this.painTimer / 0.2 : 0,
      deadT: this.alive ? -1 : this.deadT
    });
  }
}
