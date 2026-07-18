/**
 * AudioWorklet-based Bassline filter (richer resonant low-pass than BiquadFilter).
 * A Moog-style 4-pole transistor-ladder filter (Stilson/Smith approximation).
 * Loaded via a Blob URL so it works in dev, production build, and single-file (file://).
 * Falls back to null on any failure — caller uses the Biquad filter instead.
 */
import type { BasslineFilter } from './instrument';
import { envModAmount, accentAmount } from './param-maps';

const PROCESSOR_SRC = `
class BasslineLadderProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'cutoff', defaultValue: 0.3, minValue: 0.0006, maxValue: 0.98, automationRate: 'a-rate' },
      { name: 'resonance', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.out1 = this.out2 = this.out3 = this.out4 = 0;
    this.in1 = this.in2 = this.in3 = this.in4 = 0;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const inCh = input && input[0] ? input[0] : null;
    const outCh = output[0];
    const cut = parameters.cutoff;
    const resArr = parameters.resonance;
    const n = outCh.length;
    for (let i = 0; i < n; i++) {
      const fc = cut.length > 1 ? cut[i] : cut[0];
      // resonance 0..1 -> feedback up to ~1.1 (juicy but not runaway self-oscillation)
      const res = (resArr.length > 1 ? resArr[i] : resArr[0]) * 1.1;
      const f = fc * 1.16;
      const fb = res * (1.0 - 0.15 * f * f);
      let x = inCh ? inCh[i] : 0;
      x -= this.out4 * fb;
      x *= 0.35013 * (f * f) * (f * f);
      this.out1 = x + 0.3 * this.in1 + (1 - f) * this.out1; this.in1 = x;
      this.out2 = this.out1 + 0.3 * this.in2 + (1 - f) * this.out2; this.in2 = this.out1;
      this.out3 = this.out2 + 0.3 * this.in3 + (1 - f) * this.out3; this.in3 = this.out2;
      this.out4 = this.out3 + 0.3 * this.in4 + (1 - f) * this.out4; this.in4 = this.out3;
      outCh[i] = this.out4;
    }
    // copy mono to any extra output channels
    for (let ch = 1; ch < output.length; ch++) output[ch].set(outCh);
    return true;
  }
}
registerProcessor('bassline-ladder', BasslineLadderProcessor);
`;

class WorkletBasslineFilter implements BasslineFilter {
  readonly input: AudioWorkletNode;
  readonly output: AudioWorkletNode;
  private cutoffParam: AudioParam;
  private resonanceParam: AudioParam;

  constructor(node: AudioWorkletNode) {
    this.input = node;
    this.output = node;
    this.cutoffParam = node.parameters.get('cutoff')!;
    this.resonanceParam = node.parameters.get('resonance')!;
  }

  triggerEnvelope(
    when: number,
    opts: { cutoff: number; resonance: number; envMod: number; decay: number; accent: boolean; accentAmount: number },
  ): void {
    // Work in normalized cutoff fraction (0..1) space.
    const base = 0.03 + Math.min(1, Math.max(0, opts.cutoff)) * 0.7;
    let depth = envModAmount(opts.envMod);
    if (opts.accent) depth = Math.min(1, depth + accentAmount(opts.accentAmount) * 0.6);
    const peak = Math.min(0.98, base + depth * (0.98 - base));
    const decay = 0.03 + Math.min(1, Math.max(0, opts.decay)) * (1.5 - 0.03);

    this.resonanceParam.setValueAtTime(Math.min(1, Math.max(0, opts.resonance)), when);
    const c = this.cutoffParam;
    c.cancelScheduledValues(when);
    c.setValueAtTime(peak, when);
    c.exponentialRampToValueAtTime(Math.max(0.0006, base), when + decay);
  }
}

let modulePromise: Promise<boolean> | null = null;

/** Try to build a worklet-based Bassline filter. Returns null on any failure (caller falls back to Biquad). */
export async function createWorkletBasslineFilter(ctx: BaseAudioContext): Promise<BasslineFilter | null> {
  try {
    if (!('audioWorklet' in ctx)) return null;
    if (!modulePromise) {
      const blob = new Blob([PROCESSOR_SRC], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      modulePromise = ctx.audioWorklet
        .addModule(url)
        .then(() => true)
        .catch(() => false)
        .finally(() => URL.revokeObjectURL(url));
    }
    const ok = await modulePromise;
    if (!ok) return null;
    const node = new AudioWorkletNode(ctx as AudioContext, 'bassline-ladder', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
    });
    return new WorkletBasslineFilter(node);
  } catch {
    return null;
  }
}
