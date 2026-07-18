/** SongSerializer (U3, C-08). Song <-> plain JSON object. Round-trip safe (PBT-02, FR-5.7). */
import type { Song } from '../domain/types';

export function serialize(song: Song): object {
  // Song is already plain data; deep clone to decouple from live state.
  return JSON.parse(JSON.stringify(song));
}

export function deserialize(data: object): Song {
  // Assumes `data` has already passed validation (see validator.ts).
  return JSON.parse(JSON.stringify(data)) as Song;
}

export function toJsonString(song: Song): string {
  return JSON.stringify(serialize(song), null, 2);
}
