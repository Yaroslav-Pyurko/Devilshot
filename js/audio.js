// Sound effects (WebAudio): mostly synthesized, plus a few short recorded samples.
let ctx = null;

// Recorded samples in assets/sounds, loaded once audio is unlocked.
const SAMPLE_FILES = {
  jump: 'assets/sounds/jump.mp3',
  impGrowl: 'assets/sounds/imp_growl.mp3',
  fireballLaunch: 'assets/sounds/fireball_start_launching.mp3',   // leaves the imp's hand (the flight roar is synthesized: Roar)
  fireballHit: 'assets/sounds/fireball_finish_hits.mp3'           // explodes on impact
};
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

// A sample playing on a seamless loop, with volume and stereo position that can change every frame.
// Starts by itself as soon as audio is unlocked and the sample has loaded.
export class LoopSound {
  constructor(name) { this.name = name; this.src = null; }

  set(volume, pan = 0) {
    if (!ctx || !samples[this.name]) return;
    if (!this.src) {
      this.src = ctx.createBufferSource();
      this.src.buffer = samples[this.name];
      this.src.loop = true;
      this.gain = ctx.createGain(); this.gain.gain.value = 0;
      this.panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      let node = this.src.connect(this.gain);
      if (this.panner) node = node.connect(this.panner);
      node.connect(ctx.destination);
      this.src.start(0, Math.random() * this.src.buffer.duration); // random start so it never sounds identical
    }
    // smooth changes (~0.1 s) so movement never produces clicks or zipper noise
    const t = ctx.currentTime;
    this.gain.gain.setTargetAtTime(volume, t, 0.1);
    if (this.panner) this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.1);
  }
}

// A sample attached to a moving object: plays once (or loops with `loop`), its volume and stereo
// position follow the object every frame (set), and it can be cut short with a quick fade (stop).
export class Voice {
  static has(name) { return !!(ctx && samples[name]); }

  constructor(name, volume = 0, pan = 0, loop = false) {
    if (!ctx || !samples[name]) return;   // not loaded yet: silent, every method is then a no-op
    this.src = ctx.createBufferSource();
    this.src.buffer = samples[name];
    this.src.loop = loop;
    this.gain = ctx.createGain(); this.gain.gain.value = volume;
    this.panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (this.panner) this.panner.pan.value = Math.max(-1, Math.min(1, pan));
    let node = this.src.connect(this.gain);
    if (this.panner) node = node.connect(this.panner);
    node.connect(ctx.destination);
    // a loop starts at a random point so several balls in the air don't sound in unison
    this.src.start(0, loop ? Math.random() * this.src.buffer.duration : 0);
  }

  set(volume, pan = 0) {
    if (!this.src) return;
    const t = ctx.currentTime;
    this.gain.gain.setTargetAtTime(volume, t, 0.05);
    if (this.panner) this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.05);
  }

  stop() {
    if (!this.src) return;
    const t = ctx.currentTime;
    this.gain.gain.setTargetAtTime(0, t, 0.03);
    try { this.src.stop(t + 0.15); } catch { /* already finished */ }
    this.src = null;
  }
}

// Synthesized rocket-style roar for things in flight (fireballs), in the spirit of the Quake 3 rocket:
// a low rumble, a hot hiss on top and an irregular flame flutter. It is built from long noise, so
// unlike a short recorded loop it never repeats audibly. set() also takes a Doppler factor:
// above 1 while the source comes at you (higher pitch), below 1 as it flies away.
const noiseBanks = new WeakMap();
function noiseBank(ac) {   // 4 s of white and brown noise per audio context, shared by all roars
  let bank = noiseBanks.get(ac);
  if (bank) return bank;
  const len = ac.sampleRate * 4;
  const white = ac.createBuffer(1, len, ac.sampleRate), brown = ac.createBuffer(1, len, ac.sampleRate);
  const w = white.getChannelData(0), b = brown.getChannelData(0);
  let last = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    w[i] = Math.random() * 2 - 1;
    last = (last + 0.02 * w[i]) / 1.02; b[i] = last; peak = Math.max(peak, Math.abs(last));
  }
  for (let i = 0; i < len; i++) b[i] /= peak;
  bank = { white, brown }; noiseBanks.set(ac, bank);
  return bank;
}

export class Roar {
  constructor(volume = 0, pan = 0, ac = ctx, out = ac && ac.destination) {
    if (!ac) return;   // audio not unlocked yet: silent no-op
    this.ac = ac;
    const { white, brown } = noiseBank(ac);
    const src = (buf, rate = 1) => {
      const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
      s.start(0, Math.random() * buf.duration); return s;   // random offset: no two roars alike
    };
    const filter = (type, f, q = 0.7) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
    const gain = v => { const g = ac.createGain(); g.gain.value = v; return g; };

    // flame flutter: the overall level wobbles irregularly (noise slowed far down, not a sine)
    this.flutter = gain(0.4);
    const wobble = src(white, 0.002), wobbleLp = filter('lowpass', 12), wobbleDepth = gain(0.17);
    wobble.connect(wobbleLp).connect(wobbleDepth).connect(this.flutter.gain);

    // body: deep rumble
    this.bodySrc = src(brown);
    this.bodyLp = filter('lowpass', 420, 1.1);
    this.bodySrc.connect(this.bodyLp).connect(gain(1.6)).connect(this.flutter);
    // roar: mid "fwoosh"
    this.midSrc = src(white);
    this.midBp = filter('bandpass', 650, 0.9);
    this.midSrc.connect(this.midBp).connect(gain(0.32)).connect(this.flutter);
    // hiss: hot sizzle on top
    this.hiss = filter('bandpass', 3200, 0.6);
    const hissSrc = src(white);
    hissSrc.connect(this.hiss).connect(gain(0.05)).connect(this.flutter);

    this.out = gain(volume);
    this.panner = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (this.panner) this.panner.pan.value = Math.max(-1, Math.min(1, pan));
    let node = this.flutter.connect(this.out);
    if (this.panner) node = node.connect(this.panner);
    node.connect(out);
    this.sources = [wobble, this.bodySrc, this.midSrc, hissSrc];
    this.alive = true;
  }

  set(volume, pan = 0, doppler = 1) {
    if (!this.alive) return;
    const t = this.ac.currentTime, k = 0.05;
    this.out.gain.setTargetAtTime(volume, t, k);
    if (this.panner) this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, k);
    this.bodyLp.frequency.setTargetAtTime(420 * doppler, t, k);
    this.midBp.frequency.setTargetAtTime(650 * doppler, t, k);
    this.hiss.frequency.setTargetAtTime(3200 * doppler, t, k);
  }

  stop() {
    if (!this.alive) return;
    const t = this.ac.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.03);
    for (const s of this.sources) { try { s.stop(t + 0.15); } catch { /* already stopped */ } }
    this.alive = false;
  }
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
