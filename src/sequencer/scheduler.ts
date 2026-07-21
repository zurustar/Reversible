/** Look-ahead scheduler (U1, C-03). Audio-clock synced; UI-timer independent (NFR-1). */
import { STEP_COUNT, DRUM_VOICE_IDS } from '../domain/constants';
import type { Store } from '../state/store';
import type { AppState } from '../state/actions';
import type { Pattern } from '../domain/types';
import { patternById } from '../state/reducer';
import type { Instrument } from '../audio/instrument';

/** Schedule one 16th-note step of a pattern (bassline + drum triggers) at absolute time `when`.
 * Shared by the live Scheduler and the offline WAV renderer. */
export function triggerStep(
  getInstrument: (id: string) => Instrument | undefined,
  pattern: Pattern,
  index: number,
  when: number,
  stepDur = 0,
): void {
  for (let t = 0; t < pattern.bassline.length; t++) {
    const step = pattern.bassline[t].steps[index];
    if (step && step.on) {
      getInstrument(`bassline-${t}`)?.trigger({ note: step.note, accent: step.accent, slide: step.slide }, when, stepDur);
    }
  }
  for (let m = 0; m < pattern.drums.length; m++) {
    const drums = getInstrument(`drums-${m}`);
    if (!drums) continue;
    const machine = pattern.drums[m];
    for (const voiceId of DRUM_VOICE_IDS) {
      const ds = machine.voices[voiceId]?.steps[index];
      if (ds && ds.on) drums.trigger({ voiceId, accent: ds.accent ?? false }, when);
    }
  }
}

export const LOOKAHEAD_MS = 25;
export const SCHEDULE_AHEAD_SEC = 0.1;
const SWING_MAX_RATIO = 0.5;

/** Minimal audio interface the scheduler needs (keeps U1 decoupled from AudioEngine). */
export interface TriggerTarget {
  readonly currentTime: number;
  getInstrument(id: string): Instrument | undefined;
  resume(): Promise<void>;
}

export interface SchedulerDeps {
  setIntervalFn?: (cb: () => void, ms: number) => number;
  clearIntervalFn?: (handle: number) => void;
}

/** Pure: length of a 16th note in seconds. */
export function sixteenthSec(bpm: number): number {
  return 60 / bpm / 4;
}

/** Pure: extra delay applied to odd steps for swing. */
export function swingOffset(index: number, bpm: number, swing: number): number {
  return index % 2 === 1 ? sixteenthSec(bpm) * swing * SWING_MAX_RATIO : 0;
}

export class Scheduler {
  private store: Store;
  private engine: TriggerTarget;
  private setIntervalFn: (cb: () => void, ms: number) => number;
  private clearIntervalFn: (handle: number) => void;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private stepIndex = 0;
  private songPos = 0;
  private displayQueue: Array<{ index: number; time: number }> = [];

  constructor(store: Store, engine: TriggerTarget, deps: SchedulerDeps = {}) {
    this.store = store;
    this.engine = engine;
    this.setIntervalFn = deps.setIntervalFn ?? ((cb, ms) => setInterval(cb, ms) as unknown as number);
    this.clearIntervalFn = deps.clearIntervalFn ?? ((h) => clearInterval(h));
  }

  start(): void {
    if (this.timer !== null) return;
    this.nextNoteTime = this.engine.currentTime;
    this.stepIndex = 0;
    this.songPos = 0;
    this.store.dispatch({ type: 'setSongPos', pos: 0 });
    this.timer = this.setIntervalFn(() => this.tick(), LOOKAHEAD_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      this.clearIntervalFn(this.timer);
      this.timer = null;
    }
    this.displayQueue = [];
    this.store.dispatch({ type: 'setCurrentStep', index: 0 });
  }

  /** One scheduler tick: schedule everything within the look-ahead window. */
  tick(): void {
    const state = this.store.getState();
    const bpm = state.song.bpm;
    const swing = state.song.swing;
    while (this.nextNoteTime < this.engine.currentTime + SCHEDULE_AHEAD_SEC) {
      this.scheduleStep(this.stepIndex, this.nextNoteTime, state);
      this.displayQueue.push({ index: this.stepIndex, time: this.nextNoteTime });
      this.nextNoteTime += sixteenthSec(bpm) + swingOffset(this.stepIndex, bpm, swing);
      this.stepIndex = (this.stepIndex + 1) % STEP_COUNT;
      // End of a bar: in song mode, advance to the next pattern in the chain.
      if (this.stepIndex === 0 && state.songMode) {
        const len = Math.max(1, state.song.patternOrder.length);
        this.songPos = (this.songPos + 1) % len;
        this.store.dispatch({ type: 'setSongPos', pos: this.songPos });
      }
    }
  }

  /** The pattern id currently being played (song chain position, or the edited pattern). */
  private playingPatternId(state: AppState): string {
    if (state.songMode) return state.song.patternOrder[this.songPos] ?? state.selectedPatternId;
    return state.selectedPatternId;
  }

  private scheduleStep(index: number, when: number, state: AppState): void {
    const pattern = patternById(state, this.playingPatternId(state));
    triggerStep((id) => this.engine.getInstrument(id), pattern, index, when, sixteenthSec(state.song.bpm));
  }

  /** Called by a rAF loop: advance the displayed current step to match the audio clock. */
  updateDisplay(): void {
    const now = this.engine.currentTime;
    let latest: number | null = null;
    while (this.displayQueue.length && this.displayQueue[0].time <= now) {
      latest = this.displayQueue.shift()!.index;
    }
    if (latest !== null) {
      this.store.dispatch({ type: 'setCurrentStep', index: latest });
    }
  }
}
