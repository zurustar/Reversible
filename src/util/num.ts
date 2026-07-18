/** Numeric helpers. NaN-safe clamping (SEC-15 fail-safe, PBT-03 range invariants). */

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Clamp to [0, 1]. */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** Round and clamp to an integer range. */
export function clampInt(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return clamp(Math.round(value), min, max);
}
