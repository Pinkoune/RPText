// Sons procéduraux via Web Audio (aucun fichier asset requis).
import type { Phase, BiomeId } from './types';

type SoundName = 'hit' | 'win' | 'lose' | 'levelup' | 'coin' | 'click';

const MUTE_KEY = 'rptext.muted';
let muted = localStorage.getItem(MUTE_KEY) === '1';
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function beep(freq: number, durMs: number, type: OscillatorType, when: number, gain: number) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ac.currentTime + when);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + when + durMs / 1000);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + when);
  osc.stop(ac.currentTime + when + durMs / 1000);
}

const PATTERNS: Record<SoundName, () => void> = {
  click: () => beep(420, 50, 'square', 0, 0.04),
  hit: () => beep(180, 90, 'sawtooth', 0, 0.06),
  coin: () => { beep(880, 70, 'triangle', 0, 0.06); beep(1320, 90, 'triangle', 0.06, 0.05); },
  win: () => { beep(660, 90, 'triangle', 0, 0.06); beep(880, 90, 'triangle', 0.09, 0.06); beep(1320, 140, 'triangle', 0.18, 0.06); },
  lose: () => { beep(300, 140, 'sawtooth', 0, 0.06); beep(180, 200, 'sawtooth', 0.12, 0.06); },
  levelup: () => { beep(523, 90, 'triangle', 0, 0.06); beep(659, 90, 'triangle', 0.09, 0.06); beep(784, 90, 'triangle', 0.18, 0.06); beep(1047, 200, 'triangle', 0.27, 0.07); },
};

export function playSound(name: SoundName) {
  if (muted) return;
  PATTERNS[name]?.();
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  if (muted) stopAmbient();
  else if (lastAmbient) startAmbient(lastAmbient.phase, lastAmbient.biome);
  return muted;
}

// ─── Musique d'ambiance procédurale ────────────────────────────────────────

// Accord (Hz) par phase : majeur lumineux le jour, mineur grave la nuit.
const CHORDS: Record<Phase, number[]> = {
  dawn: [146.83, 220.0, 293.66, 369.99], // Ré
  day: [130.81, 196.0, 261.63, 329.63], // Do majeur
  dusk: [110.0, 164.81, 220.0, 277.18], // La chaud
  night: [98.0, 146.83, 196.0, 233.08], // Sol mineur grave
};

// Timbre selon le biome.
const BIOME_WAVE: Partial<Record<BiomeId, OscillatorType>> = {
  forest: 'sine',
  plains: 'triangle',
  mountains: 'sine',
  desert: 'sawtooth',
  swamp: 'sine',
  frozen: 'triangle',
};

interface Ambient {
  oscs: OscillatorNode[];
  gains: GainNode[];
  master: GainNode;
  arp: ReturnType<typeof setInterval>;
}

let ambient: Ambient | null = null;
let lastAmbient: { phase: Phase; biome: BiomeId } | null = null;
let gestureHooked = false;

function startAmbient(phase: Phase, biome: BiomeId) {
  lastAmbient = { phase, biome };
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;

  // Reprend le contexte audio au premier geste utilisateur si nécessaire.
  if (!gestureHooked) {
    gestureHooked = true;
    const resume = () => ac.resume();
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }

  if (ambient) return updateAmbient(phase, biome);

  const chord = CHORDS[phase];
  const wave = BIOME_WAVE[biome] ?? 'sine';
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 4);
  master.connect(ac.destination);

  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  chord.forEach((f, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = wave;
    osc.frequency.value = f;
    g.gain.value = i === 0 ? 0.5 : 0.25; // fondamentale plus présente
    osc.connect(g).connect(master);
    osc.start();
    oscs.push(osc);
    gains.push(g);
  });

  // Arpège doux occasionnel (note tenue une octave plus haut).
  const arp = setInterval(() => {
    if (muted || !ambient) return;
    const c = CHORDS[lastAmbient!.phase];
    const f = c[Math.floor(Math.random() * c.length)] * 2;
    beep(f, 900, 'sine', 0, 0.03);
  }, 4200);

  ambient = { oscs, gains, master, arp };
}

function updateAmbient(phase: Phase, biome: BiomeId) {
  lastAmbient = { phase, biome };
  const ac = getCtx();
  if (!ac || !ambient) return;
  const chord = CHORDS[phase];
  const wave = BIOME_WAVE[biome] ?? 'sine';
  ambient.oscs.forEach((osc, i) => {
    osc.type = wave;
    if (chord[i] != null) osc.frequency.exponentialRampToValueAtTime(chord[i], ac.currentTime + 2.5);
  });
}

function stopAmbient() {
  if (!ambient) return;
  const ac = getCtx();
  const a = ambient;
  ambient = null;
  clearInterval(a.arp);
  try {
    if (ac) a.master.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1);
    a.oscs.forEach((o) => o.stop((ac?.currentTime ?? 0) + 1.2));
  } catch {
    /* déjà arrêté */
  }
}

/** Lance/ajuste l'ambiance selon la phase et le biome (appelé par l'app). */
export function setAmbient(phase: Phase, biome: BiomeId) {
  if (muted) {
    lastAmbient = { phase, biome };
    return;
  }
  if (ambient) updateAmbient(phase, biome);
  else startAmbient(phase, biome);
}

export function stopAmbientMusic() {
  stopAmbient();
}
