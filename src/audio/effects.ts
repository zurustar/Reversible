/** Master effects chain (U2): distortion -> PCF -> delay -> compressor.
 * Effects settings belong to the pattern, so every stage can also SCHEDULE its
 * change (`when`): the chain is shared, and the offline renderer schedules the
 * whole song before rendering. */
import type { EffectsParams } from '../domain/types';
import { cutoffToHz, resonanceToQ } from './param-maps';
import { setParamValue } from './automation';
import { clamp01 } from '../util/num';

interface Stage {
  input: AudioNode;
  output: AudioNode;
  apply(fx: EffectsParams, when?: number): void;
}

function distortionCurve(amount: number): Float32Array {
  const k = clamp01(amount) * 100 + 1;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); // soft-clip
  }
  return curve;
}

function makeDistortion(ctx: BaseAudioContext): Stage {
  const input = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const drive = ctx.createGain();
  const output = ctx.createGain();
  input.connect(dry).connect(output);
  input.connect(drive);
  wet.connect(output);

  // `WaveShaper.curve` can only be replaced immediately, which would leak one
  // pattern's Amount into the whole offline render. So keep one shaper per Amount
  // used and pick between them with (schedulable) gains.
  const shapers = new Map<number, GainNode>();
  function shaperGain(amount: number): GainNode {
    const key = Math.round(clamp01(amount) * 100) / 100;
    let gain = shapers.get(key);
    if (!gain) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = distortionCurve(key);
      gain = ctx.createGain();
      gain.gain.value = 0;
      drive.connect(shaper).connect(gain).connect(wet);
      shapers.set(key, gain);
    }
    return gain;
  }

  return {
    input,
    output,
    apply(fx, when) {
      const d = fx.distortion;
      const active = shaperGain(d.amount);
      for (const gain of shapers.values()) setParamValue(gain.gain, gain === active ? 1 : 0, when);
      setParamValue(drive.gain, 1 + clamp01(d.amount) * 3, when);
      setParamValue(dry.gain, d.on ? 0 : 1, when);
      setParamValue(wet.gain, d.on ? 0.9 : 0, when);
    },
  };
}

function makePcf(ctx: BaseAudioContext): Stage {
  const input = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const lfo = ctx.createOscillator();
  lfo.type = 'triangle';
  const lfoGain = ctx.createGain();
  const output = ctx.createGain();
  lfo.connect(lfoGain).connect(filter.frequency);
  input.connect(dry).connect(output);
  input.connect(filter).connect(wet).connect(output);
  lfo.start();
  return {
    input,
    output,
    apply(fx, when) {
      const p = fx.pcf;
      const base = cutoffToHz(p.cutoff);
      setParamValue(filter.frequency, base, when);
      setParamValue(filter.Q, resonanceToQ(p.resonance), when);
      setParamValue(lfo.frequency, 0.05 + clamp01(p.rate) * 12, when);
      setParamValue(lfoGain.gain, clamp01(p.depth) * base * 0.9, when);
      setParamValue(dry.gain, p.on ? 0 : 1, when);
      setParamValue(wet.gain, p.on ? 1 : 0, when);
    },
  };
}

function makeDelay(ctx: BaseAudioContext): Stage {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const delay = ctx.createDelay(1.0);
  const fb = ctx.createGain();
  dry.gain.value = 1;
  input.connect(dry).connect(output);
  input.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(output);
  return {
    input,
    output,
    apply(fx, when) {
      const d = fx.delay;
      setParamValue(delay.delayTime, 0.02 + clamp01(d.time) * 0.6, when);
      setParamValue(fb.gain, clamp01(d.feedback) * 0.85, when);
      setParamValue(wet.gain, d.on ? clamp01(d.mix) : 0, when);
    },
  };
}

function makeCompressor(ctx: BaseAudioContext): Stage {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  input.connect(dry).connect(output);
  input.connect(comp).connect(wet).connect(output);
  return {
    input,
    output,
    apply(fx, when) {
      const c = fx.compressor;
      setParamValue(comp.threshold, -clamp01(c.amount) * 40, when);
      setParamValue(comp.ratio, 1 + clamp01(c.amount) * 11, when);
      setParamValue(comp.knee, 20, when);
      setParamValue(dry.gain, c.on ? 0 : 1, when);
      setParamValue(wet.gain, c.on ? 1 : 0, when);
    },
  };
}

export class FxChain {
  readonly input: AudioNode;
  private stages: Stage[];
  private tail: AudioNode;
  private lastApplied: EffectsParams | null = null;

  constructor(ctx: BaseAudioContext) {
    this.stages = [makeDistortion(ctx), makePcf(ctx), makeDelay(ctx), makeCompressor(ctx)];
    this.input = this.stages[0].input;
    for (let i = 0; i < this.stages.length - 1; i++) this.stages[i].output.connect(this.stages[i + 1].input);
    this.tail = this.stages[this.stages.length - 1].output;
  }

  connect(destination: AudioNode): void {
    this.tail.connect(destination);
  }

  /** Apply a pattern's effects settings. `when` schedules them (offline render).
   * Re-applying the same settings object is a no-op, so playback can call this
   * every step without churning the automation timelines. */
  apply(fx: EffectsParams, when?: number): void {
    if (fx === this.lastApplied) return;
    this.lastApplied = fx;
    for (const s of this.stages) s.apply(fx, when);
  }
}
