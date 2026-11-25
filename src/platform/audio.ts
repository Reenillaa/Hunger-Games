/**
 * Procedural sound (Web Audio, no files): ambience beds per place and a few cues.
 * Starts silent; the first user gesture unlocks the context (iOS requirement).
 */
export type Ambience =
  'district-day' | 'district-night' | 'capital' | 'arena-day' | 'arena-night' | 'menu' | 'none';

interface Bed {
  stop(): void;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let current: { name: Ambience; bed: Bed } | null = null;
let level = 0.6;
let birdTimer: ReturnType<typeof setTimeout> | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = level;
  master.connect(ctx.destination);
  return ctx;
}

/** Call once at startup: the first tap or key press unlocks audio. */
export function installAudioUnlock(): void {
  const unlock = () => {
    const c = context();
    void c?.resume();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

export function setVolume(volume: number, muted: boolean): void {
  level = muted ? 0 : volume;
  if (master && ctx) master.gain.setTargetAtTime(level, ctx.currentTime, 0.2);
}

function noiseBuffer(c: AudioContext, seconds = 2): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = brown * 3.5;
  }
  return buf;
}

function noiseSource(c: AudioContext): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  return src;
}

/** Wind: looping brown noise through a slowly wandering band-pass. */
function wind(c: AudioContext, out: AudioNode, gain: number, freq = 500): () => void {
  const src = noiseSource(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.7;
  const g = c.createGain();
  g.gain.value = gain;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = c.createGain();
  lfoGain.gain.value = freq * 0.5;
  lfo.connect(lfoGain).connect(filter.frequency);
  src.connect(filter).connect(g).connect(out);
  src.start();
  lfo.start();
  return () => {
    src.stop();
    lfo.stop();
  };
}

/** A low hum (the mine's machinery far away, or the Capitol's crowd). */
function hum(c: AudioContext, out: AudioNode, freq: number, gain: number): () => void {
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq * 3;
  const g = c.createGain();
  g.gain.value = gain;
  osc.connect(filter).connect(g).connect(out);
  osc.start();
  return () => osc.stop();
}

function chirp(c: AudioContext, out: AudioNode, night: boolean): void {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  const base = night ? 4200 : 2200 + Math.random() * 1600;
  const notes = night ? 6 : 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < notes; i++) {
    const s = t + i * (night ? 0.06 : 0.12);
    osc.frequency.setValueAtTime(base * (1 + 0.15 * Math.random()), s);
    osc.frequency.exponentialRampToValueAtTime(base * (night ? 1.02 : 1.4), s + 0.08);
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(night ? 0.02 : 0.035, s + 0.01);
    g.gain.linearRampToValueAtTime(0, s + (night ? 0.04 : 0.09));
  }
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + notes * 0.15 + 0.1);
}

function birds(c: AudioContext, out: AudioNode, night: boolean): () => void {
  let alive = true;
  const next = () => {
    if (!alive) return;
    chirp(c, out, night);
    birdTimer = setTimeout(next, (night ? 900 : 2500) + Math.random() * (night ? 1200 : 6000));
  };
  birdTimer = setTimeout(next, 800);
  return () => {
    alive = false;
    if (birdTimer) clearTimeout(birdTimer);
  };
}

function makeBed(name: Ambience): Bed | null {
  const c = context();
  if (!c || !master || name === 'none') return null;
  const bus = c.createGain();
  bus.gain.value = 0;
  bus.connect(master);
  bus.gain.setTargetAtTime(1, c.currentTime, 1.2);
  const stops: (() => void)[] = [];
  const night = name.endsWith('night');
  if (name.startsWith('district')) {
    stops.push(wind(c, bus, 0.12, 380), hum(c, bus, 46, 0.035), birds(c, bus, night));
  } else if (name.startsWith('arena')) {
    stops.push(wind(c, bus, 0.16, 650), birds(c, bus, night));
  } else if (name === 'capital') {
    stops.push(wind(c, bus, 0.22, 900), hum(c, bus, 110, 0.02));
  } else if (name === 'menu') {
    stops.push(wind(c, bus, 0.08, 300), hum(c, bus, 55, 0.025));
  }
  return {
    stop() {
      bus.gain.setTargetAtTime(0, c.currentTime, 0.6);
      setTimeout(() => {
        stops.forEach((s) => s());
        bus.disconnect();
      }, 2500);
    },
  };
}

export function setAmbience(name: Ambience): void {
  if (current?.name === name) return;
  current?.bed.stop();
  const bed = makeBed(name);
  current = bed ? { name, bed } : null;
}

/** One-shot cues: a soft click, a bell for ceremonies, a distant boom for each fallen contestant. */
export function cue(kind: 'click' | 'bell' | 'boom'): void {
  const c = ctx;
  if (!c || !master || c.state !== 'running') return;
  const t = c.currentTime;
  const g = c.createGain();
  g.connect(master);
  if (kind === 'click') {
    const osc = c.createOscillator();
    osc.frequency.value = 1400;
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.06);
  } else if (kind === 'bell') {
    for (const [f, a] of [
      [440, 0.12],
      [880, 0.05],
      [1320, 0.03],
    ] as const) {
      const osc = c.createOscillator();
      const og = c.createGain();
      osc.frequency.value = f;
      og.gain.setValueAtTime(a, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      osc.connect(og).connect(g);
      osc.start(t);
      osc.stop(t + 3);
    }
    g.gain.value = 1;
  } else {
    const src = noiseSource(c);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 160;
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    src.connect(filter).connect(g);
    src.start(t);
    src.stop(t + 2.3);
  }
}

// ------------------------------------------------------------------------------- music

export type Score = 'menu' | 'district' | 'capital' | 'arena' | 'none';

interface ScoreDef {
  /** Scale degrees (semitones from the root) the melody walks on. */
  scale: number[];
  root: number;
  /** Chord roots (degrees of the scale) cycled every bar. */
  chords: number[];
  bpm: number;
  pad: OscillatorType;
  lead: OscillatorType;
  pulse: boolean;
  bright: number;
}

const SCORES: Record<Exclude<Score, 'none'>, ScoreDef> = {
  menu: {
    scale: [0, 3, 5, 7, 10],
    root: 45,
    chords: [0, 3, 2, 4],
    bpm: 54,
    pad: 'triangle',
    lead: 'sine',
    pulse: false,
    bright: 900,
  },
  district: {
    scale: [0, 2, 3, 7, 8],
    root: 48,
    chords: [0, 4, 3, 2],
    bpm: 66,
    pad: 'triangle',
    lead: 'triangle',
    pulse: false,
    bright: 1200,
  },
  capital: {
    scale: [0, 2, 4, 7, 9],
    root: 50,
    chords: [0, 3, 4, 0],
    bpm: 88,
    pad: 'sawtooth',
    lead: 'square',
    pulse: true,
    bright: 2200,
  },
  arena: {
    scale: [0, 1, 3, 6, 7],
    root: 41,
    chords: [0, 0, 1, 3],
    bpm: 96,
    pad: 'sawtooth',
    lead: 'sine',
    pulse: true,
    bright: 700,
  },
};

let musicGain: GainNode | null = null;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicOn = true;
let currentScore: Score = 'none';

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function note(
  c: AudioContext,
  out: AudioNode,
  midi: number,
  t: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  cutoff: number,
): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  osc.type = type;
  osc.frequency.value = freq(midi);
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(0.4, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(f).connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Generative score: a slow pad on the chord of the bar, a sparse melody, an optional pulse. */
export function setScore(score: Score): void {
  if (score === currentScore) return;
  currentScore = score;
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  const c = context();
  if (!c || !master) return;
  if (!musicGain) {
    musicGain = c.createGain();
    musicGain.gain.value = musicOn ? 0.35 : 0;
    musicGain.connect(master);
  }
  if (score === 'none') return;
  const def = SCORES[score];
  const beat = 60 / def.bpm;
  let step = 0;
  let melody = 2;
  let next = c.currentTime + 0.3;
  const tick = () => {
    if (!musicGain || c.state !== 'running') return;
    while (next < c.currentTime + 1.2) {
      const bar = Math.floor(step / 8);
      const chordDeg = def.chords[bar % def.chords.length]!;
      const chordRoot = def.root + def.scale[chordDeg % def.scale.length]!;
      if (step % 8 === 0) {
        for (const iv of [0, 7, 12, def.scale[2]! + 12])
          note(c, musicGain, chordRoot + iv - 12, next, beat * 8.5, def.pad, 0.05, def.bright);
      }
      // Sparse melody: a random walk on the scale, resting often.
      if (Math.random() < (score === 'arena' ? 0.35 : 0.45) && step % 2 === 0) {
        melody = Math.max(0, Math.min(9, melody + Math.floor(Math.random() * 3) - 1));
        const octave = Math.floor(melody / def.scale.length);
        const midi = def.root + 12 + octave * 12 + def.scale[melody % def.scale.length]!;
        note(
          c,
          musicGain,
          midi,
          next,
          beat * (1.5 + Math.random() * 2),
          def.lead,
          0.045,
          def.bright * 1.5,
        );
      }
      if (def.pulse && step % 2 === 0)
        note(c, musicGain, def.root - 12, next, beat * 0.4, 'sine', 0.08, 300);
      step += 1;
      next += beat / 2;
    }
  };
  musicTimer = setInterval(tick, 250);
}

export function setMusicEnabled(on: boolean): void {
  musicOn = on;
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(on ? 0.35 : 0, ctx.currentTime, 0.4);
}
