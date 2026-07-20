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

/**
 * Default/center detent for sliders: when `enabled`, snap `value` to `def` if it
 * lands within `eps` of it, so a fader "catches" its default position (e.g. Tune
 * back to 0 cents). When disabled, the value passes through unchanged — exact
 * resets are handled separately (double-click).
 */
export function applyDetent(value: number, def: number, enabled: boolean, eps = 0.02): number {
  if (!enabled) return value;
  return Math.abs(value - def) <= eps ? def : value;
}
