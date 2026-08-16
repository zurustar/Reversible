/** SoundDesignService (S-02). Reflects param changes to store and instruments in real time. */
import type { Store } from '../state/store';
import type { AudioEngine } from '../audio/engine';
import type { DrumMachine } from '../audio/drums';
import type { BasslineParams, DrumVoiceParams, Waveform } from '../domain/types';
import type { DrumVoiceId } from '../domain/constants';

export class SoundDesignService {
  constructor(private store: Store, private engine: AudioEngine) {}

  setBasslineParam(track: number, key: keyof BasslineParams, value: number | Waveform): void {
    this.store.dispatch({ type: 'setBasslineParam', track, key, value });
    if (this.editedPatternIsSounding()) this.engine.getInstrument(`bassline-${track}`)?.setParam(key, value);
  }

  setDrumParam(machine: number, voiceId: DrumVoiceId, key: keyof DrumVoiceParams, value: number): void {
    this.store.dispatch({ type: 'setDrumParam', machine, voiceId, key, value });
    if (!this.editedPatternIsSounding()) return;
    const drums = this.engine.getInstrument(`drums-${machine}`) as DrumMachine | undefined;
    drums?.setVoiceParam(voiceId, key, value);
  }

  /**
   * Params are edited on the SELECTED pattern, but in song mode the pattern being
   * heard is the one at the chain position. Pushing an edit straight to the shared
   * instruments would then change the sound of a different pattern (the Scheduler
   * re-asserts the playing pattern's params each step, but a step later). So only
   * push immediately when the edited pattern is the one sounding.
   */
  private editedPatternIsSounding(): boolean {
    const state = this.store.getState();
    if (!state.playing || !state.songMode) return true;
    return (state.song.patternOrder[state.songPos] ?? state.selectedPatternId) === state.selectedPatternId;
  }
}
