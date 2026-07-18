/** PatternEditService (S-03). Step programming. */
import type { Store } from '../state/store';
import type { BasslineStep } from '../domain/types';
import type { DrumVoiceId } from '../domain/constants';

export class PatternEditService {
  constructor(private store: Store) {}

  toggleDrumStep(machine: number, voiceId: DrumVoiceId, index: number): void {
    this.store.dispatch({ type: 'toggleDrumStep', machine, voiceId, index });
  }

  /** Cycle a drum step: off -> on -> on+accent -> off. */
  cycleDrumStep(machine: number, voiceId: DrumVoiceId, index: number): void {
    this.store.dispatch({ type: 'cycleDrumStep', machine, voiceId, index });
  }

  setDrumStepAccent(machine: number, voiceId: DrumVoiceId, index: number, accent: boolean): void {
    this.store.dispatch({ type: 'setDrumStepAccent', machine, voiceId, index, accent });
  }

  setBasslineStep(track: number, index: number, step: Partial<BasslineStep>): void {
    this.store.dispatch({ type: 'setBasslineStep', track, index, step });
  }
}
