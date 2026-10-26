// Synthesises the demo soundtrack: node scripts/make-soundtrack.mjs <cues.json> <out.wav>
// An original, procedurally generated piece (pad, music-box arpeggio, bass, soft drums and a
// bell melody over I–vi–IV–V) plus page-turn, pop-up and click effects timed from the cues.
import { readFileSync, writeFileSync } from 'node:fs';

const [cuesPath, outPath] = process.argv.slice(2);
if (!cuesPath || !outPath) {
  console.error('usage: node scripts/make-soundtrack.mjs <cues.json> <out.wav>');
  process.exit(1);
}
const { duration, cues } = JSON.parse(readFileSync(cuesPath, 'utf8'));

const SR = 48000;
const LEN = Math.ceil((duration + 0.3) * SR);
const L = new Float32Array(LEN);
const R = new Float32Array(LEN);
const TAU = Math.PI * 2;
const BEAT = 60 / 96;
const BAR = BEAT * 4;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Deterministic noise so every render is identical.
let seed = 12345;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};

function add(t0, dur, pan, fn) {
  const i0 = Math.max(0, Math.floor(t0 * SR));
  const i1 = Math.min(LEN, Math.floor((t0 + dur) * SR));
  const gl = Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = i0; i < i1; i++) {
    const v = fn((i - i0) / SR);
    L[i] += v * gl;
    R[i] += v * gr;
  }
}

// ---- voices ----

function pad(t0, dur, notes, gain) {
  for (const n of notes) {
    for (const [detune, pan] of [[-0.12, -0.6], [0.12, 0.6]]) {
      const f = midi(n + detune);
      let lp = 0;
      add(t0, dur + 1.2, pan, (t) => {
        const env = Math.min(1, t / 0.7) * (t > dur ? Math.exp(-(t - dur) * 3) : 1);
        const ph = (t * f) % 1;
        const tri = 4 * Math.abs(ph - 0.5) - 1;
        const saw = 2 * ph - 1;
        lp += 0.08 * (0.7 * tri + 0.3 * saw - lp);
        return lp * env * gain;
      });
    }
  }
}

function bell(t0, n, gain, pan, decay = 4.5) {
  const f = midi(n);
  add(t0, 1.6, pan, (t) => {
    const mod = 0.9 * Math.exp(-t * 9) * Math.sin(TAU * 2 * f * t);
    const env = Math.min(1, t / 0.004) * Math.exp(-t * decay);
    return (Math.sin(TAU * f * t + mod) + 0.18 * Math.sin(TAU * 2 * f * t)) * env * gain;
  });
}

function bass(t0, n, gain) {
  const f = midi(n);
  add(t0, 0.9, 0, (t) => {
    const env = Math.min(1, t / 0.01) * Math.exp(-t * 3.2);
    return Math.tanh(1.6 * Math.sin(TAU * f * t)) * env * gain;
  });
}

function kick(t0, gain) {
  let ph = 0;
  add(t0, 0.35, 0, (t) => {
    ph += (45 + 75 * Math.exp(-t * 28)) / SR;
    return Math.sin(TAU * ph) * Math.exp(-t * 11) * gain;
  });
}

function hat(t0, gain, pan) {
  let prev = 0;
  add(t0, 0.06, pan, (t) => {
    const n = noise();
    const hp = n - prev;
    prev = n;
    return hp * Math.exp(-t * 70) * gain;
  });
}

// Band-passed noise with a moving centre frequency.
function bandNoise(t0, dur, gain, freqAt, envAt, q = 1.2) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 0, b2 = 0, a1 = 0, a2 = 0;
  let k = 0;
  add(t0, dur, 0, (t) => {
    if (k++ % 32 === 0) {
      const w = (TAU * freqAt(t / dur)) / SR;
      const alpha = Math.sin(w) / (2 * q);
      const a0 = 1 + alpha;
      b0 = alpha / a0;
      b2 = -alpha / a0;
      a1 = (-2 * Math.cos(w)) / a0;
      a2 = (1 - alpha) / a0;
    }
    const x = noise();
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y * envAt(t / dur) * gain;
  });
}

// ---- music ----

const CHORDS = [
  { root: 36, notes: [55, 60, 64, 67] }, // C
  { root: 45, notes: [52, 57, 60, 64] }, // Am
  { root: 41, notes: [53, 57, 60, 65] }, // F
  { root: 43, notes: [50, 55, 59, 62] }, // G
];
const MELODY = [
  [[76, 1], [79, 1], [84, 2]],
  [[81, 1], [79, 1], [76, 2]],
  [[77, 1], [81, 1], [84, 1], [81, 1]],
  [[79, 2], [74, 1], [71, 1]],
  [[76, 1], [79, 1], [84, 1.5], [83, 0.5]],
  [[81, 2], [79, 1], [76, 1]],
  [[77, 1], [76, 1], [74, 1], [77, 1]],
  [[79, 3], [0, 1]],
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
const bars = Math.ceil(duration / BAR);
for (let b = 0; b < bars; b++) {
  const t = b * BAR;
  const chord = CHORDS[b % 4];
  const last = b === bars - 1;
  pad(t, BAR, chord.notes, 0.035);
  if (b >= 1) {
    ARP.forEach((k, i) => bell(t + (i * BEAT) / 2, chord.notes[k] + 12, 0.055, i % 2 ? 0.35 : -0.35, 5.5));
    bass(t, chord.root, 0.16);
    bass(t + 2 * BEAT, chord.root + (b % 2 ? 7 : 0), 0.12);
  }
  if (b >= 2 && !last) {
    kick(t, 0.32);
    kick(t + 2 * BEAT, 0.26);
    for (let i = 0; i < 8; i++) hat(t + (i * BEAT) / 2 + BEAT / 4, i % 2 ? 0.05 : 0.03, 0.2);
  }
  if (b >= 4 && b < bars - 1) {
    let beat = 0;
    for (const [n, len] of MELODY[(b - 4) % MELODY.length]) {
      if (n) bell(t + beat * BEAT, n, 0.075, 0.1, 3.2);
      beat += len;
    }
  }
}

// ---- effects ----

const turns = cues.filter((c) => c.type === 'turn' || c.type === 'cover');
turns.forEach((c, i) => {
  const next = turns[i + 1];
  const fast = next && next.t - c.t < 0.9;
  const heavy = c.type === 'cover';
  // Paper swish: a filtered noise sweep as the page lifts and falls.
  bandNoise(c.t + 0.05, heavy ? 1.1 : 0.7, heavy ? 0.34 : fast ? 0.2 : 0.27,
    (p) => 600 + 2600 * Math.sin(Math.PI * Math.min(1, p * 1.2)),
    (p) => Math.sin(Math.PI * p) ** 1.5, 0.9);
  // Settling thump and the pop-up springing up.
  const land = heavy ? 1.75 : fast ? 0.7 : 1.35;
  add(c.t + land, 0.25, 0, (t) => Math.sin(TAU * (heavy ? 70 : 110) * t) * Math.exp(-t * 22) * (heavy ? 0.35 : 0.14));
  if (!fast) {
    const at = c.t + (heavy ? 1.3 : 0.95);
    let ph = 0;
    add(at, 0.18, 0, (t) => {
      ph += (320 + 900 * Math.min(1, t / 0.08)) / SR;
      return Math.sin(TAU * ph) * Math.exp(-t * 18) * 0.12;
    });
  }
});
for (const c of cues.filter((c) => c.type === 'click' || c.type === 'grab')) {
  const g = c.type === 'click' ? 0.16 : 0.1;
  add(c.t, 0.05, 0, (t) => (Math.sin(TAU * 1900 * t) * 0.6 + noise() * 0.4) * Math.exp(-t * 160) * g);
}

// ---- master: fade in/out, soft limit, write 16-bit stereo WAV ----

let peak = 0;
for (let i = 0; i < LEN; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.4) * Math.min(1, (duration - t) / 2.2);
  L[i] = Math.tanh(L[i] * 1.2) * Math.max(0, fade);
  R[i] = Math.tanh(R[i] * 1.2) * Math.max(0, fade);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = peak > 0 ? 0.89 / peak : 1;
const buf = Buffer.alloc(44 + LEN * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + LEN * 4, 4);
buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(LEN * 4, 40);
for (let i = 0; i < LEN; i++) {
  buf.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4);
}
writeFileSync(outPath, buf);
console.log(`wrote ${outPath}: ${(LEN / SR).toFixed(1)}s, ${cues.length} cues, peak ${peak.toFixed(2)}`);
