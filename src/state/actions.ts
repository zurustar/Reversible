/** Store actions (U1 Core). */
import type { BasslineParams, BasslineStep, DrumVoiceParams, EffectsParams, Song, Waveform } from '../domain/types';
import type { DrumVoiceId } from '../domain/constants';

export type EffectName = keyof EffectsParams;

export type Action =
  | { type: 'toggleDrumStep'; machine: number; voiceId: DrumVoiceId; index: number }
  | { type: 'cycleDrumStep'; machine: number; voiceId: DrumVoiceId; index: number }
  | { type: 'setDrumStepAccent'; machine: number; voiceId: DrumVoiceId; index: number; accent: boolean }
  | { type: 'setBasslineStep'; track: number; index: number; step: Partial<BasslineStep> }
  | { type: 'setBasslineParam'; track: number; key: keyof BasslineParams; value: number | Waveform }
  | { type: 'setDrumParam'; machine: number; voiceId: DrumVoiceId; key: keyof DrumVoiceParams; value: number }
  | { type: 'toggleEffect'; effect: EffectName }
  | { type: 'setEffectParam'; effect: EffectName; key: string; value: number }
  | { type: 'setBpm'; bpm: number }
  | { type: 'setSwing'; swing: number }
  | { type: 'setName'; name: string }
  | { type: 'transport'; playing: boolean }
  | { type: 'setCurrentStep'; index: number }
  | { type: 'loadSong'; song: Song }
  | { type: 'selectPattern'; id: string }
  | { type: 'addPattern' }
  | { type: 'duplicatePattern' }
  | { type: 'deletePattern'; id: string }
  | { type: 'setSongMode'; on: boolean }
  | { type: 'setSongPos'; pos: number }
  | { type: 'appendToChain'; id: string }
  | { type: 'removeChainAt'; index: number };

export interface AppState {
  song: Song;
  playing: boolean;
  currentStep: number;
  selectedPatternId: string;
  songMode: boolean;
  songPos: number; // index into song.patternOrder (song mode playback position)
}
