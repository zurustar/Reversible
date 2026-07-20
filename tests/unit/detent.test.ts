import { describe, it, expect } from 'vitest';
import { applyDetent } from '../../src/util/num';

describe('applyDetent (slider default/center detent)', () => {
  it('snaps to default when within eps (enabled)', () => {
    expect(applyDetent(0.51, 0.5, true)).toBe(0.5);
    expect(applyDetent(0.49, 0.5, true)).toBe(0.5);
    expect(applyDetent(0.5, 0.5, true)).toBe(0.5);
  });

  it('leaves values outside eps unchanged', () => {
    expect(applyDetent(0.55, 0.5, true)).toBe(0.55);
    expect(applyDetent(0.4, 0.5, true)).toBe(0.4);
  });

  it('passes through unchanged when disabled', () => {
    expect(applyDetent(0.5, 0.5, false)).toBe(0.5);
    expect(applyDetent(0.505, 0.5, false)).toBe(0.505);
  });

  it('detents toward a non-center default too', () => {
    expect(applyDetent(0.795, 0.8, true)).toBe(0.8);
    expect(applyDetent(0.7, 0.8, true)).toBe(0.7);
  });

  it('respects a custom eps', () => {
    expect(applyDetent(0.53, 0.5, true, 0.05)).toBe(0.5);
    expect(applyDetent(0.53, 0.5, true, 0.01)).toBe(0.53);
  });
});
