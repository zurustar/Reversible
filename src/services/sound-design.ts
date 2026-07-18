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
    this.engine.getInstrument(`bassline-${track}`)?.setParam(key, value);
  }

  setDrumParam(machine: number, voiceId: DrumVoiceId, key: keyof DrumVoiceParams, value: number): void {
    this.store.dispatch({ type: 'setDrumParam', machine, voiceId, key, value });
    const drums = this.engine.getInstrument(`drums-${machine}`) as DrumMachine | undefined;
    drums?.setVoiceParam(voiceId, key, value);
  }
}
