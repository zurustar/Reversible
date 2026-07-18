/** PBT-03: parameter maps stay within range for ANY input (US-09 GWT-3). */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { cutoffToHz, resonanceToQ, decayToSeconds, tuneToCents, levelToGain } from '../../src/audio/param-maps';

const anyNumber = fc.double({ noNaN: false, min: -1e6, max: 1e6 });

describe('param-maps range invariants (PBT-03)', () => {
  it('cutoffToHz in [30, 12000]', () => {
    fc.assert(fc.property(anyNumber, (v) => {
      const hz = cutoffToHz(v);
      expect(hz).toBeGreaterThanOrEqual(30);
      expect(hz).toBeLessThanOrEqual(12000 + 1e-6);
    }));
  });

  it('resonanceToQ in [0.5, 20]', () => {
    fc.assert(fc.property(anyNumber, (v) => {
      const q = resonanceToQ(v);
      expect(q).toBeGreaterThanOrEqual(0.5);
      expect(q).toBeLessThanOrEqual(20);
    }));
  });

  it('decayToSeconds in [0.03, 1.5]', () => {
    fc.assert(fc.property(anyNumber, (v) => {
      const d = decayToSeconds(v);
      expect(d).toBeGreaterThanOrEqual(0.03);
      expect(d).toBeLessThanOrEqual(1.5);
    }));
  });

  it('tuneToCents in [-1200, 1200]', () => {
    fc.assert(fc.property(anyNumber, (v) => {
      const c = tuneToCents(v);
      expect(c).toBeGreaterThanOrEqual(-1200);
      expect(c).toBeLessThanOrEqual(1200);
    }));
  });

  it('levelToGain in [0, 1]', () => {
    fc.assert(fc.property(anyNumber, (v) => {
      const g = levelToGain(v);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }));
  });
});
