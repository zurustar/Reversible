/** Bassline-style monophonic bass voice (U2, C-06). Osc -> resonant LPF -> VCA. Accent/slide. */
import type { BasslineParams, Waveform, TriggerEvent } from '../domain/types';
import type { Instrument, BasslineFilter } from './instrument';
import { BiquadBasslineFilter } from './bassline-filter';
import { noteToFreq, tuneToCents, decayToSeconds, levelToGain, accentAmount } from './param-maps';
import { cancelAndHold } from './automation';
import { clamp01 } from '../util/num';

const ACCENT_GAIN_BOOST = 0.4;
const WAVEFORMS: readonly Waveform[] = ['saw', 'square'];
const OSC_TYPE: Record<Waveform, OscillatorType> = { saw: 'sawtooth', square: 'square' };

/** Set an AudioParam now (`when` omitted: live edit) or at `when` (scheduled, e.g. offline render). */
function setParamValue(param: AudioParam, value: number, when?: number): void {
  if (when === undefined) param.value = value;
  else param.setValueAtTime(value, when);
}

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
  /** One oscillator per waveform, crossfaded by gain: unlike `osc.type`, a gain
   * change can be SCHEDULED, so the waveform can follow the pattern being played. */
  private oscs: Record<Waveform, OscillatorNode>;
  private oscGains: Record<Waveform, GainNode>;
  private filter: BasslineFilter;
  private driveGain: GainNode;
  private shaper: WaveShaperNode;
  private vca: GainNode;
  private out: GainNode;
  private params: BasslineParams;
  private lastNote: number | null = null;
  private lastFreq = 0;
  private slideInto = false; // did the previous note request a slide INTO this one?

  /** `filter` is injected (Biquad by default, or an AudioWorklet ladder filter). */
  constructor(ctx: BaseAudioContext, params: BasslineParams, filter?: BasslineFilter) {
    // Normalize the optional params so setParam() can always update them later.
    this.params = { ...params, drive: params.drive ?? 0, slideTime: params.slideTime ?? 0.4 };

    this.oscs = {} as Record<Waveform, OscillatorNode>;
    this.oscGains = {} as Record<Waveform, GainNode>;

    this.filter = filter ?? new BiquadBasslineFilter(ctx);
    // overdrive stage: filter -> driveGain -> waveshaper -> vca
    this.driveGain = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = DRIVE_CURVE;
    this.vca = ctx.createGain();
    this.vca.gain.value = 0;
    this.out = ctx.createGain();
    this.out.gain.value = levelToGain(params.volume);

    for (const w of WAVEFORMS) {
      const osc = ctx.createOscillator();
      osc.type = OSC_TYPE[w];
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(this.filter.input);
      osc.start();
      this.oscs[w] = osc;
      this.oscGains[w] = gain;
    }
    this.setWaveform(this.params.waveform);

    this.filter.output.connect(this.driveGain);
    this.driveGain.connect(this.shaper);
    this.shaper.connect(this.vca);
    this.vca.connect(this.out);
    this.setDrive(this.params.drive ?? 0);
  }

  /** Unmute the selected oscillator and mute the others (scheduled when `when` is given). */
  private setWaveform(waveform: Waveform, when?: number): void {
    for (const w of WAVEFORMS) setParamValue(this.oscGains[w].gain, w === waveform ? 1 : 0, when);
  }

  private setDrive(v: number, when?: number): void {
    // 0 = mostly clean (input stays in the linear region), 1 = hard clip
    setParamValue(this.driveGain.gain, 0.5 + clamp01(v) * 6, when);
  }

  connect(destination: AudioNode): void {
    this.out.connect(destination);
  }

  setParam(key: string, value: number | string, when?: number): void {
    if (key === 'waveform') {
      if ((value === 'saw' || value === 'square') && value !== this.params.waveform) {
        this.params.waveform = value;
        this.setWaveform(value, when);
      }
      return;
    }
    if (typeof value !== 'number' || !(key in this.params)) return;
    const params = this.params as unknown as Record<string, number>;
    if (params[key] === value) return; // unchanged: keeps re-applied pattern params free
    params[key] = value;
    if (key === 'volume') setParamValue(this.out.gain, levelToGain(value), when);
    if (key === 'drive') this.setDrive(value, when);
  }

  /** The frequency of every oscillator (they all track the same note). */
  private frequencies(): AudioParam[] {
    return WAVEFORMS.map((w) => this.oscs[w].frequency);
  }

  trigger(event: TriggerEvent, when: number, stepDur = 0): void {
    const note = event.note ?? 12;
    const freq = noteToFreq(note, tuneToCents(this.params.tune));
    // Slide semantics: the step with slide ON glides/ties INTO the next note, so
    // THIS note is legato when the PREVIOUS step requested a slide (not its own flag).
    const slide = this.slideInto && this.lastNote !== null && this.lastFreq > 0;
    const willSlide = event.slide === true; // this note ties into the next one

    const glide = 0.01 + (this.params.slideTime ?? 0.4) * 0.14; // 10..150 ms
    for (const f of this.frequencies()) {
      cancelAndHold(f, when);
      if (slide) {
        // glide from the previous pitch and REACH the target exactly within the glide time
        // (setTargetAtTime only asymptotes and can leave the note off-pitch = out of tune).
        f.setValueAtTime(this.lastFreq, when);
        f.exponentialRampToValueAtTime(freq, when + glide);
      } else {
        f.setValueAtTime(freq, when);
      }
    }
    this.lastNote = note;
    this.lastFreq = freq;
    this.slideInto = event.slide === true; // this note slides into the next one

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

    // Amp envelope.
    //  - fresh note: attack from 0 to peak
    //  - legato (slid into): continue at peak, no re-attack click
    //  - if THIS note slides into the next: hold at peak for one step (tie), so
    //    the tied group sounds as one longer note; release only if no next note
    //    arrives (the next note's trigger cancels/replaces this release).
    const g = this.vca.gain;
    let peak = 1;
    if (event.accent) peak = Math.min(1.5, 1 + accentAmount(this.params.accent) * ACCENT_GAIN_BOOST);
    const decay = Math.max(0.05, decayToSeconds(this.params.decay));
    cancelAndHold(g, when);
    if (slide) {
      g.setValueAtTime(peak, when); // legato entry from the held previous note
    } else {
      g.setValueAtTime(0.0001, when);
      g.linearRampToValueAtTime(peak, when + 0.005);
    }
    if (willSlide && stepDur > 0) {
      g.setValueAtTime(peak, when + stepDur); // sustain across this step (tie)
      g.exponentialRampToValueAtTime(0.0001, when + stepDur + decay);
    } else {
      g.exponentialRampToValueAtTime(0.0001, when + decay);
    }
  }
}
