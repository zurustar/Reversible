/** Validator: rejects malformed/unsafe input without throwing (SEC-05/13/15, US-18). */
import { describe, it, expect } from 'vitest';
import { parseAndValidate } from '../../src/io/validator';
import { toJsonString } from '../../src/io/serializer';
import { createDefaultEffects, createEmptySong } from '../../src/domain/factories';
import { SCHEMA_VERSION } from '../../src/domain/constants';

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

  it('migrates a v1 song: song-wide bpm/swing/effects move into every pattern', () => {
    // A v1 file: bpm/swing/effects at the root, patterns without them.
    const v2 = createEmptySong('Old');
    const v1 = {
      schemaVersion: 1,
      name: v2.name,
      bpm: 140,
      swing: 0.25,
      effects: { ...createDefaultEffects(), delay: { on: true, time: 0.5, feedback: 0.4, mix: 0.6 } },
      patterns: [v2.patterns[0], { ...v2.patterns[0], id: 'pattern-2' }].map((p) => {
        const { bpm, swing, effects, ...rest } = p;
        void bpm, void swing, void effects;
        return rest;
      }),
      patternOrder: ['pattern-1', 'pattern-2'],
    };

    const result = parseAndValidate(JSON.stringify(v1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const song = result.value;
    expect(song.schemaVersion).toBe(SCHEMA_VERSION);
    expect((song as unknown as Record<string, unknown>).bpm).toBeUndefined();
    for (const p of song.patterns) {
      expect(p.bpm).toBe(140);
      expect(p.swing).toBe(0.25);
      expect(p.effects.delay).toMatchObject({ on: true, mix: 0.6 });
    }
    // Each pattern gets its own effects object, so editing one cannot affect another.
    expect(song.patterns[0].effects).not.toBe(song.patterns[song.patterns.length - 1].effects);
  });

  it('keeps per-pattern bpm/swing/effects when they are already present (v2)', () => {
    const song = createEmptySong('New');
    song.patterns[0].bpm = 96;
    song.patterns[0].swing = 0.5;
    song.patterns[0].effects.pcf.on = true;
    const result = parseAndValidate(toJsonString(song));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.patterns[0].bpm).toBe(96);
      expect(result.value.patterns[0].swing).toBe(0.5);
      expect(result.value.patterns[0].effects.pcf.on).toBe(true);
    }
  });

  it('rejects an out-of-range per-pattern bpm', () => {
    const song = createEmptySong();
    song.patterns[0].bpm = 9999;
    const result = parseAndValidate(toJsonString(song));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('E_RANGE');
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
