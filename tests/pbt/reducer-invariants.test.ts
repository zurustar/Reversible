/** PBT-03: store invariants hold after ANY sequence of actions (P-01..P-07). */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createEmptySong } from '../../src/domain/factories';
import { reduce } from '../../src/state/reducer';
import type { AppState } from '../../src/state/actions';
import { STEP_COUNT, NOTE_MIN, NOTE_MAX, BPM_MIN, BPM_MAX, DRUM_VOICE_IDS } from '../../src/domain/constants';
import { arbitraryAction } from '../generators';

function initialState(): AppState {
  const song = createEmptySong();
  return { song, playing: false, currentStep: 0, selectedPatternId: song.patterns[0].id, songMode: false, songPos: 0 };
}

function applyAll(actions: import('../../src/state/actions').Action[]): AppState {
  return actions.reduce((s, a) => reduce(s, a), initialState());
}

describe('reducer invariants (PBT-03)', () => {
  it('P-01: all tracks always have exactly STEP_COUNT steps', () => {
    fc.assert(
      fc.property(fc.array(arbitraryAction, { maxLength: 40 }), (actions) => {
        const s = applyAll(actions);
        const p = s.song.patterns[0];
        for (const track of p.bassline) expect(track.steps.length).toBe(STEP_COUNT);
        for (const machine of p.drums)
          for (const id of DRUM_VOICE_IDS) expect(machine.voices[id].steps.length).toBe(STEP_COUNT);
      }),
    );
  });

  it('P-02/P-03/P-04: bpm, params, notes stay in range', () => {
    fc.assert(
      fc.property(fc.array(arbitraryAction, { maxLength: 40 }), (actions) => {
        const s = applyAll(actions);
        expect(s.song.bpm).toBeGreaterThanOrEqual(BPM_MIN);
        expect(s.song.bpm).toBeLessThanOrEqual(BPM_MAX);
        expect(s.song.swing).toBeGreaterThanOrEqual(0);
        expect(s.song.swing).toBeLessThanOrEqual(1);
        const p = s.song.patterns[0];
        for (const track of p.bassline) {
          for (const st of track.steps) {
            expect(Number.isInteger(st.note)).toBe(true);
            expect(st.note).toBeGreaterThanOrEqual(NOTE_MIN);
            expect(st.note).toBeLessThanOrEqual(NOTE_MAX);
          }
          for (const key of ['cutoff', 'resonance', 'decay', 'volume'] as const) {
            expect(track.params[key]).toBeGreaterThanOrEqual(0);
            expect(track.params[key]).toBeLessThanOrEqual(1);
          }
        }
        for (const machine of p.drums)
          for (const id of DRUM_VOICE_IDS) {
            expect(machine.voices[id].params.level).toBeGreaterThanOrEqual(0);
            expect(machine.voices[id].params.level).toBeLessThanOrEqual(1);
          }
      }),
    );
  });

  it('P-05: toggling a drum step twice restores original', () => {
    fc.assert(
      fc.property(fc.constantFrom(...DRUM_VOICE_IDS), fc.integer({ min: 0, max: STEP_COUNT - 1 }), (voiceId, index) => {
        const s0 = initialState();
        const before = s0.song.patterns[0].drums[0].voices[voiceId].steps[index].on;
        const s1 = reduce(s0, { type: 'toggleDrumStep', machine: 0, voiceId, index });
        const s2 = reduce(s1, { type: 'toggleDrumStep', machine: 0, voiceId, index });
        expect(s2.song.patterns[0].drums[0].voices[voiceId].steps[index].on).toBe(before);
      }),
    );
  });

  it('P-07: drum voice key set is always exactly DRUM_VOICE_IDS', () => {
    fc.assert(
      fc.property(fc.array(arbitraryAction, { maxLength: 40 }), (actions) => {
        const s = applyAll(actions);
        for (const machine of s.song.patterns[0].drums) {
          const keys = Object.keys(machine.voices).sort();
          expect(keys).toEqual([...DRUM_VOICE_IDS].sort());
        }
      }),
    );
  });
});
