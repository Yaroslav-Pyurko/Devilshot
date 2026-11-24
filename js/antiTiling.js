// Breaks up visible texture repetition on large surfaces (the terrain), without fog.
// Patches a MeshStandardMaterial's shader (map + normal map) with three standard techniques:
//
// 1. Stochastic tiling (Inigo Quilez, "texture repetition", technique 3): a smooth random field
//    picks a different offset of the texture in different areas and blends between them, so the
//    same tile never lines up into a grid. Albedo and normal map use the same offsets.
// 2. Distance blend: far away the texture is also sampled at a much larger scale and faded in,
//    so the repeat gets rarer with distance and the fine grain does not shimmer.
// 3. Macro variation: a very large, slow noise over the world makes the ground a little darker or
//    lighter, browner or redder in patches, so no two repeats look the same.
import * as THREE from '../lib/three.module.js';

const PARS = /* glsl */`
uniform float atFarScale;
uniform vec2 atFarRange;
uniform float atMacroScale;
uniform float atMacroStrength;
uniform float atCellScale;
varying vec2 vATWorld;

float atHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float atNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(atHash(i), atHash(i + vec2(1.0, 0.0)), u.x),
             mix(atHash(i + vec2(0.0, 1.0)), atHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Random offsets A and B for this area and the blend position f between them.
void atSetup(vec2 uv, out vec2 offA, out vec2 offB, out float f) {
  float l = atNoise(uv * atCellScale) * 8.0;
  float ia = floor(l);
  f = fract(l);
  offA = sin(vec2(3.0, 7.0) * ia);
  offB = sin(vec2(3.0, 7.0) * (ia + 1.0));
}
// Explicit gradients from the unshifted uv: no mipmap seams where the offset changes.
vec4 atTex(sampler2D s, vec2 uv, vec2 off) {
  return texture2DGradEXT(s, uv + off, dFdx(uv), dFdy(uv));
}
`;

const MAP = /* glsl */`
#ifdef USE_MAP
  vec2 atUv0 = vUv, atUv1 = vUv * atFarScale + 17.0;
  vec2 atA0, atB0, atA1, atB1; float atF0, atF1;
  atSetup(atUv0, atA0, atB0, atF0);
  atSetup(atUv1, atA1, atB1, atF1);
  float atFar = smoothstep(atFarRange.x, atFarRange.y, length(vViewPosition));
  vec4 atC0a = atTex(map, atUv0, atA0), atC0b = atTex(map, atUv0, atB0);
  vec4 atC1a = atTex(map, atUv1, atA1), atC1b = atTex(map, atUv1, atB1);
  // blend by contrast: the brighter/darker details win, which hides the transition
  float atW0 = smoothstep(0.2, 0.8, atF0 - 0.1 * dot(atC0a.rgb - atC0b.rgb, vec3(1.0)));
  float atW1 = smoothstep(0.2, 0.8, atF1 - 0.1 * dot(atC1a.rgb - atC1b.rgb, vec3(1.0)));
  vec4 texelColor = mix(mix(atC0a, atC0b, atW0), mix(atC1a, atC1b, atW1), atFar);
  texelColor = mapTexelToLinear(texelColor);
  // macro variation: two octaves of slow world-space noise
  float atM = atNoise(vATWorld * atMacroScale) * 0.65 + atNoise(vATWorld * atMacroScale * 3.1 + 5.0) * 0.35;
  float atM2 = atNoise(vATWorld * atMacroScale * 0.7 + 31.0);
  texelColor.rgb *= 1.0 + (atM - 0.5) * 2.0 * atMacroStrength;                         // darker / lighter
  texelColor.rgb *= mix(vec3(1.0), vec3(1.12, 0.92, 0.85), atM2 * atMacroStrength * 2.0);   // browner patches
  diffuseColor *= texelColor;
#endif
`;

const NORMAL_LOOKUP = 'vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;';
const NORMAL = /* glsl */`
  vec3 mapN = mix(mix(atTex(normalMap, atUv0, atA0), atTex(normalMap, atUv0, atB0), atW0).xyz,
                  mix(atTex(normalMap, atUv1, atA1), atTex(normalMap, atUv1, atB1), atW1).xyz, atFar) * 2.0 - 1.0;
`;

/**
 * @param {THREE.MeshStandardMaterial} material  needs `map`; `normalMap` is optional
 * @param {object} o  farScale, farRange [start, end] metres, macroScale (1/metres), macroStrength, cellScale
 */
export function applyAntiTiling(material, o) {
  material.extensions = { ...material.extensions, derivatives: true, shaderTextureLOD: true };   // WebGL1
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      atFarScale: { value: o.farScale },
      atFarRange: { value: new THREE.Vector2(o.farRange[0], o.farRange[1]) },
      atMacroScale: { value: o.macroScale },
      atMacroStrength: { value: o.macroStrength },
      atCellScale: { value: o.cellScale }
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vATWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvATWorld = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PARS)
      .replace('#include <map_fragment>', MAP)
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace(NORMAL_LOOKUP, NORMAL));
  };
  material.customProgramCacheKey = () => 'antiTiling';
  return material;
}
