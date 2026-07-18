/** Validator: rejects malformed/unsafe input without throwing (SEC-05/13/15, US-18). */
import { describe, it, expect } from 'vitest';
import { parseAndValidate } from '../../src/io/validator';
import { toJsonString } from '../../src/io/serializer';
import { createEmptySong } from '../../src/domain/factories';

describe('SongValidator', () => {
  it('accepts a valid exported song', () => {
    const song = createEmptySong('Test');
    const result = parseAndValidate(toJsonString(song));
    expect(result.ok).toBe(true);
  });

  it('rejects invalid JSON with E_PARSE (no throw)', () => {
    const result = parseAndValidate('{ not valid json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('E_PARSE');
  });

  it('rejects wrong schema version', () => {
    const bad = { ...createEmptySong(), schemaVersion: 999 };
    const result = parseAndValidate(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('E_VERSION');
  });

  it('rejects out-of-range bpm', () => {
    const bad = { ...createEmptySong(), bpm: 9999 };
    const result = parseAndValidate(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('E_RANGE');
  });

  it('rejects a pattern with wrong step count', () => {
    const song = createEmptySong();
    song.patterns[0].bassline[0].steps.pop();
    const result = parseAndValidate(JSON.stringify(song));
    expect(result.ok).toBe(false);
  });

  it('treats input as data only (no prototype pollution, SEC-13)', () => {
    const song = createEmptySong();
    song.name = '<script>alert(1)</script>';
    // Inject a raw __proto__ key; JSON.parse makes it an own prop, not a prototype change.
    const raw = JSON.stringify(song).replace('{', '{"__proto__":{"hacked":true},');
    const result = parseAndValidate(raw);
    expect(result.ok).toBe(true);
    expect(({} as Record<string, unknown>).hacked).toBeUndefined();
    if (result.ok) expect(typeof result.value.name).toBe('string');
  });
});
