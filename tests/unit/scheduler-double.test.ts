/** Diagnostic: notes on steps 0 and 2 must each fire once per bar (no double-hit). */
import { describe, it, expect } from 'vitest';
import { createStore } from '../../src/state/store';
import { Scheduler, sixteenthSec } from '../../src/sequencer/scheduler';
import type { TriggerTarget } from '../../src/sequencer/scheduler';
import type { Instrument } from '../../src/audio/instrument';

function fakeEngine(log: Array<{ id: string; when: number }>): TriggerTarget & { time: number } {
  const make = (id: string): Instrument => ({
    trigger: (_e, when) => log.push({ id, when }),
    setParam: () => {},
    connect: () => {},
  });
  const bass0 = make('bassline-0');
  return {
    time: 0,
    get currentTime() {
      return this.time;
    },
    getInstrument(id: string) {
      return id === 'bassline-0' ? bass0 : make(id);
    },
    async resume() {},
  };
}

describe('bassline double-hit repro', () => {
  it('fires each on-step once per bar when driven by realistic 25ms ticks', () => {
    const log: Array<{ id: string; when: number }> = [];
    const engine = fakeEngine(log);
    const store = createStore();
    // notes on step 0 and step 2 (1st and 3rd) of bassline 0
    store.dispatch({ type: 'setBasslineStep', track: 0, index: 0, step: { on: true, note: 12 } });
    store.dispatch({ type: 'setBasslineStep', track: 0, index: 2, step: { on: true, note: 12 } });

    const scheduler = new Scheduler(store, engine, { setIntervalFn: () => 1, clearIntervalFn: () => {} });
    scheduler.start();

    const barSec = 16 * sixteenthSec(120); // 2.0s
    for (let t = 0; t <= barSec + 0.2; t += 0.025) {
      engine.time = t;
      scheduler.tick();
    }

    const bassHits = log.filter((e) => e.id === 'bassline-0');
    // within one bar we expect exactly 2 hits (step 0 and step 2)
    const inBar = bassHits.filter((h) => h.when < barSec - 1e-9);
    const times = inBar.map((h) => +h.when.toFixed(4));
    // no two hits at the same time, and exactly 2 of them
    expect(new Set(times).size).toBe(times.length); // no duplicate 'when'
    expect(inBar.length).toBe(2);
  });
});
