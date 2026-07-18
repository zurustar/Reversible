/** Instrument contract (U2, C-05). Sequencer triggers instruments without knowing concrete types. */
import type { TriggerEvent } from '../domain/types';

export interface Instrument {
  /** Schedule sound at AudioContext time `when` (look-ahead). */
  trigger(event: TriggerEvent, when: number): void;
  setParam(key: string, value: number | string): void;
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
