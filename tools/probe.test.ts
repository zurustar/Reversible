/**
 * Audio probe: renders the real synthesis offline, measures each slider's
 * effect, and (with PROBE_OUT=1) writes WAV + waveform/spectrum PNGs to
 * tools/out/. Run: npx vitest run -c tools/vitest.config.ts
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  renderBass, renderDrum, defaultBassline, analyze, noteHz,
  writeWav, writeWaveformPng, writeSpectrumPng, writeCompareGrid, type Analysis, type CompareRow,
} from './audio-lib';
import type { BasslineParams, DrumVoiceParams } from '../src/domain/types';
import type { DrumVoiceId } from '../src/domain/constants';

const OUT = process.env.PROBE_OUT ? 'tools/out' : '';

interface Metrics { rms: number; centroidHz: number; dominantHz: number; tailSec: number; bodyHz: number; lowHiRatio: number; }
function bandEnergy(a: Analysis, f0: number, f1: number): number {
  let s = 0;
  for (let k = Math.max(1, Math.floor(f0 / a.binHz)); k < Math.min(a.mag.length, Math.floor(f1 / a.binHz)); k++) s += a.mag[k];
  return s;
}
function peakHzIn(a: Analysis, f0: number, f1: number): number {
  let maxM = 0, maxK = Math.floor(f0 / a.binHz);
  for (let k = Math.max(1, Math.floor(f0 / a.binHz)); k < Math.min(a.mag.length, Math.floor(f1 / a.binHz)); k++) {
    if (a.mag[k] > maxM) { maxM = a.mag[k]; maxK = k; }
  }
  return maxK * a.binHz;
}
function metrics(a: Analysis, data: Float32Array, sr: number): Metrics {
  let lastLoud = 0;
  for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > 0.02) lastLoud = i;
  const low = bandEnergy(a, 40, 500);
  const hi = bandEnergy(a, 2500, 16000);
  return {
    rms: a.rms, centroidHz: a.centroidHz, dominantHz: a.dominantHz, tailSec: lastLoud / sr,
    bodyHz: peakHzIn(a, 60, 700), lowHiRatio: hi > 0 ? low / hi : 0,
  };
}
const pct = (lo: number, hi: number) => (lo === 0 ? (hi === 0 ? 0 : 999) : ((hi - lo) / Math.abs(lo)) * 100);

async function bassMetrics(p: Partial<BasslineParams>, note = 12, opts = {}): Promise<Metrics> {
  const r = await renderBass(defaultBassline(p), note, opts);
  return metrics(analyze(r), r.data, r.sr);
}
async function drumMetrics(id: DrumVoiceId, p: Partial<DrumVoiceParams>): Promise<Metrics> {
  const r = await renderDrum(id, p);
  return metrics(analyze(r, 0.005), r.data, r.sr);
}

describe('Bassline pitch correctness', () => {
  it('plays the requested note frequency', async () => {
    for (const note of [0, 12, 24]) {
      const r = await renderBass(defaultBassline({ cutoff: 0.8, resonance: 0.2 }), note);
      const a = analyze(r);
      const expected = noteHz(note);
      // dominant partial should be at or an octave-related multiple of the fundamental
      const ratio = a.dominantHz / expected;
      const near = [0.5, 1, 2, 3].some((m) => Math.abs(ratio - m) < 0.08);
      // eslint-disable-next-line no-console
      console.log(`note ${note}: expected ${expected.toFixed(1)}Hz, dominant ${a.dominantHz.toFixed(1)}Hz`);
      expect(near).toBe(true);
    }
  });
});

describe('slider effectiveness (measured)', () => {
  it('reports the audible effect of each slider', async () => {
    const rows: string[] = [];
    const check = (name: string, m: keyof Metrics, lo: Metrics, hi: Metrics) => {
      const d = pct(lo[m], hi[m]);
      const verdict = Math.abs(d) < 3 ? 'NO CHANGE' : Math.abs(d) < 12 ? 'weak' : 'ok';
      rows.push(`${name.padEnd(28)} ${m.padEnd(11)} ${lo[m].toFixed(1).padStart(9)} ${hi[m].toFixed(1).padStart(9)} ${d.toFixed(1).padStart(8)}%  ${verdict}`);
    };

    // Bassline
    check('Bassline Cutoff', 'centroidHz', await bassMetrics({ cutoff: 0.1, envMod: 0.2 }), await bassMetrics({ cutoff: 0.9, envMod: 0.2 }));
    check('Bassline Resonance', 'centroidHz', await bassMetrics({ resonance: 0.0 }), await bassMetrics({ resonance: 1.0 }));
    check('Bassline EnvMod', 'centroidHz', await bassMetrics({ envMod: 0.0 }), await bassMetrics({ envMod: 1.0 }));
    check('Bassline Decay', 'tailSec', await bassMetrics({ decay: 0.0 }), await bassMetrics({ decay: 1.0 }));
    check('Bassline Drive', 'centroidHz', await bassMetrics({ drive: 0.0 }), await bassMetrics({ drive: 1.0 }));
    check('Bassline Volume', 'rms', await bassMetrics({ volume: 0.2 }), await bassMetrics({ volume: 1.0 }));
    check('Bassline Accent (no step accent)', 'rms', await bassMetrics({ accent: 0.0 }), await bassMetrics({ accent: 1.0 }));
    check('Bassline Accent (accented step)', 'rms',
      await bassMetrics({ accent: 0.0 }, 12, { accent: true }), await bassMetrics({ accent: 1.0 }, 12, { accent: true }));

    // drums
    check('BD Tone (analog)', 'centroidHz', await drumMetrics('bd', { tone: 0.0 }), await drumMetrics('bd', { tone: 1.0 }));
    check('BD Decay', 'tailSec', await drumMetrics('bd', { decay: 0.0 }), await drumMetrics('bd', { decay: 1.0 }));
    check('Snare Tone', 'bodyHz', await drumMetrics('sd', { tone: 0.0 }), await drumMetrics('sd', { tone: 1.0 }));
    check('Snare Snappy', 'lowHiRatio', await drumMetrics('sd', { snappy: 0.0 }), await drumMetrics('sd', { snappy: 1.0 }));
    check('Tom Tune (mt)', 'dominantHz', await drumMetrics('mt', { tune: 0.0 }), await drumMetrics('mt', { tune: 1.0 }));
    check('Cowbell Tune', 'dominantHz', await drumMetrics('cb', { tune: 0.0 }), await drumMetrics('cb', { tune: 1.0 }));
    check('Cymbal Tone', 'centroidHz', await drumMetrics('cy', { tone: 0.0 }), await drumMetrics('cy', { tone: 1.0 }));
    check('Cymbal Decay', 'tailSec', await drumMetrics('cy', { decay: 0.0 }), await drumMetrics('cy', { decay: 1.0 }));
    check('Closed Hat Decay', 'tailSec', await drumMetrics('ch', { decay: 0.0 }), await drumMetrics('ch', { decay: 1.0 }));
    check('Open Hat Decay', 'tailSec', await drumMetrics('oh', { decay: 0.0 }), await drumMetrics('oh', { decay: 1.0 }));

    const table =
      '=== Slider effect (low -> high) ===\n' +
      'name                         metric        low       high    delta   verdict\n' +
      rows.join('\n') + '\n';
    mkdirSync('tools/out', { recursive: true });
    writeFileSync('tools/out/metrics.txt', table);
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('visual compare (low vs high)', () => {
  it('writes side-by-side spectrum/waveform grids', async () => {
    if (!OUT) return;
    const b = (p: Partial<BasslineParams>, note = 12, opts = {}) => renderBass(defaultBassline(p), note, opts);
    const d = (id: DrumVoiceId, p: Partial<DrumVoiceParams>) => renderDrum(id, p);
    const row = async (
      label: string, mode: 'spectrum' | 'wave',
      lo: Promise<{ sr: number; data: Float32Array }>, hi: Promise<{ sr: number; data: Float32Array }>,
    ): Promise<CompareRow> => {
      const [L, H] = [await lo, await hi];
      return { label, mode, lowData: L.data, highData: H.data, lowA: analyze(L, 0.01), highA: analyze(H, 0.01) };
    };

    const bass: CompareRow[] = [
      await row('Bassline Cutoff', 'spectrum', b({ cutoff: 0.1, envMod: 0.2 }), b({ cutoff: 0.9, envMod: 0.2 })),
      await row('Bassline Resonance', 'spectrum', b({ resonance: 0 }), b({ resonance: 1 })),
      await row('Bassline EnvMod', 'spectrum', b({ envMod: 0 }), b({ envMod: 1 })),
      await row('Bassline Drive', 'spectrum', b({ drive: 0 }), b({ drive: 1 })),
      await row('Bassline Decay', 'wave', b({ decay: 0 }), b({ decay: 1 })),
      await row('Bassline Volume', 'wave', b({ volume: 0.2 }), b({ volume: 1 })),
      await row('Bassline Accent NO-flag', 'wave', b({ accent: 0 }), b({ accent: 1 })),
      await row('Bassline Accent WITH-flag', 'wave', b({ accent: 0 }, 12, { accent: true }), b({ accent: 1 }, 12, { accent: true })),
    ];
    writeCompareGrid(`${OUT}/cmp-Bassline.png`, bass);

    const drums: CompareRow[] = [
      await row('BD Tone', 'spectrum', d('bd', { tone: 0 }), d('bd', { tone: 1 })),
      await row('SD Tone', 'spectrum', d('sd', { tone: 0 }), d('sd', { tone: 1 })),
      await row('SD Snappy', 'spectrum', d('sd', { snappy: 0 }), d('sd', { snappy: 1 })),
      await row('CY Tone', 'spectrum', d('cy', { tone: 0 }), d('cy', { tone: 1 })),
      await row('CH Decay', 'wave', d('ch', { decay: 0 }), d('ch', { decay: 1 })),
      await row('Tom Tune', 'spectrum', d('mt', { tune: 0 }), d('mt', { tune: 1 })),
      await row('Cowbell Tune', 'spectrum', d('cb', { tune: 0 }), d('cb', { tune: 1 })),
    ];
    writeCompareGrid(`${OUT}/cmp-drums.png`, drums);
    expect(true).toBe(true);
  });
});

describe('artifacts', () => {
  it('writes WAV + PNGs when PROBE_OUT=1', async () => {
    if (!OUT) return;
    const cases: Array<[string, () => Promise<{ sr: number; data: Float32Array }>]> = [
      ['Bassline-C3-clean', () => renderBass(defaultBassline({ cutoff: 0.5, resonance: 0.6 }), 12)],
      ['Bassline-C3-drive', () => renderBass(defaultBassline({ cutoff: 0.5, resonance: 0.6, drive: 1 }), 12)],
      ['bd-analog', () => renderDrum('bd', {}, 'analog')],
      ['sd-analog', () => renderDrum('sd', {}, 'analog')],
      ['sd-digital', () => renderDrum('sd', {}, 'digital')],
      ['cowbell', () => renderDrum('cb', {})],
    ];
    for (const [name, fn] of cases) {
      const r = await fn();
      writeWav(`${OUT}/${name}.wav`, r);
      writeWaveformPng(`${OUT}/${name}.wave.png`, r);
      writeSpectrumPng(`${OUT}/${name}.spec.png`, analyze(r, 0.01));
    }
    // eslint-disable-next-line no-console
    console.log(`wrote artifacts to ${OUT}/`);
    expect(true).toBe(true);
  });
});
