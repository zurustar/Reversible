/** Domain types (U1 Core). Plain serializable data. U2 imports these as types only. */
import type { DrumVoiceId } from './constants';

export type Waveform = 'saw' | 'square';

export interface BasslineStep {
  on: boolean;
  note: number; // integer semitone [NOTE_MIN, NOTE_MAX]; ignored when on=false
  accent: boolean;
  slide: boolean;
}

export interface BasslineParams {
  waveform: Waveform;
  tune: number; // 0..1 (0.5 = center)
  cutoff: number; // 0..1
  resonance: number; // 0..1
  envMod: number; // 0..1
  decay: number; // 0..1
  accent: number; // 0..1
  volume: number; // 0..1
  drive?: number; // 0..1 overdrive/distortion (0 = clean)
  slideTime?: number; // 0..1 glide time for slides
}

export interface DrumStep {
  on: boolean;
  accent?: boolean;
}

export interface DrumVoiceParams {
  level: number; // 0..1
  tone?: number; // 0..1
  decay?: number; // 0..1
  tune?: number; // 0..1
  snappy?: number; // 0..1 (snare: tonal body vs noise balance)
}

export interface DrumVoicePattern {
  steps: DrumStep[];
  params: DrumVoiceParams;
}

export interface BasslineTrack {
  steps: BasslineStep[];
  params: BasslineParams;
}

export interface DrumTrack {
  voices: Record<DrumVoiceId, DrumVoicePattern>;
}

export interface Pattern {
  id: string;
  length: number; // === STEP_COUNT
  bassline: BasslineTrack[]; // BASSLINE_COUNT tracks
  drums: DrumTrack[]; // DRUM_MACHINE_COUNT machines (analog, digital)
}

export interface EffectsParams {
  distortion: { on: boolean; amount: number }; // amount 0..1
  delay: { on: boolean; time: number; feedback: number; mix: number }; // all 0..1
  pcf: { on: boolean; rate: number; depth: number; cutoff: number; resonance: number }; // all 0..1
  compressor: { on: boolean; amount: number }; // amount 0..1
}

export interface Song {
  schemaVersion: number;
  name: string;
  bpm: number;
  swing: number; // 0..1
  patterns: Pattern[];
  patternOrder: string[];
  effects: EffectsParams;
}

/** Trigger event passed from sequencer to instruments (audio layer). */
export interface TriggerEvent {
  note?: number;
  accent?: boolean;
  slide?: boolean;
  voiceId?: string;
}
