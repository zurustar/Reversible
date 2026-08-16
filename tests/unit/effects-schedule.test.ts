/**
 * エフェクト設定はパターン単位なので、FxChain は「指定時刻に切り替わる」必要がある
 * (オフラインレンダリングは currentTime が進まないため、即時適用では曲全体に効いてしまう)。
 * 実際にレンダリングして、切替時刻の前後で音が変わることを検証する。
 */
import { describe, it, expect } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import { FxChain } from '../../src/audio/effects';
import { createDefaultEffects } from '../../src/domain/factories';
import type { EffectsParams } from '../../src/domain/types';

const SR = 44100;
const SWITCH_SEC = 0.5;
const DUR = 1;

function rms(data: Float32Array, fromSec: number, toSec: number): number {
  const from = Math.floor(fromSec * SR);
  const to = Math.floor(toSec * SR);
  let sum = 0;
  for (let i = from; i < to; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / (to - from));
}

/** Render a steady tone through an FxChain that switches settings at SWITCH_SEC. */
async function renderSwitch(first: EffectsParams, second: EffectsParams): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, SR * DUR, SR) as unknown as OfflineAudioContext;
  const fx = new FxChain(ctx);
  fx.connect(ctx.destination);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 200;
  const gain = ctx.createGain();
  gain.gain.value = 0.5;
  osc.connect(gain).connect(fx.input);
  osc.start(0);
  fx.apply(first, 0);
  fx.apply(second, SWITCH_SEC);
  const buf = await ctx.startRendering();
  return buf.getChannelData(0) as unknown as Float32Array;
}

const withDistortion = (): EffectsParams => {
  const fx = createDefaultEffects();
  return { ...fx, distortion: { on: true, amount: 1 } };
};

describe('FxChain.apply(fx, when)', () => {
  it('switches distortion at the scheduled time, not for the whole render', async () => {
    const data = await renderSwitch(createDefaultEffects(), withDistortion());
    const clean = rms(data, 0.1, 0.4);
    const dirty = rms(data, 0.6, 0.9);
    // Hard clipping a 0.5-amplitude sine raises the level substantially.
    expect(clean).toBeGreaterThan(0);
    expect(dirty).toBeGreaterThan(clean * 1.3);
  });

  it('is symmetric: switching distortion off only affects the later part', async () => {
    const data = await renderSwitch(withDistortion(), createDefaultEffects());
    expect(rms(data, 0.1, 0.4)).toBeGreaterThan(rms(data, 0.6, 0.9) * 1.3);
  });

  it('re-applying the same settings object is a no-op (safe to call every step)', async () => {
    const same = withDistortion();
    const data = await renderSwitch(same, same);
    expect(rms(data, 0.1, 0.4)).toBeCloseTo(rms(data, 0.6, 0.9), 2);
  });
});
