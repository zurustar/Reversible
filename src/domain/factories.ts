/** Pure factories for domain entities (U1 Core). */
import {
  SCHEMA_VERSION,
  STEP_COUNT,
  BPM_DEFAULT,
  BASSLINE_COUNT,
  DRUM_MACHINE_COUNT,
  DRUM_VOICE_IDS,
  type DrumVoiceId,
} from './constants';
import type {
  BasslineParams,
  BasslineStep,
  BasslineTrack,
  DrumStep,
  DrumTrack,
  DrumVoiceParams,
  DrumVoicePattern,
  EffectsParams,
  Pattern,
  Song,
} from './types';

export function createDefaultEffects(): EffectsParams {
  return {
    distortion: { on: false, amount: 0.3 },
    delay: { on: false, time: 0.35, feedback: 0.35, mix: 0.3 },
    pcf: { on: false, rate: 0.3, depth: 0.5, cutoff: 0.6, resonance: 0.4 },
    compressor: { on: false, amount: 0.4 },
  };
}

function defaultBasslineParams(): BasslineParams {
  return {
    waveform: 'saw',
    tune: 0.5,
    cutoff: 0.45,
    resonance: 0.5,
    envMod: 0.5,
    decay: 0.4,
    accent: 0.6,
    volume: 0.8,
    drive: 0,
    slideTime: 0.4,
  };
}

function defaultDrumParams(): DrumVoiceParams {
  return { level: 0.8, tone: 0.5, decay: 0.5, tune: 0.5, snappy: 0.5 };
}

function emptyBasslineStep(): BasslineStep {
  return { on: false, note: 12, accent: false, slide: false };
}

function emptyDrumStep(): DrumStep {
  return { on: false, accent: false };
}

export function createBasslineTrack(): BasslineTrack {
  return {
    steps: Array.from({ length: STEP_COUNT }, emptyBasslineStep),
    params: defaultBasslineParams(),
  };
}

function createDrumVoicePattern(): DrumVoicePattern {
  return {
    steps: Array.from({ length: STEP_COUNT }, emptyDrumStep),
    params: defaultDrumParams(),
  };
}

export function createDrumTrack(): DrumTrack {
  const voices = {} as Record<DrumVoiceId, DrumVoicePattern>;
  for (const id of DRUM_VOICE_IDS) {
    voices[id] = createDrumVoicePattern();
  }
  return { voices };
}

let patternCounter = 0;
export function createEmptyPattern(id?: string): Pattern {
  const pid = id ?? `pattern-${++patternCounter}`;
  return {
    id: pid,
    length: STEP_COUNT,
    bassline: Array.from({ length: BASSLINE_COUNT }, createBasslineTrack),
    drums: Array.from({ length: DRUM_MACHINE_COUNT }, createDrumTrack),
  };
}

export function createEmptySong(name = 'Untitled'): Song {
  const pattern = createEmptyPattern('pattern-1');
  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    bpm: BPM_DEFAULT,
    swing: 0,
    patterns: [pattern],
    patternOrder: [pattern.id],
    effects: createDefaultEffects(),
  };
}
