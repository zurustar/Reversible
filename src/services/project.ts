/** ProjectService (S-04, U3). Lifecycle + JSON import/export orchestration. */
import type { Store } from '../state/store';
import { createEmptySong } from '../domain/factories';
import * as persistence from '../io/persistence';
import * as io from '../io/import-export';
import type { Result, ValidationError } from '../util/result';
import type { Song } from '../domain/types';

export class ProjectService {
  constructor(private store: Store) {}

  newSong(): void {
    this.store.dispatch({ type: 'loadSong', song: createEmptySong() });
  }

  saveToBrowser(): void {
    persistence.save(this.store.getState().song);
  }

  restoreFromBrowser(): boolean {
    const song = persistence.load();
    if (song) {
      this.store.dispatch({ type: 'loadSong', song });
      return true;
    }
    return false;
  }

  exportJsonString(): string {
    return io.exportToJsonString(this.store.getState().song);
  }

  downloadExport(): void {
    io.downloadExport(this.store.getState().song);
  }

  /** Import from pasted text. On success, loads the song; on failure, leaves state intact (US-18). */
  importFromText(text: string): Result<Song, ValidationError> {
    const result = io.importFromText(text);
    if (result.ok) this.store.dispatch({ type: 'loadSong', song: result.value });
    return result;
  }

  async importFromFile(file: File): Promise<Result<Song, ValidationError>> {
    const result = await io.importFromFile(file);
    if (result.ok) this.store.dispatch({ type: 'loadSong', song: result.value });
    return result;
  }
}
