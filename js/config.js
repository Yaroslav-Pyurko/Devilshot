// All tunable numbers in one place. Change gameplay here, not in the systems.

export const RENDER = {
  maxPixelRatio: 1.5,   // render at native resolution up to this devicePixelRatio; lower it if FPS drops
  fovHorizontal: 90,   // degrees, kept constant on any aspect ratio (modern shooters: 90-100)
  fogColor: 0x3b1a12,
  fogNear: 6,
  fogFar: 80
};

// First-person weapon model (js/viewmodel.js)
export const VIEWMODEL = {
  fov: 54,                          // separate from the world FOV so the gun keeps its shape
  position: [0.15, -0.16, -0.38],   // right of centre, below and in front of the eye (metres)
  yaw: -0.07,                       // slight turn toward the crosshair
  bobAmount: 0.012,
  swayAmount: 0.6,
  recoilImpulse: 7
};

export const ARENA = {
  terrainSize: 170,
  terrainSegments: 85,
  limit: 58,            // hard clamp for the player, boundary walls sit at ±60
  spawnLimit: 54
};

export const PLAYER = {
  start: { x: 0, z: 24 },
  eyeHeight: 1.75,     // modern eye level; classic DOOM feel was ~1.6 with a 2.3 m imp
  radius: 0.4,
  walkSpeed: 8,
  runSpeed: 13,
  jumpSpeed: 8.5,
  gravity: 24,
  maxHp: 100,
  startAmmo: 40,
  mouseSensitivity: 0.0022,
  maxPitch: 1.45
};

export const WEAPON = {
  cooldown: 0.42,
  damage: 34,
  spread: 0.012,
  range: 220,
  ammoPerKill: 12
};

export const ENEMY = {
  start: { x: 0, z: -32 },
  maxHp: 100,
  radius: 0.6,
  spriteSize: 1.9,     // imp height in metres (sprite art fills the full frame)
  eyeHeight: 1.6,      // where it looks from and throws fireballs
  sightRange: 50,
  closeSenseRange: 10,  // notices you from any direction inside this radius
  viewConeDot: -0.35,   // ~140° cone while wandering
  losInterval: 0.15,
  attackRange: 30,
  attackCooldown: [1.5, 2.8],
  keepDistance: 7,
  chaseSpeed: 4.3,
  strafeSpeed: 2.6,
  searchSpeed: 2.8,
  searchTime: 4,
  wanderSpeed: 2,
  meleeRange: 1.6,
  meleeDamage: 10,
  meleeCooldown: 0.9,
  respawnDelay: 5,
  respawnDistance: [28, 48]
};

export const FIREBALL = {
  speed: 15,
  damage: 15,
  lifetime: 4,
  hitRadius: 0.9
};

// [centerX, centerZ, width (X), depth (Z), height above terrain]
export const WALLS = [
  [0, -60, 122, 2, 7], [0, 60, 122, 2, 7], [-60, 0, 2, 122, 7], [60, 0, 2, 122, 7],
  [-8, -6, 10, 1.5, 4], [8, 6, 10, 1.5, 4], [0, -16, 1.5, 10, 4],
  [14, -12, 6, 6, 5], [-15, 12, 6, 6, 5], [25, 20, 1.5, 14, 5], [-28, -24, 14, 1.5, 5],
  [30, -30, 4, 4, 8], [-34, 30, 4, 4, 8], [-40, -2, 1.5, 12, 5], [40, 4, 10, 1.5, 5]
];
