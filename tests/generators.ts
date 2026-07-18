/** Domain-aware fast-check generators (PBT-07). */
import fc from 'fast-check';
import { STEP_COUNT, NOTE_MIN, NOTE_MAX, BPM_MIN, BPM_MAX, DRUM_VOICE_IDS, type DrumVoiceId } from '../src/domain/constants';
import type { Action } from '../src/state/actions';
import type { Song } from '../src/domain/types';
import { SCHEMA_VERSION } from '../src/domain/constants';

const norm = fc.double({ min: 0, max: 1, noNaN: true });

const basslineStep = fc.record({
  on: fc.boolean(),
  note: fc.integer({ min: NOTE_MIN, max: NOTE_MAX }),
  accent: fc.boolean(),
  slide: fc.boolean(),
});

const basslineParams = fc.record({
  waveform: fc.constantFrom('saw', 'square') as fc.Arbitrary<'saw' | 'square'>,
  tune: norm,
  cutoff: norm,
  resonance: norm,
  envMod: norm,
  decay: norm,
  accent: norm,
  volume: norm,
});

function fixedArray<T>(arb: fc.Arbitrary<T>): fc.Arbitrary<T[]> {
  return fc.array(arb, { minLength: STEP_COUNT, maxLength: STEP_COUNT });
}

export const arbitrarySong: fc.Arbitrary<Song> = fc
  .record({
    name: fc.string({ maxLength: 40 }),
    bpm: fc.double({ min: BPM_MIN, max: BPM_MAX, noNaN: true }),
    swing: norm,
    basslinea: fc.record({ steps: fixedArray(basslineStep), params: basslineParams }),
    basslineb: fc.record({ steps: fixedArray(basslineStep), params: basslineParams }),
    effects: fc.record({
      distortion: fc.record({ on: fc.boolean(), amount: norm }),
      delay: fc.record({ on: fc.boolean(), time: norm, feedback: norm, mix: norm }),
      pcf: fc.record({ on: fc.boolean(), rate: norm, depth: norm, cutoff: norm, resonance: norm }),
      compressor: fc.record({ on: fc.boolean(), amount: norm }),
    }),
  })
  .map((r) => {
    const makeMachine = (): Song['patterns'][number]['drums'][number] => {
      const voices = {} as Song['patterns'][number]['drums'][number]['voices'];
      for (const id of DRUM_VOICE_IDS) {
        voices[id] = {
          steps: Array.from({ length: STEP_COUNT }, () => ({ on: false, accent: false })),
          params: { level: 0.8, tone: 0.5, decay: 0.5, tune: 0.5 },
        };
      }
      return { voices };
    };
    return {
      schemaVersion: SCHEMA_VERSION,
      name: r.name,
      bpm: r.bpm,
      swing: r.swing,
      patterns: [
        {
          id: 'pattern-1',
          length: STEP_COUNT,
          bassline: [r.basslinea, r.basslineb],
          drums: [makeMachine(), makeMachine()],
        },
      ],
      patternOrder: ['pattern-1'],
      effects: r.effects,
    } satisfies Song;
  });

const voiceId = fc.constantFrom(...DRUM_VOICE_IDS) as fc.Arbitrary<DrumVoiceId>;
const stepIndex = fc.integer({ min: 0, max: STEP_COUNT - 1 });

/** Actions with realistic-but-adversarial params (some out of range to test clamping). */
export const arbitraryAction: fc.Arbitrary<Action> = fc.oneof(
  fc.record({ type: fc.constant('toggleDrumStep' as const), machine: fc.integer({ min: 0, max: 1 }), voiceId, index: stepIndex }),
  fc.record({ type: fc.constant('setBasslineStep' as const), track: fc.integer({ min: 0, max: 1 }), index: stepIndex, step: fc.record({ note: fc.integer({ min: -50, max: 100 }) }) }),
  fc.record({ type: fc.constant('setBpm' as const), bpm: fc.double({ min: -1000, max: 5000, noNaN: false }) }),
  fc.record({ type: fc.constant('setSwing' as const), swing: fc.double({ min: -5, max: 5, noNaN: false }) }),
  fc.record({ type: fc.constant('setBasslineParam' as const), track: fc.integer({ min: 0, max: 1 }), key: fc.constantFrom('cutoff', 'resonance', 'decay', 'volume') as fc.Arbitrary<'cutoff'>, value: fc.double({ min: -5, max: 5, noNaN: false }) }),
  fc.record({ type: fc.constant('setDrumParam' as const), machine: fc.integer({ min: 0, max: 1 }), voiceId, key: fc.constant('level' as const), value: fc.double({ min: -5, max: 5, noNaN: false }) }),
);
