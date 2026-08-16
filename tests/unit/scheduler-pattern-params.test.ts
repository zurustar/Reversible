/**
 * 音色設定(Tune など)はパターン単位。再生中のパターンの設定が楽器に適用される
 * ことを検証する(GitHub issue #2)。
 */
import { describe, it, expect } from 'vitest';
import { createStore } from '../../src/state/store';
import { Scheduler, applyPatternParams, sixteenthSec } from '../../src/sequencer/scheduler';
import type { TriggerTarget } from '../../src/sequencer/scheduler';
import type { Instrument } from '../../src/audio/instrument';
import { createEmptyPattern } from '../../src/domain/factories';
import { selectedPattern } from '../../src/state/reducer';

interface ParamSet {
  id: string;
  key: string;
  value: number | string;
  when?: number;
  voiceId?: string;
}

const FX_ID = 'effects';

function fakeEngine(log: ParamSet[]): TriggerTarget & { time: number } {
  const make = (id: string): Instrument => ({
    trigger: () => {},
    setParam: (key, value, when) => log.push({ id, key, value, when }),
    setVoiceParam: (voiceId, key, value, when) => log.push({ id, voiceId, key, value, when }),
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
    applyEffects: (fx, when) => log.push({ id: FX_ID, key: 'delay.on', value: String(fx.delay.on), when }),
    async resume() {},
  };
}

const valueOf = (log: ParamSet[], id: string, key: string, voiceId?: string): unknown =>
  log.filter((e) => e.id === id && e.key === key && e.voiceId === voiceId).pop()?.value;

describe('applyPatternParams', () => {
  it('pushes every bassline / drum-voice param and the effects of the pattern, at the given time', () => {
    const log: ParamSet[] = [];
    const pattern = createEmptyPattern('p');
    pattern.bassline[0].params = { ...pattern.bassline[0].params, tune: 0.75, waveform: 'square' };
    pattern.drums[0].voices.bd.params = { ...pattern.drums[0].voices.bd.params, level: 0.25 };
    pattern.effects = { ...pattern.effects, delay: { ...pattern.effects.delay, on: true } };

    applyPatternParams(fakeEngine(log), pattern, 1.5);

    expect(valueOf(log, 'bassline-0', 'tune')).toBe(0.75);
    expect(valueOf(log, 'bassline-0', 'waveform')).toBe('square');
    expect(valueOf(log, 'drums-0', 'level', 'bd')).toBe(0.25);
    expect(valueOf(log, FX_ID, 'delay.on')).toBe('true');
    expect(log.every((e) => e.when === 1.5)).toBe(true);
  });

  it('skips instruments that are missing', () => {
    expect(() => applyPatternParams({ getInstrument: () => undefined }, createEmptyPattern('p'), 0)).not.toThrow();
  });
});

describe('Scheduler — per-pattern sound settings', () => {
  it('applies the selected pattern\'s Tune, not the first pattern\'s', () => {
    const log: ParamSet[] = [];
    const engine = fakeEngine(log);
    const store = createStore();
    store.dispatch({ type: 'addPattern' }); // adds and selects pattern-2
    store.dispatch({ type: 'setBasslineParam', track: 0, key: 'tune', value: 0.9 });
    expect(selectedPattern(store.getState()).id).toBe('pattern-2');

    const scheduler = new Scheduler(store, engine, { setIntervalFn: () => 1, clearIntervalFn: () => {} });
    scheduler.start();
    scheduler.tick();

    expect(valueOf(log, 'bassline-0', 'tune')).toBe(0.9);
  });

  it('applies the playing pattern\'s effects settings', () => {
    const log: ParamSet[] = [];
    const engine = fakeEngine(log);
    const store = createStore();
    store.dispatch({ type: 'toggleEffect', effect: 'delay' }); // on, for pattern-1
    store.dispatch({ type: 'addPattern' }); // pattern-2: delay stays off

    const scheduler = new Scheduler(store, engine, { setIntervalFn: () => 1, clearIntervalFn: () => {} });
    scheduler.start();
    scheduler.tick();
    expect(valueOf(log, FX_ID, 'delay.on')).toBe('false'); // pattern-2 is selected

    store.dispatch({ type: 'selectPattern', id: 'pattern-1' });
    engine.time = 4 * sixteenthSec(120); // advance so the next tick has steps to schedule
    scheduler.tick();
    expect(valueOf(log, FX_ID, 'delay.on')).toBe('true');
  });

  it('takes tempo and swing from the pattern being played', () => {
    const log: ParamSet[] = [];
    const engine = fakeEngine(log);
    const store = createStore();
    store.dispatch({ type: 'setBpm', bpm: 60 }); // pattern-1: 60 BPM -> 16th = 0.25s
    const scheduler = new Scheduler(store, engine, { setIntervalFn: () => 1, clearIntervalFn: () => {} });
    scheduler.start();
    scheduler.tick();

    // Only steps within the look-ahead window get scheduled: 0.1s / 0.25s -> 1 step.
    const steps = log.filter((e) => e.id === FX_ID).length;
    expect(steps).toBe(1);
    expect(sixteenthSec(selectedPattern(store.getState()).bpm)).toBeCloseTo(0.25);
  });

  it('follows the song chain: each pattern applies its own Tune', () => {
    const log: ParamSet[] = [];
    const engine = fakeEngine(log);
    const store = createStore();
    store.dispatch({ type: 'setBasslineParam', track: 0, key: 'tune', value: 0.1 }); // pattern-1
    store.dispatch({ type: 'addPattern' }); // pattern-2, appended to the chain
    store.dispatch({ type: 'setBasslineParam', track: 0, key: 'tune', value: 0.9 }); // pattern-2
    store.dispatch({ type: 'selectPattern', id: 'pattern-1' });
    store.dispatch({ type: 'setSongMode', on: true });

    const scheduler = new Scheduler(store, engine, { setIntervalFn: () => 1, clearIntervalFn: () => {} });
    scheduler.start();
    scheduler.tick();
    expect(valueOf(log, 'bassline-0', 'tune')).toBe(0.1); // bar 1 = pattern-1

    engine.time = 16 * sixteenthSec(120);
    scheduler.tick();
    expect(valueOf(log, 'bassline-0', 'tune')).toBe(0.9); // bar 2 = pattern-2
  });
});
