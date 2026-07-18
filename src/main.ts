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

  // Audio engine (created from current song's initial params).
  const engine = new AudioEngine();
  const audioOk = await engine.init(store.getState().song);
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
  const sampleRate = engine.context?.sampleRate ?? 0;
  mountApp(root, ctx, { buildTime, filterKind: engine.filterKind, sampleRate });

  // Keep the audio effects chain in sync with the song's effects settings.
  let lastEffects = store.getState().song.effects;
  store.subscribe((state) => {
    if (state.song.effects !== lastEffects) {
      lastEffects = state.song.effects;
      engine.applyEffects(state.song.effects);
    }
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
