/** AudioEngine facade (U2, C-04). Manages AudioContext, master out, instruments. */
import type { Instrument } from './instrument';
import type { Song } from '../domain/types';
import { buildAudioGraph } from './graph';
import { FxChain } from './effects';
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
      const graph = await buildAudioGraph(this.ctx, song);
      this.master = graph.master;
      this.fx = graph.fx;
      this.instruments = graph.instruments;
      this.filterKind = graph.filterKind;
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
