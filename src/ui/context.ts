/** Shared UI context: store + services. */
import type { Store } from '../state/store';
import type { TransportService } from '../services/transport';
import type { SoundDesignService } from '../services/sound-design';
import type { PatternEditService } from '../services/pattern-edit';
import type { ProjectService } from '../services/project';
import type { AppState } from '../state/actions';

export interface UiContext {
  store: Store;
  transport: TransportService;
  sound: SoundDesignService;
  edit: PatternEditService;
  project: ProjectService;
}

export interface ViewHandle {
  el: HTMLElement;
  update(state: Readonly<AppState>): void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Semitone index (0 = C2) -> label like "C2". */
export function noteLabel(index: number): string {
  const midi = 36 + index;
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/** Pitch class 0..11 -> name (C, C#, ... B). */
export function pitchClassName(pc: number): string {
  return NOTE_NAMES[((pc % 12) + 12) % 12];
}
