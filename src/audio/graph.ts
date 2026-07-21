/** Build the instrument + master + effects node graph for a song against any
 * BaseAudioContext. Shared by the live AudioEngine and the offline WAV renderer
 * so both produce an identical signal path. */
import type { Instrument } from './instrument';
import { BasslineVoice } from './bassline';
import { DrumMachine } from './drums';
import { FxChain } from './effects';
import { selectedInitialParams } from './engine-helpers';
import { createWorkletBasslineFilter } from './bassline-worklet';
import { DRUM_MACHINE_STYLES } from '../domain/constants';
import type { Song } from '../domain/types';

export interface AudioGraph {
  master: GainNode;
  fx: FxChain;
  instruments: Map<string, Instrument>;
  filterKind: 'worklet' | 'biquad';
}

/** Wire master -> effects -> destination and one instrument per bassline/drum track. */
export async function buildAudioGraph(ctx: BaseAudioContext, song: Song): Promise<AudioGraph> {
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const fx = new FxChain(ctx);
  master.connect(fx.input);
  fx.connect(ctx.destination);
  fx.apply(song.effects);

  const { basslineParams, drumParams } = selectedInitialParams(song);
  // Build all worklet filters up front; only use them if EVERY voice got one, so
  // both basses share the same filter type (consistent pitch/tone).
  const workletFilters = await Promise.all(basslineParams.map(() => createWorkletBasslineFilter(ctx)));
  const allWorklet = workletFilters.every((f) => f !== null);
  const filterKind: 'worklet' | 'biquad' = allWorklet ? 'worklet' : 'biquad';

  const instruments = new Map<string, Instrument>();
  for (let i = 0; i < basslineParams.length; i++) {
    const filter = allWorklet ? workletFilters[i]! : undefined; // undefined -> voice builds its own Biquad
    const voice = new BasslineVoice(ctx, basslineParams[i], filter);
    voice.connect(master);
    instruments.set(`bassline-${i}`, voice);
  }
  for (let i = 0; i < drumParams.length; i++) {
    const style = DRUM_MACHINE_STYLES[i] ?? 'analog';
    const drums = new DrumMachine(ctx, drumParams[i], style);
    drums.connect(master);
    instruments.set(`drums-${i}`, drums);
  }

  return { master, fx, instruments, filterKind };
}
