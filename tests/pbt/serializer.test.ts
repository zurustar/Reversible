/** PBT-02: serialize -> deserialize round-trip is identity (FR-5.7). */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { serialize, deserialize, toJsonString } from '../../src/io/serializer';
import { parseAndValidate } from '../../src/io/validator';
import { arbitrarySong } from '../generators';

describe('SongSerializer round-trip (PBT-02)', () => {
  it('deserialize(serialize(song)) equals song', () => {
    fc.assert(
      fc.property(arbitrarySong, (song) => {
        const round = deserialize(serialize(song));
        expect(round).toEqual(song);
      }),
    );
  });

  it('export string -> validate -> equals song (US-15/16 round-trip)', () => {
    fc.assert(
      fc.property(arbitrarySong, (song) => {
        const text = toJsonString(song);
        const result = parseAndValidate(text);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toEqual(song);
      }),
    );
  });
});
