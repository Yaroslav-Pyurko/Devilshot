// Sound effects (WebAudio): mostly synthesized, plus a few short recorded samples.
let ctx = null;

// Recorded samples in assets/sounds, loaded once audio is unlocked.
const SAMPLE_FILES = { jump: 'assets/sounds/jump.mp3' };
const samples = {};

// Browsers only allow audio after a user gesture: call this from a click.
export function unlockAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
    if (ctx) loadSamples();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function loadSamples() {
  for (const [name, url] of Object.entries(SAMPLE_FILES)) {
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(data => ctx.decodeAudioData(data))
      .then(buf => { samples[name] = buf; })
      .catch(() => { /* missing sound is not worth breaking the game */ });
  }
}

function sample(name, vol) {
  if (!ctx || !samples[name]) return;
  const src = ctx.createBufferSource(); src.buffer = samples[name];
  src.playbackRate.value = 0.95 + Math.random() * 0.1;   // tiny pitch variation so repeats don't sound copy-pasted
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(g).connect(ctx.destination);
  src.start();
}

function noise(dur, freq, vol) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start();
}

function tone(f1, f2, dur, type, vol) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur);
}

// v = 0..1 distance attenuation where it matters.
export const sfx = {
  jump: () => sample('jump', 0.7),
  shot: () => { noise(0.28, 1600, 0.55); tone(140, 40, 0.16, 'square', 0.18); },
  empty: () => tone(900, 700, 0.04, 'square', 0.05),
  fireball: (v = 1) => tone(320, 90, 0.45, 'sawtooth', 0.12 * v),
  explode: (v = 1) => noise(0.35, 500, 0.3 * v),
  enemyPain: () => tone(520, 170, 0.18, 'sawtooth', 0.12),
  enemyAlert: () => tone(180, 420, 0.3, 'sawtooth', 0.1),
  death: () => tone(320, 40, 0.8, 'sawtooth', 0.16),
  playerHurt: () => tone(220, 90, 0.22, 'square', 0.16)
};
