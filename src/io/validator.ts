/** SongValidator (U3, C-09). Safe parse + schema/type validation of untrusted JSON (SEC-05/13/15). */
import {
  SCHEMA_VERSION,
  STEP_COUNT,
  BPM_MIN,
  BPM_MAX,
  NOTE_MIN,
  NOTE_MAX,
  DRUM_VOICE_IDS,
} from '../domain/constants';
import { BASSLINE_COUNT, DRUM_MACHINE_COUNT } from '../domain/constants';
import type { Song, EffectsParams, BasslineTrack, DrumTrack } from '../domain/types';
import { createDefaultEffects, createBasslineTrack, createDrumTrack } from '../domain/factories';
import { type Result, type ValidationError, ok, err } from '../util/result';

function fail(code: string, message: string, path?: string): Result<never, ValidationError> {
  return err({ code, message, path });
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNumberInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

function validateBassline(track: unknown, path: string): Result<true, ValidationError> {
  if (!isObject(track)) return fail('E_TYPE', 'bassline must be an object', path);
  if (!Array.isArray(track.steps) || track.steps.length !== STEP_COUNT)
    return fail('E_STEPS', `bassline.steps must have ${STEP_COUNT} entries`, path);
  for (let i = 0; i < track.steps.length; i++) {
    const s = track.steps[i];
    if (!isObject(s)) return fail('E_TYPE', 'step must be an object', `${path}.steps[${i}]`);
    if (typeof s.on !== 'boolean') return fail('E_TYPE', 'step.on must be boolean', `${path}.steps[${i}]`);
    if (!isNumberInRange(s.note, NOTE_MIN, NOTE_MAX))
      return fail('E_RANGE', `note out of range`, `${path}.steps[${i}]`);
    if (typeof s.accent !== 'boolean' || typeof s.slide !== 'boolean')
      return fail('E_TYPE', 'accent/slide must be boolean', `${path}.steps[${i}]`);
  }
  if (!isObject(track.params)) return fail('E_TYPE', 'bassline.params missing', path);
  const p = track.params;
  if (p.waveform !== 'saw' && p.waveform !== 'square')
    return fail('E_ENUM', 'waveform must be saw|square', `${path}.params`);
  for (const key of ['tune', 'cutoff', 'resonance', 'envMod', 'decay', 'accent', 'volume']) {
    if (!isNumberInRange(p[key], 0, 1)) return fail('E_RANGE', `${key} must be in [0,1]`, `${path}.params`);
  }
  return ok(true);
}

function validateDrums(drums: unknown, path: string): Result<true, ValidationError> {
  if (!isObject(drums) || !isObject(drums.voices)) return fail('E_TYPE', 'drums.voices missing', path);
  for (const id of DRUM_VOICE_IDS) {
    const voice = (drums.voices as Record<string, unknown>)[id];
    // Missing voices are tolerated (older saves) — normalizeDrums fills them in.
    if (voice === undefined) continue;
    if (!isObject(voice)) return fail('E_VOICE', `invalid drum voice ${id}`, path);
    if (!Array.isArray(voice.steps) || voice.steps.length !== STEP_COUNT)
      return fail('E_STEPS', `drum voice ${id} needs ${STEP_COUNT} steps`, path);
    for (let i = 0; i < voice.steps.length; i++) {
      const s = voice.steps[i];
      if (!isObject(s) || typeof s.on !== 'boolean')
        return fail('E_TYPE', 'drum step.on must be boolean', `${path}.${id}.steps[${i}]`);
    }
    if (!isObject(voice.params) || !isNumberInRange(voice.params.level, 0, 1))
      return fail('E_RANGE', `drum voice ${id} level invalid`, path);
  }
  return ok(true);
}

function validateSong(data: unknown): Result<Song, ValidationError> {
  if (!isObject(data)) return fail('E_TYPE', 'root must be an object');
  if (data.schemaVersion !== SCHEMA_VERSION)
    return fail('E_VERSION', `unsupported schemaVersion (expected ${SCHEMA_VERSION})`, 'schemaVersion');
  if (typeof data.name !== 'string') return fail('E_TYPE', 'name must be a string', 'name');
  if (!isNumberInRange(data.bpm, BPM_MIN, BPM_MAX)) return fail('E_RANGE', 'bpm out of range', 'bpm');
  if (!isNumberInRange(data.swing, 0, 1)) return fail('E_RANGE', 'swing out of range', 'swing');
  if (!Array.isArray(data.patterns) || data.patterns.length < 1)
    return fail('E_PATTERNS', 'at least one pattern required', 'patterns');
  for (let i = 0; i < data.patterns.length; i++) {
    const pat = data.patterns[i];
    if (!isObject(pat)) return fail('E_TYPE', 'pattern must be an object', `patterns[${i}]`);
    if (typeof pat.id !== 'string' || pat.id.length === 0)
      return fail('E_TYPE', 'pattern.id required', `patterns[${i}]`);
    if (pat.length !== STEP_COUNT) return fail('E_STEPS', `pattern.length must be ${STEP_COUNT}`, `patterns[${i}]`);
    // bassline: array of tracks. Back-compat: old single-object, and the legacy
    // field name (`bass303`) from files saved before the rename.
    const rawBl = pat.bassline ?? (pat as Record<string, unknown>).bass303;
    const tracks = Array.isArray(rawBl) ? rawBl : isObject(rawBl) ? [rawBl] : null;
    if (!tracks || tracks.length < 1) return fail('E_TYPE', 'bassline must be a non-empty track array', `patterns[${i}].bassline`);
    for (let t = 0; t < tracks.length; t++) {
      const b = validateBassline(tracks[t], `patterns[${i}].bassline[${t}]`);
      if (!b.ok) return b;
    }
    const machines = Array.isArray(pat.drums) ? pat.drums : isObject(pat.drums) ? [pat.drums] : null;
    if (!machines || machines.length < 1) return fail('E_TYPE', 'drums must be a non-empty machine array', `patterns[${i}].drums`);
    for (let m = 0; m < machines.length; m++) {
      const d = validateDrums(machines[m], `patterns[${i}].drums[${m}]`);
      if (!d.ok) return d;
    }
  }
  if (!Array.isArray(data.patternOrder) || data.patternOrder.some((x) => typeof x !== 'string'))
    return fail('E_TYPE', 'patternOrder must be string[]', 'patternOrder');

  // effects: optional (backward compat) — validate if present, else default.
  const effectsResult = validateEffects(data.effects);
  if (!effectsResult.ok) return effectsResult;

  const song = data as unknown as Song;
  const normalized: Song = {
    ...song,
    patterns: song.patterns.map((pat) => {
      const legacy = pat as unknown as Record<string, unknown>;
      const rawBl = pat.bassline ?? legacy.bass303;
      const cleaned = { ...pat, bassline: normalizeBassline(rawBl), drums: normalizeDrums(pat.drums as unknown) };
      delete (cleaned as unknown as Record<string, unknown>).bass303;
      return cleaned;
    }),
    effects: effectsResult.value,
  };
  return ok(normalized);
}

/** Coerce drums to an array of DRUM_MACHINE_COUNT machines, each with the full voice set. */
function normalizeDrums(raw: unknown): DrumTrack[] {
  const arr = Array.isArray(raw) ? (raw as DrumTrack[]) : isObject(raw) ? [raw as unknown as DrumTrack] : [];
  const out = arr.slice(0, DRUM_MACHINE_COUNT).map(normalizeMachine);
  while (out.length < DRUM_MACHINE_COUNT) out.push(createDrumTrack());
  return out;
}

/** Ensure a machine has every current voice id (fills missing voices with defaults, drops unknown). */
function normalizeMachine(machine: DrumTrack): DrumTrack {
  const fresh = createDrumTrack();
  const voices = { ...fresh.voices };
  for (const id of DRUM_VOICE_IDS) {
    const existing = machine?.voices?.[id];
    if (existing) voices[id] = existing;
  }
  return { voices };
}

/** Coerce bassline to an array of exactly BASSLINE_COUNT tracks (wrap old single object, pad/truncate). */
function normalizeBassline(raw: unknown): BasslineTrack[] {
  const arr = Array.isArray(raw) ? (raw as BasslineTrack[]) : isObject(raw) ? [raw as unknown as BasslineTrack] : [];
  const out = arr.slice(0, BASSLINE_COUNT);
  while (out.length < BASSLINE_COUNT) out.push(createBasslineTrack());
  return out;
}

function validateEffects(raw: unknown): Result<EffectsParams, ValidationError> {
  if (raw === undefined || raw === null) return ok(createDefaultEffects());
  if (!isObject(raw)) return fail('E_TYPE', 'effects must be an object', 'effects');
  const def = createDefaultEffects();
  const merged: EffectsParams = createDefaultEffects();
  for (const name of Object.keys(def) as (keyof EffectsParams)[]) {
    const incoming = (raw as Record<string, unknown>)[name];
    if (incoming === undefined) continue;
    if (!isObject(incoming)) return fail('E_TYPE', `effects.${name} must be an object`, `effects.${name}`);
    const target = merged[name] as Record<string, number | boolean>;
    for (const key of Object.keys(target)) {
      const v = (incoming as Record<string, unknown>)[key];
      if (v === undefined) continue;
      if (key === 'on') {
        if (typeof v !== 'boolean') return fail('E_TYPE', `effects.${name}.on must be boolean`, `effects.${name}`);
        target.on = v;
      } else {
        if (!isNumberInRange(v, 0, 1)) return fail('E_RANGE', `effects.${name}.${key} must be in [0,1]`, `effects.${name}`);
        target[key] = v;
      }
    }
  }
  return ok(merged);
}

/** Parse a JSON string and validate it as a Song. Never throws. */
export function parseAndValidate(text: string): Result<Song, ValidationError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('E_PARSE', 'Invalid JSON (could not parse)');
  }
  return validateSong(parsed);
}

/** Validate an already-parsed object. */
export function validate(data: unknown): Result<Song, ValidationError> {
  return validateSong(data);
}
