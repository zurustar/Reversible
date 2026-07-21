/** BiquadFilter-based Bassline filter stage (MVP implementation of BasslineFilter). */
import type { BasslineFilter } from './instrument';
import { cutoffToHz, resonanceToQ, decayToSeconds, envModAmount, accentAmount } from './param-maps';
import { cancelAndHold } from './automation';

export class BiquadBasslineFilter implements BasslineFilter {
  readonly input: BiquadFilterNode;
  readonly output: BiquadFilterNode;

  constructor(ctx: BaseAudioContext) {
    this.input = ctx.createBiquadFilter();
    this.input.type = 'lowpass';
    this.output = this.input;
  }

  triggerEnvelope(
    when: number,
    opts: { cutoff: number; resonance: number; envMod: number; decay: number; accent: boolean; accentAmount: number },
  ): void {
    const f = this.input.frequency;
    const base = cutoffToHz(opts.cutoff);
    let depth = envModAmount(opts.envMod);
    if (opts.accent) depth = Math.min(1, depth + accentAmount(opts.accentAmount) * 0.6);
    const peak = Math.min(12000, base + depth * (12000 - base));
    const decay = decayToSeconds(opts.decay);

    this.input.Q.setValueAtTime(resonanceToQ(opts.resonance), when);
    cancelAndHold(f, when);
    f.setValueAtTime(peak, when);
    f.exponentialRampToValueAtTime(Math.max(30, base), when + decay);
  }
}
