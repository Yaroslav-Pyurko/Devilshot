export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const randRange = ([min, max]) => min + Math.random() * (max - min);

// Deterministic generator so procedural textures look the same on every run.
export function seededRandom(seed = 7) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export const reduceMotion = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;
