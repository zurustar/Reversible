/** Bootstrap (S-05, U3). Wires engine, store, scheduler, services, UI. */
import './ui/style.css';
import { createStore } from './state/store';
import { AudioEngine } from './audio/engine';
import { Scheduler } from './sequencer/scheduler';
import { TransportService } from './services/transport';
import { SoundDesignService } from './services/sound-design';
import { PatternEditService } from './services/pattern-edit';
import { ProjectService } from './services/project';
import { mountApp } from './ui/app';
import { selectedPattern } from './state/reducer';
import type { UiContext } from './ui/context';

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;

  // Guard against running twice (e.g. dev-server hot reload), which would create
  // a second AudioContext + oscillators layered on the first — audible as a
  // slightly detuned, out-of-tune doubling. Re-running would also duplicate the UI.
  const w = window as unknown as { __reversibleStarted?: boolean };
  if (w.__reversibleStarted) return;
  w.__reversibleStarted = true;

  const store = createStore();
  const project = new ProjectService(store);

  // Restore previous session if present.
  project.restoreFromBrowser();

  // Audio engine (created from the selected pattern's sound params; playback keeps
  // them in sync with whichever pattern is playing).
  const engine = new AudioEngine();
  const audioOk = await engine.init(store.getState().song, store.getState().selectedPatternId);
  if (!audioOk) {
    root.textContent = 'このブラウザでは Web Audio を初期化できませんでした。';
    return;
  }

  const scheduler = new Scheduler(store, engine);
  const transport = new TransportService(store, engine, scheduler);
  const sound = new SoundDesignService(store, engine);
  const edit = new PatternEditService(store);

  const ctx: UiContext = { store, transport, sound, edit, project };
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev';
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  const sampleRate = engine.context?.sampleRate ?? 0;
  mountApp(root, ctx, { version, buildTime, filterKind: engine.filterKind, sampleRate });

  // Effects are a per-pattern setting: reflect the SELECTED pattern's chain so edits
  // are audible immediately (also covers loading a song / switching pattern). While a
  // different pattern is sounding, the Scheduler is the authority — see
  // SoundDesignService for the same rule applied to the instrument params.
  store.subscribe((state) => {
    const pattern = selectedPattern(state);
    if (state.playing && state.songMode && (state.song.patternOrder[state.songPos] ?? pattern.id) !== pattern.id) return;
    engine.applyEffects(pattern.effects);
  });

  // Auto-save when the song changes (ignore transient playhead updates).
  let lastSong = store.getState().song;
  let saveQueued = false;
  store.subscribe((state) => {
    if (state.song === lastSong) return;
    lastSong = state.song;
    if (saveQueued) return;
    saveQueued = true;
    queueMicrotask(() => {
      saveQueued = false;
      project.saveToBrowser();
    });
  });

  // Display sync loop (rAF): keep the playhead visually aligned with the audio clock.
  const frame = (): void => {
    scheduler.updateDisplay();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void main();
