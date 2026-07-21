/** Render a whole song to audio offline (faster than real time) and encode it
 * as a WAV Blob for download. Uses the same node graph as live playback
 * (buildAudioGraph) and the same per-step triggering (triggerStep), so the file
 * matches what you hear. */
import type { AppState } from '../state/actions';
import { buildAudioGraph } from './graph';
import { sixteenthSec, swingOffset, triggerStep } from '../sequencer/scheduler';
import { patternById } from '../state/reducer';
import { STEP_COUNT } from '../domain/constants';

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_TAIL_SEC = 2; // let decay / delay tails ring out past the last step
const PREROLL_SEC = 0.05; // a hair of lead-in so no envelope starts exactly at t=0

export interface RenderOptions {
  sampleRate?: number;
  tailSec?: number;
}

/** Patterns to play, in order: the song chain in song mode, else the selected pattern. */
export function playbackSequence(state: AppState): string[] {
  if (state.songMode && state.song.patternOrder.length > 0) return state.song.patternOrder;
  return [state.selectedPatternId];
}

/** Render the song to a mono AudioBuffer via an OfflineAudioContext. */
export async function renderSongToBuffer(state: AppState, opts: RenderOptions = {}): Promise<AudioBuffer> {
  const sampleRate = opts.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const tailSec = opts.tailSec ?? DEFAULT_TAIL_SEC;
  const { bpm, swing } = state.song;
  const seq = playbackSequence(state);

  // Lay out every step's absolute time first so we can size the offline context.
  const events: Array<{ patternId: string; index: number; when: number }> = [];
  let t = PREROLL_SEC;
  for (const patternId of seq) {
    for (let index = 0; index < STEP_COUNT; index++) {
      events.push({ patternId, index, when: t });
      t += sixteenthSec(bpm) + swingOffset(index, bpm, swing);
    }
  }
  const frames = Math.max(1, Math.ceil((t + tailSec) * sampleRate));

  const OfflineCtor =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new OfflineCtor(1, frames, sampleRate);

  const graph = await buildAudioGraph(ctx, state.song);
  const stepDur = sixteenthSec(bpm);
  for (const ev of events) {
    const pattern = patternById(state, ev.patternId);
    triggerStep((id) => graph.instruments.get(id), pattern, ev.index, ev.when, stepDur);
  }
  return ctx.startRendering();
}

/** Encode a mono AudioBuffer as a 16-bit PCM WAV Blob. */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const n = data.length;
  const ab = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(ab);
  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) dv.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  dv.setUint32(4, 36 + n * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  dv.setUint32(16, 16, true); // PCM chunk size
  dv.setUint16(20, 1, true); // format = PCM
  dv.setUint16(22, 1, true); // channels = mono
  dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * 2, true); // byte rate
  dv.setUint16(32, 2, true); // block align
  dv.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  dv.setUint32(40, n * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}

/** Render the current song and return a downloadable WAV Blob. */
export async function renderSongToWav(state: AppState, opts?: RenderOptions): Promise<Blob> {
  const buffer = await renderSongToBuffer(state, opts);
  return audioBufferToWavBlob(buffer);
}
