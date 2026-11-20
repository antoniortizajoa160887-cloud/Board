import { profile } from './save';

/** Sound is made in code with Web Audio: a soft lounge loop and short casino effects. */

let ctx: AudioContext | null = null;
let master: GainNode;
let musicBus: GainNode;
let sfxBus: GainNode;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus.connect(master);
  sfxBus.connect(master);
  applyVolumes();
  return ctx;
}

export function applyVolumes() {
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(profile.settings.music ? 0.22 : 0, ctx.currentTime, 0.2);
  sfxBus.gain.setTargetAtTime(profile.settings.sound ? 0.7 : 0, ctx.currentTime, 0.05);
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
  startMusic();
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function tone(freq: number, start: number, dur: number, o: { type?: OscillatorType; gain?: number; to?: AudioNode; glideTo?: number; attack?: number } = {}) {
  const c = ctx!;
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, start);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, start + dur);
  const g = c.createGain();
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, start + a);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(o.to ?? sfxBus);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noise(start: number, dur: number, gain = 0.2, freq = 3000) {
  const c = ctx!;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(sfxBus);
  src.start(start);
}

export type Sfx = 'chip' | 'card' | 'click' | 'reel' | 'stop' | 'win' | 'bigwin' | 'lose' | 'ball' | 'tick' | 'daub' | 'jackpot';

export function sfx(name: Sfx) {
  const c = ensure();
  if (!c || !profile.settings.sound) return;
  const t = c.currentTime;
  switch (name) {
    case 'chip':
      tone(2400, t, 0.06, { type: 'triangle', gain: 0.2 });
      tone(3100, t + 0.03, 0.08, { type: 'triangle', gain: 0.15 });
      break;
    case 'card': noise(t, 0.09, 0.35, 2200); break;
    case 'click': tone(900, t, 0.05, { type: 'square', gain: 0.06 }); break;
    case 'reel': noise(t, 0.05, 0.12, 1200); break;
    case 'stop': tone(180, t, 0.12, { type: 'triangle', gain: 0.35, glideTo: 90 }); break;
    case 'tick': tone(1800, t, 0.03, { type: 'square', gain: 0.05 }); break;
    case 'ball': tone(700, t, 0.25, { type: 'sine', gain: 0.25, glideTo: 1400 }); break;
    case 'daub': tone(520, t, 0.1, { type: 'sine', gain: 0.25, glideTo: 260 }); break;
    case 'lose': tone(330, t, 0.25, { type: 'triangle', gain: 0.18, glideTo: 220 }); break;
    case 'win':
      [72, 76, 79, 84].forEach((n, i) => tone(midi(n), t + i * 0.08, 0.3, { type: 'triangle', gain: 0.22 }));
      break;
    case 'bigwin':
      [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => tone(midi(n), t + i * 0.07, 0.45, { type: 'triangle', gain: 0.24 }));
      for (let i = 0; i < 12; i++) tone(2000 + Math.random() * 2000, t + 0.4 + i * 0.05, 0.08, { type: 'triangle', gain: 0.1 });
      break;
    case 'jackpot':
      for (let r = 0; r < 3; r++) [72, 76, 79, 84, 88].forEach((n, i) => tone(midi(n + r * 2), t + r * 0.5 + i * 0.07, 0.5, { type: 'square', gain: 0.1 }));
      for (let i = 0; i < 30; i++) tone(2000 + Math.random() * 3000, t + 0.3 + i * 0.05, 0.08, { type: 'triangle', gain: 0.08 });
      break;
  }
}

// A gentle lounge loop: 7th chords on a slow swing, a walking bass, a few random high notes.
let musicTimer = 0;
const CHORDS = [[57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71]];
const BASS = [45, 50, 43, 48];

function startMusic() {
  if (musicTimer || !ctx) return;
  let bar = 0;
  const play = () => {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.05;
    const beat = 0.62;
    const chord = CHORDS[bar % CHORDS.length];
    chord.forEach(n => tone(midi(n), t, beat * 3.6, { type: 'sine', gain: 0.07, attack: 0.08, to: musicBus }));
    for (let b = 0; b < 4; b++) tone(midi(BASS[bar % 4] + [0, 7, 12, 7][b]), t + b * beat, beat * 0.9, { type: 'triangle', gain: 0.12, to: musicBus });
    for (let b = 0; b < 4; b++) if (Math.random() < 0.35) tone(midi(chord[Math.floor(Math.random() * 4)] + 12), t + b * beat + beat * 0.66, beat * 0.8, { type: 'sine', gain: 0.05, to: musicBus });
    bar++;
  };
  play();
  musicTimer = window.setInterval(play, 0.62 * 4 * 1000);
}
