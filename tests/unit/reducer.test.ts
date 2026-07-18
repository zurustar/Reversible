/** Reducer behavior (TR/BR rules). */
import { describe, it, expect } from 'vitest';
import { createEmptySong } from '../../src/domain/factories';
import { reduce } from '../../src/state/reducer';
import type { AppState } from '../../src/state/actions';
import { BPM_MAX, BPM_MIN, NOTE_MAX } from '../../src/domain/constants';

function init(): AppState {
  const song = createEmptySong();
  return { song, playing: false, currentStep: 0, selectedPatternId: song.patterns[0].id, songMode: false, songPos: 0 };
}

describe('reducer', () => {
  it('clamps bpm above max (BR-01)', () => {
    const s = reduce(init(), { type: 'setBpm', bpm: 5000 });
    expect(s.song.bpm).toBe(BPM_MAX);
  });

  it('clamps bpm below min and handles NaN (BR-01)', () => {
    expect(reduce(init(), { type: 'setBpm', bpm: -10 }).song.bpm).toBe(BPM_MIN);
    expect(reduce(init(), { type: 'setBpm', bpm: NaN }).song.bpm).toBe(BPM_MIN);
  });

  it('clamps Bassline note into range (BR-04)', () => {
    const s = reduce(init(), { type: 'setBasslineStep', track: 0, index: 0, step: { note: 999 } });
    expect(s.song.patterns[0].bassline[0].steps[0].note).toBe(NOTE_MAX);
  });

  it('ignores out-of-range step index (BR-10, no throw)', () => {
    const before = init();
    const after = reduce(before, { type: 'toggleDrumStep', machine: 0, voiceId: 'bd', index: 99 });
    expect(after).toBe(before);
  });

  it('loadSong resets playing and currentStep (TR-04)', () => {
    let s = init();
    s = reduce(s, { type: 'transport', playing: true });
    s = reduce(s, { type: 'setCurrentStep', index: 5 });
    s = reduce(s, { type: 'loadSong', song: createEmptySong('Loaded') });
    expect(s.playing).toBe(false);
    expect(s.currentStep).toBe(0);
    expect(s.song.name).toBe('Loaded');
  });

  it('toggles an effect on/off', () => {
    let s = init();
    expect(s.song.effects.delay.on).toBe(false);
    s = reduce(s, { type: 'toggleEffect', effect: 'delay' });
    expect(s.song.effects.delay.on).toBe(true);
    s = reduce(s, { type: 'toggleEffect', effect: 'delay' });
    expect(s.song.effects.delay.on).toBe(false);
  });

  it('cycles a drum step off -> on -> accent -> off', () => {
    let s = init();
    const at = () => s.song.patterns[0].drums[0].voices.bd.steps[0];
    expect(at()).toMatchObject({ on: false });
    s = reduce(s, { type: 'cycleDrumStep', machine: 0, voiceId: 'bd', index: 0 });
    expect(at()).toMatchObject({ on: true, accent: false });
    s = reduce(s, { type: 'cycleDrumStep', machine: 0, voiceId: 'bd', index: 0 });
    expect(at()).toMatchObject({ on: true, accent: true });
    s = reduce(s, { type: 'cycleDrumStep', machine: 0, voiceId: 'bd', index: 0 });
    expect(at()).toMatchObject({ on: false, accent: false });
  });

  it('clamps effect params to [0,1]', () => {
    let s = reduce(init(), { type: 'setEffectParam', effect: 'delay', key: 'feedback', value: 9 });
    expect(s.song.effects.delay.feedback).toBe(1);
    s = reduce(s, { type: 'setEffectParam', effect: 'delay', key: 'feedback', value: -9 });
    expect(s.song.effects.delay.feedback).toBe(0);
  });

  it('ignores unknown effect param key (no throw)', () => {
    const before = init();
    const after = reduce(before, { type: 'setEffectParam', effect: 'delay', key: 'nope', value: 0.5 });
    expect(after).toBe(before);
  });

  it('adds, duplicates and deletes patterns (keeps at least one)', () => {
    let s = init();
    expect(s.song.patterns.length).toBe(1);
    s = reduce(s, { type: 'addPattern' });
    expect(s.song.patterns.length).toBe(2);
    expect(s.selectedPatternId).toBe(s.song.patterns[1].id);
    s = reduce(s, { type: 'duplicatePattern' });
    expect(s.song.patterns.length).toBe(3);
    // delete down to one; further deletes are no-ops
    s = reduce(s, { type: 'deletePattern', id: s.song.patterns[2].id });
    s = reduce(s, { type: 'deletePattern', id: s.song.patterns[1].id });
    const one = reduce(s, { type: 'deletePattern', id: s.song.patterns[0].id });
    expect(one.song.patterns.length).toBe(1);
  });

  it('appends to and removes from the chain (keeps at least one)', () => {
    let s = reduce(init(), { type: 'addPattern' }); // now 2 patterns, order length 2
    const firstId = s.song.patterns[0].id;
    s = reduce(s, { type: 'appendToChain', id: firstId });
    expect(s.song.patternOrder.length).toBe(3);
    s = reduce(s, { type: 'removeChainAt', index: 0 });
    expect(s.song.patternOrder.length).toBe(2);
  });

  it('setSongPos wraps within the chain length', () => {
    const s = reduce(init(), { type: 'setSongPos', pos: 5 });
    expect(s.songPos).toBe(0); // single-pattern chain -> always 0
  });

  it('does not mutate the previous state (TR-05)', () => {
    const before = init();
    const snapshot = JSON.stringify(before.song);
    reduce(before, { type: 'toggleDrumStep', machine: 0, voiceId: 'bd', index: 0 });
    expect(JSON.stringify(before.song)).toBe(snapshot);
  });
});
