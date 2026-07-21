import { describe, it, expect } from 'vitest';
import { audioBufferToWavBlob } from '../../src/audio/offline-render';

// Minimal stand-in for an AudioBuffer (only the fields the encoder reads).
function stubBuffer(samples: number[], sampleRate = 8000): AudioBuffer {
  const data = Float32Array.from(samples);
  return { sampleRate, length: data.length, numberOfChannels: 1, getChannelData: () => data } as unknown as AudioBuffer;
}

async function bytes(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

const ascii = (dv: DataView, o: number, n: number): string =>
  Array.from({ length: n }, (_, i) => String.fromCharCode(dv.getUint8(o + i))).join('');

describe('audioBufferToWavBlob', () => {
  it('writes a valid 16-bit mono PCM WAV header sized to the samples', async () => {
    const buf = stubBuffer([0, 0.5, -0.5, 1, -1], 8000);
    const blob = audioBufferToWavBlob(buf);
    expect(blob.type).toBe('audio/wav');
    const dv = await bytes(blob);
    expect(blob.size).toBe(44 + 5 * 2); // header + 5 samples * 2 bytes
    expect(ascii(dv, 0, 4)).toBe('RIFF');
    expect(ascii(dv, 8, 4)).toBe('WAVE');
    expect(ascii(dv, 12, 4)).toBe('fmt ');
    expect(dv.getUint16(20, true)).toBe(1); // PCM
    expect(dv.getUint16(22, true)).toBe(1); // mono
    expect(dv.getUint32(24, true)).toBe(8000); // sample rate
    expect(dv.getUint16(34, true)).toBe(16); // bits per sample
    expect(ascii(dv, 36, 4)).toBe('data');
    expect(dv.getUint32(40, true)).toBe(5 * 2);
  });

  it('encodes samples and clamps out-of-range values', async () => {
    const dv = await bytes(audioBufferToWavBlob(stubBuffer([0, 1, -1, 2, -2])));
    expect(dv.getInt16(44, true)).toBe(0);
    expect(dv.getInt16(46, true)).toBe(0x7fff); // +1 -> max
    expect(dv.getInt16(48, true)).toBe(-0x8000); // -1 -> min
    expect(dv.getInt16(50, true)).toBe(0x7fff); // +2 clamped to +1
    expect(dv.getInt16(52, true)).toBe(-0x8000); // -2 clamped to -1
  });
});
