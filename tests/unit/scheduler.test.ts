/** PR-02 / P-06: per bar, a voice fires exactly as many times as it has 'on' steps. */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createStore } from '../../src/state/store';
import { Scheduler, sixteenthSec } from '../../src/sequencer/scheduler';
import type { TriggerTarget } from '../../src/sequencer/scheduler';
import type { Instrument } from '../../src/audio/instrument';
import { STEP_COUNT } from '../../src/domain/constants';

function makeFakeEngine(counts: Record<string, number>): TriggerTarget & { time: number } {
  const drums: Instrument = {
    trigger: (e) => {
      const id = e.voiceId ?? 'unknown';
      counts[id] = (counts[id] ?? 0) + 1;
    },
    setParam: () => {},
    connect: () => {},
  };
  const bass: Instrument = {
    trigger: () => {
      counts.bassline = (counts.bassline ?? 0) + 1;
    },
    setParam: () => {},
    connect: () => {},
  };
  return {
    time: 0,
    get currentTime() {
      return this.time;
    },
    getInstrument(id: string) {
      return id.startsWith('drums') ? drums : bass;
    },
    async resume() {},
  };
}

describe('Scheduler counting (P-06 / PR-02)', () => {
  it('fires bd exactly once per on-step within one bar', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: STEP_COUNT, maxLength: STEP_COUNT }), (pattern) => {
        const counts: Record<string, number> = {};
        const engine = makeFakeEngine(counts);
        const store = createStore();
        // program bd row
        pattern.forEach((on, i) => {
          if (on) store.dispatch({ type: 'toggleDrumStep', machine: 0, voiceId: 'bd', index: i });
        });
        const scheduler = new Scheduler(store, engine, {
          setIntervalFn: () => 1,
          clearIntervalFn: () => {},
        });
        scheduler.start(); // nextNoteTime = 0, stepIndex = 0 (bpm 120 -> 0.125s/step)
        // one tick with a window covering exactly steps 0..15
        engine.time = 15 * sixteenthSec(120) - 0.025; // = 1.85 ; +0.1 window = 1.95
        scheduler.tick();
        const expected = pattern.filter(Boolean).length;
        expect(counts.bd ?? 0).toBe(expected);
      }),
    );
  });
});
