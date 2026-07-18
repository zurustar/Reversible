/** ImportExportManager (U3, C-11). JSON download + import from text/file. */
import type { Song } from '../domain/types';
import { toJsonString } from './serializer';
import { parseAndValidate } from './validator';
import type { Result, ValidationError } from '../util/result';

export function exportToJsonString(song: Song): string {
  return toJsonString(song);
}

function safeFilename(name: string): string {
  const base = name.trim().replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 40) || 'song';
  return `${base}.json`;
}

/** Trigger a browser download of the song as JSON (no server). */
export function downloadExport(song: Song): void {
  const text = toJsonString(song);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename(song.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Import from pasted text (required path, US-16). */
export function importFromText(text: string): Result<Song, ValidationError> {
  return parseAndValidate(text);
}

/** Import from a .json File (optional path, US-17). */
export async function importFromFile(file: File): Promise<Result<Song, ValidationError>> {
  try {
    const text = await file.text();
    return parseAndValidate(text);
  } catch {
    return { ok: false, error: { code: 'E_FILE', message: 'Could not read file' } };
  }
}
