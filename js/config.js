// All tunable numbers in one place. Change gameplay here, not in the systems.

export const RENDER = {
  maxPixelRatio: 1.5,   // render at native resolution up to this devicePixelRatio; lower it if FPS drops
  fovHorizontal: 90,   // degrees, kept constant on any aspect ratio (modern shooters: 90-100)
  fogColor: 0x3b1a12,
  fogNear: 6,
  fogFar: 80
};

// Crosshair (js/hud.js)
export const HUD = {
  comfortDot: true,     // fixed dot in the centre: a steady reference point that helps against motion sickness
  crosshairGap: 10,     // distance from the centre to each line, in CSS pixels
  crosshairLength: 7,   // length of each line
  recoilSpread: 6       // how far the lines open up right after a shot
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

// Sky dome (js/sky.js): colours and cloud motion
export const SKY = {
  zenith: 0x2e0e0e,       // overhead: dark crimson
  horizon: 0x5a1c10,      // low sky: smouldering red
  glow: 0x7a2a0c,         // fiery band right at the horizon
  cloudDark: 0x0e0505,    // storm clouds: darker than the sky so they read as silhouettes
  cloudLit: 0xd2561e,     // cloud edges lit by fire from below
  wisp: 0x8a3a24,         // thin fast wisps in the upper layer
  wind: [0.24, 0.1],      // cloud drift direction and base speed (dome units per second)
  speed: 1.0,             // overall cloud speed multiplier: raise it for a wilder sky
  wispSpeedRatio: 1.9     // the upper wisps move this much faster than the main clouds
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
  // Quake 3 style movement: velocity with acceleration and friction instead of instant moves.
  // For reference Q3 runs at 320 units/s ~ 8 m/s; human walking pace is ~1.4 m/s.
  walkSpeed: 8.5,       // default pace (m/s)
  runSpeed: 15,          // with Shift
  groundAccel: 10,      // Q3 pm_accelerate: how fast you reach top speed (~0.1 s)
  airAccel: 1,          // Q3 pm_airaccelerate: weak air control, enough for strafe-jumping
  friction: 6,          // Q3 pm_friction: how fast you stop (~0.15 s)
  stopSpeed: 2.5,       // below this speed friction acts as if at this speed, so you stop cleanly
  jumpSpeed: 6.8,       // Q3 270 u/s
  gravity: 20,          // Q3 800 u/s^2
  headBob: 0.012,       // camera bob height in metres; 0 disables it (comfort)
  landDip: true,        // short camera dip on hard landings
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
  height: 1.9,         // imp height in metres (model is auto-scaled to it)
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
  [-40, 8, 1.5, 12, 5], [40, 4, 10, 1.5, 5]   // (-40, 8) moved off the bridge line
];

// Concrete bridges and ramps in the Quake 3 spirit: no railings, run straight up and across.
// Points are [x, z] in metres, heights are absolute. Bridges and ramps must be axis-aligned.
export const STRUCTURES = {
  bridges: [
    // `from` / `to` are the centres of the two ends of the deck
    // decks must only touch, never overlap: two coplanar tops in the same spot flicker (z-fighting)
    { from: [-52, -6], to: [10, -6], width: 4, top: 7.5, supportEvery: 16 },   // across the map, ends at the north bridge's edge
    { from: [12, -8], to: [12, 52], width: 4, top: 7.5, supportEvery: 16 }     // turns north at the corner
  ],
  ramps: [
    // `from` is the low end on the ground, `to` the high end touching a bridge edge
    { from: [-24, 14], to: [-24, -4], width: 4, top: 7.5 },   // south side, up to the long bridge (~30°)
    { from: [-4, 18], to: [10, 18], width: 4, top: 7.5 }      // west side, up to the north bridge (~27°)
  ]
};
