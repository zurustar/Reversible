/** PersistenceService (U3, C-10). localStorage save/restore. Fail-safe. */
import type { Song } from '../domain/types';
import { serialize } from './serializer';
import { validate } from './validator';

const STORAGE_KEY = 'reversible.song.v1';
const LEGACY_STORAGE_KEYS = ['rerebirth.song.v1']; // pre-rename autosaves

export function save(song: Song): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(song)));
  } catch (err) {
    console.warn('Persistence save failed', err);
  }
}

export function load(): Song | null {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const k of LEGACY_STORAGE_KEYS) {
        raw = localStorage.getItem(k);
        if (raw) break;
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = validate(parsed);
    return result.ok ? result.value : null;
  } catch (err) {
    console.warn('Persistence load failed', err);
    return null;
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
