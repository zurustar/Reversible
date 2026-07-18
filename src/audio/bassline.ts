/** Bassline-style monophonic bass voice (U2, C-06). Osc -> resonant LPF -> VCA. Accent/slide. */
import type { BasslineParams, Waveform, TriggerEvent } from '../domain/types';
import type { Instrument, BasslineFilter } from './instrument';
import { BiquadBasslineFilter } from './bassline-filter';
import { noteToFreq, tuneToCents, decayToSeconds, levelToGain, accentAmount } from './param-maps';
import { clamp01 } from '../util/num';

const ACCENT_GAIN_BOOST = 0.4;

/** Soft-clip (tanh) curve for the overdrive stage, built once. */
const DRIVE_CURVE = (() => {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * 2) / Math.tanh(2);
  }
  return c;
})();

export class BasslineVoice implements Instrument {
  private osc: OscillatorNode;
  private filter: BasslineFilter;
  private driveGain: GainNode;
  private shaper: WaveShaperNode;
  private vca: GainNode;
  private out: GainNode;
  private params: BasslineParams;
  private lastNote: number | null = null;
  private lastFreq = 0;

  /** `filter` is injected (Biquad by default, or an AudioWorklet ladder filter). */
  constructor(ctx: BaseAudioContext, params: BasslineParams, filter?: BasslineFilter) {
    this.params = { ...params };

    this.osc = ctx.createOscillator();
    this.osc.type = params.waveform === 'square' ? 'square' : 'sawtooth';

    this.filter = filter ?? new BiquadBasslineFilter(ctx);
    // overdrive stage: filter -> driveGain -> waveshaper -> vca
    this.driveGain = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = DRIVE_CURVE;
    this.vca = ctx.createGain();
    this.vca.gain.value = 0;
    this.out = ctx.createGain();
    this.out.gain.value = levelToGain(params.volume);

    this.osc.connect(this.filter.input);
    this.filter.output.connect(this.driveGain);
    this.driveGain.connect(this.shaper);
    this.shaper.connect(this.vca);
    this.vca.connect(this.out);
    this.setDrive(params.drive ?? 0);
    this.osc.start();
  }

  private setDrive(v: number): void {
    // 0 = mostly clean (input stays in the linear region), 1 = hard clip
    this.driveGain.gain.value = 0.5 + clamp01(v) * 6;
  }

  connect(destination: AudioNode): void {
    this.out.connect(destination);
  }

  setParam(key: string, value: number | string): void {
    if (key === 'waveform') {
      if (value === 'saw' || value === 'square') {
        this.params.waveform = value as Waveform;
        this.osc.type = value === 'square' ? 'square' : 'sawtooth';
      }
      return;
    }
    if (typeof value === 'number' && key in this.params) {
      (this.params as unknown as Record<string, number>)[key] = value;
      if (key === 'volume') this.out.gain.value = levelToGain(value);
      if (key === 'drive') this.setDrive(value);
    }
  }

  trigger(event: TriggerEvent, when: number): void {
    const note = event.note ?? 12;
    const freq = noteToFreq(note, tuneToCents(this.params.tune));
    const slide = event.slide === true && this.lastNote !== null && this.lastFreq > 0;

    const f = this.osc.frequency;
    f.cancelScheduledValues(when);
    if (slide) {
      // glide from the previous pitch and REACH the target exactly within the glide time
      // (setTargetAtTime only asymptotes and can leave the note off-pitch = out of tune).
      const glide = 0.01 + (this.params.slideTime ?? 0.4) * 0.14; // 10..150 ms
      f.setValueAtTime(this.lastFreq, when);
      f.exponentialRampToValueAtTime(freq, when + glide);
    } else {
      f.setValueAtTime(freq, when);
    }
    this.lastNote = note;
    this.lastFreq = freq;

    // Filter envelope (skip re-trigger on slide to keep legato feel)
    if (!slide) {
      this.filter.triggerEnvelope(when, {
        cutoff: this.params.cutoff,
        resonance: this.params.resonance,
        envMod: this.params.envMod,
        decay: this.params.decay,
        accent: event.accent === true,
        accentAmount: this.params.accent,
      });
    }

    // Amp envelope — always sounds. Slide = legato (no re-attack from zero),
    // just re-assert the level and let it decay while the pitch glides.
    const g = this.vca.gain;
    let peak = 1;
    if (event.accent) peak = Math.min(1.5, 1 + accentAmount(this.params.accent) * ACCENT_GAIN_BOOST);
    const decay = Math.max(0.05, decayToSeconds(this.params.decay));
    g.cancelScheduledValues(when);
    if (slide) {
      // tie into the previous note: hold near peak (no click), then decay
      g.setValueAtTime(Math.max(0.0001, peak * 0.85), when);
      g.exponentialRampToValueAtTime(0.0001, when + decay);
    } else {
      g.setValueAtTime(0.0001, when);
      g.linearRampToValueAtTime(peak, when + 0.005);
      g.exponentialRampToValueAtTime(0.0001, when + decay);
    }
  }
}
