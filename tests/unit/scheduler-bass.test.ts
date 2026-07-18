/** Diagnose: a single note on the SECOND Bassline must trigger bassline-1 exactly once. */
import { describe, it, expect } from 'vitest';
import { createStore } from '../../src/state/store';
import { Scheduler, sixteenthSec } from '../../src/sequencer/scheduler';
import type { TriggerTarget } from '../../src/sequencer/scheduler';
import type { Instrument } from '../../src/audio/instrument';
import type { TriggerEvent } from '../../src/domain/types';

function fakeEngine(log: Array<{ id: string; note?: number }>): TriggerTarget & { time: number } {
  const make = (id: string): Instrument => ({
    trigger: (e: TriggerEvent) => log.push({ id, note: e.note }),
    setParam: () => {},
    connect: () => {},
  });
  const insts: Record<string, Instrument> = {
    'bassline-0': make('bassline-0'),
    'bassline-1': make('bassline-1'),
    'drums-0': make('drums-0'),
    'drums-1': make('drums-1'),
  };
  return {
    time: 0,
    get currentTime() {
      return this.time;
    },
    getInstrument: (id: string) => insts[id],
    async resume() {},
  };
}

describe('second Bassline scheduling', () => {
  it('one note on bassline-1 triggers it once per bar and does not trigger bassline-0', () => {
    const log: Array<{ id: string; note?: number }> = [];
    const engine = fakeEngine(log);
    const store = createStore();
    // enable one step on the SECOND Bassline (track index 1)
    store.dispatch({ type: 'setBasslineStep', track: 1, index: 4, step: { on: true, note: 7 } });

    const scheduler = new Scheduler(store, engine, { setIntervalFn: () => 1, clearIntervalFn: () => {} });
    scheduler.start();
    engine.time = 15 * sixteenthSec(120) - 0.025; // one bar window
    scheduler.tick();

    const b1 = log.filter((e) => e.id === 'bassline-1');
    const b0 = log.filter((e) => e.id === 'bassline-0');
    expect(b0.length).toBe(0);
    expect(b1.length).toBe(1);
    expect(b1[0].note).toBe(7);
  });
});
