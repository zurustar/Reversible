/** Helpers to derive initial instrument params from a song. */
import type { BasslineParams, DrumVoiceParams, Song } from '../domain/types';
import type { DrumVoiceId } from '../domain/constants';

export function selectedInitialParams(song: Song): {
  basslineParams: BasslineParams[];
  drumParams: Record<DrumVoiceId, DrumVoiceParams>[];
} {
  const pattern = song.patterns[0];
  const drumParams = pattern.drums.map((machine) => {
    const params = {} as Record<DrumVoiceId, DrumVoiceParams>;
    for (const [id, voice] of Object.entries(machine.voices)) params[id as DrumVoiceId] = { ...voice.params };
    return params;
  });
  const basslineParams = pattern.bassline.map((t) => ({ ...t.params }));
  return { basslineParams, drumParams };
}
