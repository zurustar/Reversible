/** Instrument contract (U2, C-05). Sequencer triggers instruments without knowing concrete types. */
import type { TriggerEvent } from '../domain/types';

export interface Instrument {
  /**
   * Schedule sound at AudioContext time `when` (look-ahead). `stepDur` is the
   * length of one sequencer step in seconds; a bassline note that slides holds
   * for this long (tie) before releasing. Instruments that don't tie ignore it.
   */
  trigger(event: TriggerEvent, when: number, stepDur?: number): void;
  /**
   * Set one sound parameter. `when` (AudioContext time) schedules the change for
   * params that drive an AudioParam directly; omit it to apply immediately (live
   * knob turns). Scheduling matters for offline rendering, where the whole song
   * is scheduled up front and `currentTime` never advances.
   */
  setParam(key: string, value: number | string, when?: number): void;
  /** Per-voice params (drum machines). Single-voice instruments omit it. */
  setVoiceParam?(voiceId: string, key: string, value: number, when?: number): void;
  connect(destination: AudioNode): void;
}

/** Swappable Bassline filter stage (MVP: BiquadFilter; future: AudioWorklet). */
export interface BasslineFilter {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Schedule a filter envelope hit at `when` with the given normalized params. */
  triggerEnvelope(
    when: number,
    opts: { cutoff: number; resonance: number; envMod: number; decay: number; accent: boolean; accentAmount: number },
  ): void;
}
