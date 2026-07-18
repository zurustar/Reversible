/** Master effects chain (U2): distortion -> PCF -> delay -> compressor. */
import type { EffectsParams } from '../domain/types';
import { cutoffToHz, resonanceToQ } from './param-maps';
import { clamp01 } from '../util/num';

interface Stage {
  input: AudioNode;
  output: AudioNode;
  apply(fx: EffectsParams): void;
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
  const shaper = ctx.createWaveShaper();
  const drive = ctx.createGain();
  const output = ctx.createGain();
  input.connect(dry).connect(output);
  input.connect(drive).connect(shaper).connect(wet).connect(output);
  return {
    input,
    output,
    apply(fx) {
      const d = fx.distortion;
      shaper.curve = distortionCurve(d.amount);
      drive.gain.value = 1 + clamp01(d.amount) * 3;
      dry.gain.value = d.on ? 0 : 1;
      wet.gain.value = d.on ? 0.9 : 0;
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
    apply(fx) {
      const p = fx.pcf;
      const base = cutoffToHz(p.cutoff);
      filter.frequency.value = base;
      filter.Q.value = resonanceToQ(p.resonance);
      lfo.frequency.value = 0.05 + clamp01(p.rate) * 12;
      lfoGain.gain.value = clamp01(p.depth) * base * 0.9;
      dry.gain.value = p.on ? 0 : 1;
      wet.gain.value = p.on ? 1 : 0;
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
    apply(fx) {
      const d = fx.delay;
      delay.delayTime.value = 0.02 + clamp01(d.time) * 0.6;
      fb.gain.value = clamp01(d.feedback) * 0.85;
      wet.gain.value = d.on ? clamp01(d.mix) : 0;
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
    apply(fx) {
      const c = fx.compressor;
      comp.threshold.value = -clamp01(c.amount) * 40;
      comp.ratio.value = 1 + clamp01(c.amount) * 11;
      comp.knee.value = 20;
      dry.gain.value = c.on ? 0 : 1;
      wet.gain.value = c.on ? 1 : 0;
    },
  };
}

export class FxChain {
  readonly input: AudioNode;
  private stages: Stage[];
  private tail: AudioNode;

  constructor(ctx: BaseAudioContext) {
    this.stages = [makeDistortion(ctx), makePcf(ctx), makeDelay(ctx), makeCompressor(ctx)];
    this.input = this.stages[0].input;
    for (let i = 0; i < this.stages.length - 1; i++) this.stages[i].output.connect(this.stages[i + 1].input);
    this.tail = this.stages[this.stages.length - 1].output;
  }

  connect(destination: AudioNode): void {
    this.tail.connect(destination);
  }

  apply(fx: EffectsParams): void {
    for (const s of this.stages) s.apply(fx);
  }
}
