// Quake 3 style sky: a dome with two layers of fast scrolling clouds, drawn in a shader.
//
// Like Q3 sky shaders, the clouds are a flat layer projected onto a curved dome:
// overhead they move fast and big, toward the horizon they shrink and bunch up, which
// sells the height and the speed. Everything is procedural noise, no textures.
import * as THREE from '../lib/three.module.js';
import { SKY, RENDER } from './config.js';

const vertexShader = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;                       // dome is centred on the camera, so position = view direction
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;                  // always at the far plane: never clips, never hides anything
  }
`;

const fragmentShader = /* glsl */`
  uniform float uTime;
  uniform vec3 uZenith, uHorizon, uGlow, uCloudDark, uCloudLit, uWisp, uFog;
  uniform vec2 uWind1, uWind2;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;

    // base gradient: fiery glow at the horizon, near-black crimson overhead
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.7, h));
    col += uGlow * pow(1.0 - clamp(h, 0.0, 1.0), 6.0);

    if (h > 0.0) {
      vec2 p = d.xz / (h + 0.12);          // flat cloud layer projected onto the dome (Q3 "cloudheight")
      float fade = smoothstep(0.0, 0.18, h);

      // heavy storm clouds, big and fast
      float n1 = fbm(p * 0.9 + uWind1 * uTime);
      float c1 = smoothstep(0.40, 0.72, n1);
      float lit = smoothstep(0.55, 0.95, fbm(p * 0.9 + uWind1 * uTime + vec2(0.35, 0.2)));  // fire light catching the edges
      col = mix(col, mix(uCloudDark, uCloudLit, lit * 0.85), c1 * 0.95 * fade);

      // thin wisps above them, smaller and even faster: the parallax sells the speed
      float n2 = fbm(p * 2.2 + uWind2 * uTime);
      col = mix(col, uWisp, smoothstep(0.55, 0.85, n2) * 0.45 * fade);
    }

    // melt into the fog at and below the horizon so the dome has no visible seam
    col = mix(uFog, col, smoothstep(-0.02, 0.12, h));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Sky {
  constructor(scene) {
    const c = hex => new THREE.Color(hex);
    this.uniforms = {
      uTime: { value: 0 },
      uZenith: { value: c(SKY.zenith) },
      uHorizon: { value: c(SKY.horizon) },
      uGlow: { value: c(SKY.glow) },
      uCloudDark: { value: c(SKY.cloudDark) },
      uCloudLit: { value: c(SKY.cloudLit) },
      uWisp: { value: c(SKY.wisp) },
      uFog: { value: c(RENDER.fogColor) },
      uWind1: { value: new THREE.Vector2(...SKY.wind).multiplyScalar(SKY.speed) },
      uWind2: { value: new THREE.Vector2(...SKY.wind).multiplyScalar(SKY.speed * SKY.wispSpeedRatio).rotateAround(new THREE.Vector2(), 0.35) }
    };
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(100, 48, 24),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false })
    );
    this.mesh.renderOrder = -1;     // drawn first, everything else covers it
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  // Keep the dome centred on the camera and advance the clouds (also while paused, like Q3 menus).
  update(dt, camera) {
    this.uniforms.uTime.value += dt;
    this.mesh.position.copy(camera.position);
  }
}
