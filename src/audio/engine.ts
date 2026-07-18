/** AudioEngine facade (U2, C-04). Manages AudioContext, master out, instruments. */
import type { Instrument } from './instrument';
import { BasslineVoice } from './bassline';
import { DrumMachine } from './drums';
import type { Song } from '../domain/types';
import { selectedInitialParams } from './engine-helpers';
import { createWorkletBasslineFilter } from './bassline-worklet';
import { FxChain } from './effects';
import { DRUM_MACHINE_STYLES } from '../domain/constants';
import type { EffectsParams } from '../domain/types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private instruments = new Map<string, Instrument>();
  private fx: FxChain | null = null;
  private initialized = false;
  /** Which Bassline filter implementation is active ('worklet' | 'biquad'). */
  filterKind: 'worklet' | 'biquad' = 'biquad';

  /** Create the AudioContext and instruments. Fail-safe (SEC-15): returns false on failure. */
  async init(song: Song): Promise<boolean> {
    if (this.initialized) return true;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      // master -> effects chain -> destination
      this.fx = new FxChain(this.ctx);
      this.master.connect(this.fx.input);
      this.fx.connect(this.ctx.destination);
      this.fx.apply(song.effects);

      const { basslineParams, drumParams } = selectedInitialParams(song);
      // One Bassline voice per track. Build all worklet filters up front; only use them if
      // EVERY voice got one, so both basses share the same filter type (consistent pitch/tone).
      const workletFilters = await Promise.all(basslineParams.map(() => createWorkletBasslineFilter(this.ctx!)));
      const allWorklet = workletFilters.every((f) => f !== null);
      this.filterKind = allWorklet ? 'worklet' : 'biquad';
      for (let i = 0; i < basslineParams.length; i++) {
        const filter = allWorklet ? workletFilters[i]! : undefined; // undefined -> voice builds its own Biquad
        const voice = new BasslineVoice(this.ctx, basslineParams[i], filter);
        voice.connect(this.master);
        this.instruments.set(`bassline-${i}`, voice);
      }
      for (let i = 0; i < drumParams.length; i++) {
        const style = DRUM_MACHINE_STYLES[i] ?? 'analog';
        const drums = new DrumMachine(this.ctx, drumParams[i], style);
        drums.connect(this.master);
        this.instruments.set(`drums-${i}`, drums);
      }
      this.initialized = true;
      return true;
    } catch (err) {
      console.error('AudioEngine init failed', err);
      return false;
    }
  }

  async resume(): Promise<void> {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.error('AudioContext resume failed', err);
      }
    }
  }

  get currentTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get masterOut(): AudioNode | null {
    return this.master;
  }

  getInstrument(id: string): Instrument | undefined {
    return this.instruments.get(id);
  }

  addInstrument(id: string, inst: Instrument): void {
    if (this.master) inst.connect(this.master);
    this.instruments.set(id, inst);
  }

  applyEffects(fx: EffectsParams): void {
    this.fx?.apply(fx);
  }
}
