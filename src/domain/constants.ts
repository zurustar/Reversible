/** Domain constants (U1 Core). See aidlc-docs/construction/u1-core/functional-design/domain-entities.md */

export const SCHEMA_VERSION = 1;
export const STEP_COUNT = 16;

export const BPM_MIN = 20;
export const BPM_MAX = 300;
export const BPM_DEFAULT = 120;

/**
 * Bassline note is an absolute semitone index in [NOTE_MIN, NOTE_MAX].
 * Input model: one octave of 12 pitch classes (C..B) plus a per-step octave
 * band (0=low, 1=mid, 2=high). note = pitchClass + 12 * octaveBand.
 * Range is 3 octaves (C2..B4).
 */
export const NOTE_MIN = 0;
export const NOTE_MAX = 35;
export const OCTAVE_BANDS = 3; // low / mid / high
export const DEFAULT_OCTAVE_BAND = 1; // mid

/** Number of bassline tracks. */
export const BASSLINE_COUNT = 2;
export const BASSLINE_LABELS = ['Bassline A', 'Bassline B'];

/** Two drum machines, voiced differently: an analog-style and a digital-style. */
export const DRUM_MACHINE_COUNT = 2;
export const DRUM_MACHINE_STYLES = ['analog', 'digital'] as const;
export type DrumStyle = (typeof DRUM_MACHINE_STYLES)[number];
export const DRUM_MACHINE_LABELS = ['Drum Machine I', 'Drum Machine II'];

/**
 * Drum voice ids. Order = UI display order, top → bottom, arranged like drum
 * notation: highest-pitched at the top, lowest (bass drum) at the bottom.
 */
export const DRUM_VOICE_IDS = ['cy', 'ch', 'oh', 'rs', 'clap', 'cb', 'sd', 'ht', 'mt', 'lt', 'bd'] as const;
export type DrumVoiceId = (typeof DRUM_VOICE_IDS)[number];

/** Extra per-voice parameters exposed in the UI (beyond Level), analog-drum-machine style. */
export interface DrumControl {
  key: 'tone' | 'decay' | 'tune' | 'snappy';
  label: string;
}
export const DRUM_VOICE_CONTROLS: Record<DrumVoiceId, DrumControl[]> = {
  bd: [{ key: 'tone', label: 'Tone' }, { key: 'decay', label: 'Decay' }],
  sd: [{ key: 'tone', label: 'Tone' }, { key: 'snappy', label: 'Snappy' }],
  lt: [{ key: 'tune', label: 'Tune' }],
  mt: [{ key: 'tune', label: 'Tune' }],
  ht: [{ key: 'tune', label: 'Tune' }],
  rs: [],
  clap: [],
  cb: [{ key: 'tune', label: 'Tune' }],
  cy: [{ key: 'tone', label: 'Tone' }, { key: 'decay', label: 'Decay' }],
  ch: [{ key: 'decay', label: 'Decay' }],
  oh: [{ key: 'decay', label: 'Decay' }],
};

export const DRUM_VOICE_LABELS: Record<DrumVoiceId, string> = {
  bd: 'Bass Drum',
  sd: 'Snare',
  lt: 'Low Tom',
  mt: 'Mid Tom',
  ht: 'Hi Tom',
  rs: 'Rim Shot',
  clap: 'Clap',
  cb: 'Cowbell',
  cy: 'Cymbal',
  ch: 'Closed Hat',
  oh: 'Open Hat',
};
