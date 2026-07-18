/** Pure 0..1 -> real value maps (U2). Clamped -> outputs always in range (PBT-03). */
import { clamp01 } from '../util/num';

/** Filter cutoff: exponential 30 Hz .. 12000 Hz. */
export function cutoffToHz(v: number): number {
  const c = clamp01(v);
  return 30 * Math.pow(12000 / 30, c);
}

/** Resonance -> Biquad Q: 0.5 .. 20. */
export function resonanceToQ(v: number): number {
  return 0.5 + clamp01(v) * 19.5;
}

/** Amp/filter decay: 0.03 s .. 1.5 s. */
export function decayToSeconds(v: number): number {
  return 0.03 + clamp01(v) * (1.5 - 0.03);
}

/** Tune: -1200 .. +1200 cents (0.5 = 0). */
export function tuneToCents(v: number): number {
  return (clamp01(v) * 2 - 1) * 1200;
}

/** Env modulation depth as a fraction 0..1. */
export function envModAmount(v: number): number {
  return clamp01(v);
}

/** Accent amount 0..1. */
export function accentAmount(v: number): number {
  return clamp01(v);
}

/** Volume/level -> linear gain 0..1. */
export function levelToGain(v: number): number {
  return clamp01(v);
}

/** Bassline note (semitone index) -> frequency (Hz). Base note index 0 = C2 (MIDI 36). */
export function noteToFreq(note: number, tuneCents = 0): number {
  const midi = 36 + note;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  return freq * Math.pow(2, tuneCents / 1200);
}
