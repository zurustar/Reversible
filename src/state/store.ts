/** Central reactive store (U1 Core, C-02). Single source of truth, observer pattern. */
import { createEmptySong } from '../domain/factories';
import type { Action, AppState } from './actions';
import { reduce } from './reducer';

export type Listener = (state: Readonly<AppState>) => void;

export interface Store {
  getState(): Readonly<AppState>;
  dispatch(action: Action): void;
  subscribe(listener: Listener): () => void;
}

export function createStore(initial?: AppState): Store {
  let state: AppState =
    initial ??
    (() => {
      const song = createEmptySong();
      return { song, playing: false, currentStep: 0, selectedPatternId: song.patterns[0].id, songMode: false, songPos: 0 };
    })();

  const listeners = new Set<Listener>();

  return {
    getState() {
      return state;
    },
    dispatch(action: Action) {
      const next = reduce(state, action);
      if (next === state) return;
      state = next;
      for (const l of listeners) l(state);
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
  };
}
