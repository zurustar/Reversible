/**
 * WAV 書き出し(オフラインレンダリング)がパターン単位の音色設定(Tune など)を
 * 反映することの回帰テスト。GitHub issue #1 / #2。
 * 実際に node-web-audio-api で合成し、自己相関でピッチを測って検証する。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import { createEmptySong, createEmptyPattern } from '../../src/domain/factories';
import { noteToFreq } from '../../src/audio/param-maps';
import { renderSongToBuffer } from '../../src/audio/offline-render';
import type { AppState } from '../../src/state/actions';
import type { Pattern, Song } from '../../src/domain/types';

const SR = 44100;
const NOTE = 12; // C3

beforeAll(() => {
  // offline-render.ts looks the constructor up on `window`.
  (globalThis as unknown as { window: unknown }).window = { OfflineAudioContext };
});

/** A pattern with a single bassline-A note on step 0 and the given Tune. */
function tunedPattern(id: string, tune: number): Pattern {
  const p = createEmptyPattern(id);
  const track = p.bassline[0];
  track.steps[0] = { on: true, note: NOTE, accent: false, slide: false };
  track.params = { ...track.params, tune, cutoff: 0.8, resonance: 0.1, envMod: 0, decay: 0.9, volume: 1 };
  return p;
}

function songWith(patterns: Pattern[]): Song {
  return { ...createEmptySong('t'), patterns, patternOrder: patterns.map((p) => p.id) };
}

function stateFor(song: Song, selectedPatternId: string, songMode = false): AppState {
  return { song, playing: false, currentStep: 0, selectedPatternId, songMode, songPos: 0 };
}

/** Fundamental frequency of `data` via autocorrelation (searched over 40..800 Hz). */
function pitchHz(data: Float32Array, fromSec: number, lenSec = 0.08): number {
  const start = Math.floor(fromSec * SR);
  const n = Math.floor(lenSec * SR);
  const minLag = Math.floor(SR / 800);
  const maxLag = Math.floor(SR / 40);
  let bestLag = minLag;
  let best = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += data[start + i] * data[start + i + lag];
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  return SR / bestLag;
}

describe('renderSongToBuffer — per-pattern sound settings', () => {
  it('uses the Tune of the pattern being rendered, not of the first pattern', async () => {
    // pattern-1 is untuned; pattern-2 (the one selected/rendered) is +1 octave.
    const song = songWith([tunedPattern('pattern-1', 0.5), tunedPattern('pattern-2', 1)]);
    const buf = await renderSongToBuffer(stateFor(song, 'pattern-2'), { sampleRate: SR, tailSec: 0.2 });
    const hz = pitchHz(buf.getChannelData(0) as unknown as Float32Array, 0.07);
    expect(hz).toBeCloseTo(noteToFreq(NOTE, 1200), -1);
  });

  it('switches Tune per pattern across a song chain', async () => {
    const song = songWith([tunedPattern('pattern-1', 0.5), tunedPattern('pattern-2', 1)]);
    const state = stateFor(song, 'pattern-1', true); // song mode: pattern-1 then pattern-2
    const buf = await renderSongToBuffer(state, { sampleRate: SR, tailSec: 0.2 });
    const data = buf.getChannelData(0) as unknown as Float32Array;
    const barSec = (60 / song.bpm / 4) * 16;
    expect(pitchHz(data, 0.07)).toBeCloseTo(noteToFreq(NOTE, 0), -1);
    expect(pitchHz(data, 0.07 + barSec)).toBeCloseTo(noteToFreq(NOTE, 1200), -1);
  });
});
