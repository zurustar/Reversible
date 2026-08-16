/** Helpers to derive instrument params from a song's patterns. */
import type { BasslineParams, DrumVoiceParams, Pattern, Song } from '../domain/types';
import type { DrumVoiceId } from '../domain/constants';

export interface InstrumentParams {
  basslineParams: BasslineParams[];
  drumParams: Record<DrumVoiceId, DrumVoiceParams>[];
}

/** Sound settings (Tune, Cutoff, Level, …) stored in one pattern. Copied, so the
 * instruments never mutate store state. */
export function patternInstrumentParams(pattern: Pattern): InstrumentParams {
  const drumParams = pattern.drums.map((machine) => {
    const params = {} as Record<DrumVoiceId, DrumVoiceParams>;
    for (const [id, voice] of Object.entries(machine.voices)) params[id as DrumVoiceId] = { ...voice.params };
    return params;
  });
  const basslineParams = pattern.bassline.map((t) => ({ ...t.params }));
  return { basslineParams, drumParams };
}

/** The pattern to build the graph from: the one that plays first (playback then keeps
 * the settings in sync per pattern — see `applyPatternParams`). */
export function initialPattern(song: Song, patternId?: string): Pattern {
  return song.patterns.find((p) => p.id === patternId) ?? song.patterns[0];
}
