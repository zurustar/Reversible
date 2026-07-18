/** Pure reducer (U1 Core). Immutable updates with clamping/validation (business-rules.md). */
import { BPM_MIN, BPM_MAX, NOTE_MIN, NOTE_MAX, STEP_COUNT, type DrumVoiceId } from '../domain/constants';
import type { Pattern, DrumStep } from '../domain/types';
import { createEmptyPattern } from '../domain/factories';
import { clamp, clamp01, clampInt } from '../util/num';
import type { Action, AppState } from './actions';

function inStepRange(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < STEP_COUNT;
}

/** Return the selected pattern (falls back to first). */
function selectedPattern(state: AppState): Pattern {
  return state.song.patterns.find((p) => p.id === state.selectedPatternId) ?? state.song.patterns[0];
}

/** Look up a pattern by id (falls back to first). */
function patternById(state: AppState, id: string): Pattern {
  return state.song.patterns.find((p) => p.id === id) ?? state.song.patterns[0];
}

/** Generate a unique `pattern-N` id not already used. */
function nextPatternId(patterns: Pattern[]): string {
  let max = 0;
  for (const p of patterns) {
    const m = /^pattern-(\d+)$/.exec(p.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `pattern-${max + 1}`;
}

function deepClonePattern(p: Pattern): Pattern {
  return JSON.parse(JSON.stringify(p)) as Pattern;
}

/** Replace the selected pattern with a mutated copy produced by `fn`. */
function updateSelectedPattern(state: AppState, fn: (p: Pattern) => Pattern): AppState {
  const target = selectedPattern(state);
  const patterns = state.song.patterns.map((p) => (p.id === target.id ? fn(p) : p));
  return { ...state, song: { ...state.song, patterns } };
}

/** Update one drum voice's steps within a given machine of the selected pattern. */
function updateDrumVoiceSteps(
  state: AppState,
  machineIndex: number,
  voiceId: DrumVoiceId,
  fn: (steps: DrumStep[]) => DrumStep[],
): AppState {
  return updateSelectedPattern(state, (p) => {
    const machine = p.drums[machineIndex];
    if (!machine) return p;
    const voice = machine.voices[voiceId];
    if (!voice) return p;
    const voices = { ...machine.voices, [voiceId]: { ...voice, steps: fn(voice.steps) } };
    const drums = p.drums.map((m, i) => (i === machineIndex ? { voices } : m));
    return { ...p, drums };
  });
}

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'toggleDrumStep': {
      if (!inStepRange(action.index)) return state;
      return updateDrumVoiceSteps(state, action.machine, action.voiceId, (steps) =>
        steps.map((s, i) => (i === action.index ? { ...s, on: !s.on } : s)),
      );
    }
    case 'cycleDrumStep': {
      if (!inStepRange(action.index)) return state;
      // off -> on -> on+accent -> off
      return updateDrumVoiceSteps(state, action.machine, action.voiceId, (steps) =>
        steps.map((s, i) => {
          if (i !== action.index) return s;
          if (!s.on) return { ...s, on: true, accent: false };
          if (!s.accent) return { ...s, on: true, accent: true };
          return { ...s, on: false, accent: false };
        }),
      );
    }
    case 'setDrumStepAccent': {
      if (!inStepRange(action.index)) return state;
      return updateDrumVoiceSteps(state, action.machine, action.voiceId, (steps) =>
        steps.map((s, i) => (i === action.index ? { ...s, accent: action.accent } : s)),
      );
    }
    case 'setBasslineStep': {
      if (!inStepRange(action.index)) return state;
      return updateSelectedPattern(state, (p) => {
        const track = p.bassline[action.track];
        if (!track) return p;
        const steps = track.steps.map((s, i) => {
          if (i !== action.index) return s;
          const next = { ...s, ...action.step };
          next.note = clampInt(next.note, NOTE_MIN, NOTE_MAX);
          return next;
        });
        const bassline = p.bassline.map((t, i) => (i === action.track ? { ...t, steps } : t));
        return { ...p, bassline };
      });
    }
    case 'setBasslineParam': {
      return updateSelectedPattern(state, (p) => {
        const track = p.bassline[action.track];
        if (!track) return p;
        const params = { ...track.params };
        if (action.key === 'waveform') {
          if (action.value === 'saw' || action.value === 'square') params.waveform = action.value;
        } else if (typeof action.value === 'number') {
          params[action.key] = clamp01(action.value);
        }
        const bassline = p.bassline.map((t, i) => (i === action.track ? { ...t, params } : t));
        return { ...p, bassline };
      });
    }
    case 'setDrumParam': {
      return updateSelectedPattern(state, (p) => {
        const machine = p.drums[action.machine];
        if (!machine) return p;
        const voice = machine.voices[action.voiceId];
        if (!voice) return p;
        const params = { ...voice.params, [action.key]: clamp01(action.value) };
        const voices = { ...machine.voices, [action.voiceId]: { ...voice, params } };
        const drums = p.drums.map((m, i) => (i === action.machine ? { voices } : m));
        return { ...p, drums };
      });
    }
    case 'toggleEffect': {
      const fx = state.song.effects[action.effect];
      const updated = { ...fx, on: !fx.on };
      return { ...state, song: { ...state.song, effects: { ...state.song.effects, [action.effect]: updated } } };
    }
    case 'setEffectParam': {
      const fx = state.song.effects[action.effect] as Record<string, number | boolean>;
      if (!(action.key in fx) || typeof fx[action.key] !== 'number') return state;
      const updated = { ...fx, [action.key]: clamp01(action.value) };
      return { ...state, song: { ...state.song, effects: { ...state.song.effects, [action.effect]: updated } } };
    }
    case 'setBpm':
      return { ...state, song: { ...state.song, bpm: clamp(action.bpm, BPM_MIN, BPM_MAX) } };
    case 'setSwing':
      return { ...state, song: { ...state.song, swing: clamp01(action.swing) } };
    case 'setName':
      return { ...state, song: { ...state.song, name: action.name.slice(0, 64) } };
    case 'transport':
      return { ...state, playing: action.playing };
    case 'setCurrentStep':
      return { ...state, currentStep: clampInt(action.index, 0, STEP_COUNT - 1) };
    case 'loadSong': {
      const first = action.song.patterns[0];
      return {
        song: action.song,
        playing: false,
        currentStep: 0,
        selectedPatternId: first ? first.id : '',
        songMode: false,
        songPos: 0,
      };
    }
    case 'selectPattern': {
      const exists = state.song.patterns.some((p) => p.id === action.id);
      return exists ? { ...state, selectedPatternId: action.id } : state;
    }
    case 'addPattern': {
      const id = nextPatternId(state.song.patterns);
      const pattern = createEmptyPattern(id);
      return {
        ...state,
        song: { ...state.song, patterns: [...state.song.patterns, pattern], patternOrder: [...state.song.patternOrder, id] },
        selectedPatternId: id,
      };
    }
    case 'duplicatePattern': {
      const src = selectedPattern(state);
      const id = nextPatternId(state.song.patterns);
      const copy: Pattern = { ...deepClonePattern(src), id };
      return {
        ...state,
        song: { ...state.song, patterns: [...state.song.patterns, copy], patternOrder: [...state.song.patternOrder, id] },
        selectedPatternId: id,
      };
    }
    case 'deletePattern': {
      if (state.song.patterns.length <= 1) return state;
      const patterns = state.song.patterns.filter((p) => p.id !== action.id);
      let patternOrder = state.song.patternOrder.filter((pid) => pid !== action.id);
      if (patternOrder.length === 0) patternOrder = [patterns[0].id];
      const selectedPatternId = state.selectedPatternId === action.id ? patterns[0].id : state.selectedPatternId;
      const songPos = clampInt(state.songPos, 0, patternOrder.length - 1);
      return { ...state, song: { ...state.song, patterns, patternOrder }, selectedPatternId, songPos };
    }
    case 'setSongMode':
      return { ...state, songMode: action.on, songPos: 0 };
    case 'setSongPos': {
      const len = Math.max(1, state.song.patternOrder.length);
      return { ...state, songPos: ((Math.trunc(action.pos) % len) + len) % len };
    }
    case 'appendToChain': {
      if (!state.song.patterns.some((p) => p.id === action.id)) return state;
      return { ...state, song: { ...state.song, patternOrder: [...state.song.patternOrder, action.id] } };
    }
    case 'removeChainAt': {
      if (state.song.patternOrder.length <= 1) return state;
      if (action.index < 0 || action.index >= state.song.patternOrder.length) return state;
      const patternOrder = state.song.patternOrder.filter((_, i) => i !== action.index);
      return { ...state, song: { ...state.song, patternOrder }, songPos: clampInt(state.songPos, 0, patternOrder.length - 1) };
    }
    default:
      return state;
  }
}

export { selectedPattern, patternById };
