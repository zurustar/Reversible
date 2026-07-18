/**
 * Offline audio verification toolkit (dev-only, not shipped).
 * Renders the real synthesis (BasslineVoice / DrumMachine) via an
 * OfflineAudioContext, then analyzes + writes WAV / waveform / spectrum PNGs so
 * sound-related changes can be verified without listening.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { OfflineAudioContext } from 'node-web-audio-api';
import { PNG } from 'pngjs';
import { BasslineVoice } from '../src/audio/bassline';
import { DrumMachine } from '../src/audio/drums';
import { createDrumTrack } from '../src/domain/factories';
import { DRUM_VOICE_IDS, type DrumVoiceId, type DrumStyle } from '../src/domain/constants';
import type { BasslineParams, DrumVoiceParams } from '../src/domain/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rendered = { sr: number; data: Float32Array };

const SR = 44100;

export function defaultBassline(overrides: Partial<BasslineParams> = {}): BasslineParams {
  return {
    waveform: 'saw', tune: 0.5, cutoff: 0.45, resonance: 0.5, envMod: 0.5,
    decay: 0.4, accent: 0.6, volume: 0.9, drive: 0, slideTime: 0.4, ...overrides,
  };
}

export async function renderBass(
  params: BasslineParams,
  note: number,
  opts: { accent?: boolean; slide?: boolean; dur?: number; prevNote?: number } = {},
): Promise<Rendered> {
  const dur = opts.dur ?? 0.6;
  const ctx = new OfflineAudioContext(1, Math.floor(SR * dur), SR) as any;
  const voice = new BasslineVoice(ctx, params);
  voice.connect(ctx.destination);
  if (opts.slide && opts.prevNote !== undefined) {
    voice.trigger({ note: opts.prevNote }, 0.01);
    voice.trigger({ note, slide: true, accent: opts.accent }, 0.12);
  } else {
    voice.trigger({ note, accent: opts.accent }, 0.01);
  }
  const buf = await ctx.startRendering();
  return { sr: SR, data: buf.getChannelData(0) as Float32Array };
}

export function drumParamsRecord(
  voiceId: DrumVoiceId,
  overrides: Partial<DrumVoiceParams>,
): Record<DrumVoiceId, DrumVoiceParams> {
  const rec = {} as Record<DrumVoiceId, DrumVoiceParams>;
  const base = createDrumTrack().voices;
  for (const id of DRUM_VOICE_IDS) rec[id] = { ...base[id].params };
  rec[voiceId] = { ...rec[voiceId], ...overrides };
  return rec;
}

export async function renderDrum(
  voiceId: DrumVoiceId,
  overrides: Partial<DrumVoiceParams> = {},
  style: DrumStyle = 'analog',
  opts: { accent?: boolean; dur?: number } = {},
): Promise<Rendered> {
  const dur = opts.dur ?? 0.8;
  const ctx = new OfflineAudioContext(1, Math.floor(SR * dur), SR) as any;
  const machine = new DrumMachine(ctx, drumParamsRecord(voiceId, overrides), style);
  machine.connect(ctx.destination);
  machine.trigger({ voiceId, accent: opts.accent }, 0.02);
  const buf = await ctx.startRendering();
  return { sr: SR, data: buf.getChannelData(0) as Float32Array };
}

// ---------- analysis ----------

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1, cwi = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const vr = re[b] * cwr - im[b] * cwi;
        const vi = re[b] * cwi + im[b] * cwr;
        re[b] = re[a] - vr; im[b] = im[a] - vi;
        re[a] += vr; im[a] += vi;
        const ncwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr; cwr = ncwr;
      }
    }
  }
}

export interface Analysis {
  peak: number;
  rms: number;
  dominantHz: number;
  centroidHz: number;
  mag: Float64Array; // magnitude spectrum (0..N/2)
  binHz: number;
}

/** FFT analysis over a Hann-windowed segment starting near the onset. */
export function analyze(r: Rendered, startSec = 0.03, N = 16384): Analysis {
  const { data, sr } = r;
  let peak = 0, sumSq = 0;
  for (const x of data) { peak = Math.max(peak, Math.abs(x)); sumSq += x * x; }
  const rms = Math.sqrt(sumSq / data.length);

  const start = Math.min(Math.floor(startSec * sr), Math.max(0, data.length - N));
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const s = data[start + i] ?? 0;
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)); // Hann
    re[i] = s * w;
  }
  fft(re, im);
  const half = N >> 1;
  const mag = new Float64Array(half);
  let maxMag = 0, maxBin = 1, wsum = 0, magsum = 0;
  const binHz = sr / N;
  for (let k = 1; k < half; k++) {
    const m = Math.hypot(re[k], im[k]);
    mag[k] = m;
    if (m > maxMag) { maxMag = m; maxBin = k; }
    wsum += m * k * binHz;
    magsum += m;
  }
  return { peak, rms, dominantHz: maxBin * binHz, centroidHz: magsum > 0 ? wsum / magsum : 0, mag, binHz };
}

// ---------- outputs ----------

function ensureDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

export function writeWav(path: string, r: Rendered): void {
  ensureDir(path);
  const { data, sr } = r;
  const n = data.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  writeFileSync(path, buf);
}

function newImage(w: number, h: number, bg: [number, number, number]): PNG {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) {
    const o = i << 2;
    png.data[o] = bg[0]; png.data[o + 1] = bg[1]; png.data[o + 2] = bg[2]; png.data[o + 3] = 255;
  }
  return png;
}
function px(png: PNG, x: number, y: number, c: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const o = (png.width * y + x) << 2;
  png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255;
}

export function writeWaveformPng(path: string, r: Rendered, w = 900, h = 220): void {
  ensureDir(path);
  const png = newImage(w, h, [20, 20, 24]);
  const mid = h >> 1;
  for (let x = 0; x < w; x++) px(png, x, mid, [60, 60, 70]); // center line
  const per = r.data.length / w;
  for (let x = 0; x < w; x++) {
    let lo = 1, hi = -1;
    for (let i = Math.floor(x * per); i < Math.floor((x + 1) * per); i++) {
      const s = r.data[i] ?? 0; if (s < lo) lo = s; if (s > hi) hi = s;
    }
    const y0 = Math.round(mid - hi * (mid - 2));
    const y1 = Math.round(mid - lo * (mid - 2));
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) px(png, x, y, [255, 149, 0]);
  }
  writeFileSync(path, PNG.sync.write(png));
}

export function writeSpectrumPng(path: string, a: Analysis, fmax = 6000, w = 900, h = 240): void {
  ensureDir(path);
  const png = newImage(w, h, [20, 20, 24]);
  const bins = Math.min(a.mag.length, Math.floor(fmax / a.binHz));
  let maxM = 1e-9;
  for (let k = 1; k < bins; k++) maxM = Math.max(maxM, a.mag[k]);
  for (let x = 0; x < w; x++) {
    const k = Math.max(1, Math.floor((x / w) * bins));
    const db = 20 * Math.log10((a.mag[k] || 1e-9) / maxM); // -inf..0
    const norm = Math.max(0, (db + 60) / 60); // -60dB..0 -> 0..1
    const barH = Math.round(norm * (h - 10));
    for (let y = h - 1; y >= h - barH; y--) px(png, x, y, [90, 200, 255]);
  }
  // freq gridlines every 1kHz
  for (let f = 1000; f < fmax; f += 1000) {
    const x = Math.round((f / fmax) * w);
    for (let y = 0; y < h; y += 3) px(png, x, y, [55, 55, 65]);
  }
  writeFileSync(path, PNG.sync.write(png));
}

export function noteHz(note: number): number {
  return 440 * Math.pow(2, (36 + note - 69) / 12);
}

// ---------- side-by-side comparison grids (low vs high) ----------

function drawSpectrumInto(png: PNG, x0: number, y0: number, w: number, h: number, a: Analysis, maxM: number, fmax: number, color: [number, number, number]): void {
  const bins = Math.min(a.mag.length, Math.floor(fmax / a.binHz));
  for (let dx = 0; dx < w; dx++) {
    const k = Math.max(1, Math.floor((dx / w) * bins));
    const db = 20 * Math.log10((a.mag[k] || 1e-9) / (maxM || 1e-9));
    const norm = Math.max(0, (db + 60) / 60);
    const barH = Math.round(norm * (h - 4));
    for (let dy = 0; dy < barH; dy++) px(png, x0 + dx, y0 + h - 1 - dy, color);
  }
}

function drawWaveInto(png: PNG, x0: number, y0: number, w: number, h: number, data: Float32Array, color: [number, number, number]): void {
  const mid = y0 + (h >> 1);
  for (let dx = 0; dx < w; dx++) px(png, x0 + dx, mid, [55, 55, 65]);
  const per = data.length / w;
  for (let dx = 0; dx < w; dx++) {
    let lo = 1, hi = -1;
    for (let i = Math.floor(dx * per); i < Math.floor((dx + 1) * per); i++) {
      const s = data[i] ?? 0; if (s < lo) lo = s; if (s > hi) hi = s;
    }
    const yhi = Math.round(mid - hi * ((h >> 1) - 2));
    const ylo = Math.round(mid - lo * ((h >> 1) - 2));
    for (let y = Math.min(yhi, ylo); y <= Math.max(yhi, ylo); y++) px(png, x0 + dx, y, color);
  }
}

export interface CompareRow {
  label: string;
  lowData: Float32Array;
  highData: Float32Array;
  lowA: Analysis;
  highA: Analysis;
  mode: 'spectrum' | 'wave';
}

/** Stacked rows; each row = low (left half) vs high (right half). Reveals change at a glance. */
export function writeCompareGrid(path: string, rows: CompareRow[], w = 880, rowH = 120, fmax = 6000): void {
  ensureDir(path);
  const gap = 14;
  const png = newImage(w, rows.length * (rowH + gap) + 6, [18, 18, 22]);
  const halfW = (w >> 1) - 6;
  rows.forEach((row, i) => {
    const y0 = 6 + i * (rowH + gap);
    // divider between low|high
    for (let y = y0; y < y0 + rowH; y++) px(png, w >> 1, y, [90, 90, 100]);
    if (row.mode === 'spectrum') {
      const maxM = Math.max(...row.lowA.mag.slice(1, Math.floor(fmax / row.lowA.binHz)), ...row.highA.mag.slice(1, Math.floor(fmax / row.highA.binHz)), 1e-9);
      drawSpectrumInto(png, 2, y0, halfW, rowH, row.lowA, maxM, fmax, [130, 130, 140]); // low = grey
      drawSpectrumInto(png, (w >> 1) + 4, y0, halfW, rowH, row.highA, maxM, fmax, [255, 149, 0]); // high = orange
    } else {
      drawWaveInto(png, 2, y0, halfW, rowH, row.lowData, [130, 130, 140]);
      drawWaveInto(png, (w >> 1) + 4, y0, halfW, rowH, row.highData, [255, 149, 0]);
    }
  });
  writeFileSync(path, PNG.sync.write(png));
}
