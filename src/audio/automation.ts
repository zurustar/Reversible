/** AudioParam automation helpers. */

/**
 * Cancel scheduled automation from `when` onward while KEEPING the curve up to
 * `when`. Using the raw `cancelScheduledValues(when)` erases a still-pending
 * ramp entirely (its end event is >= when), which retroactively freezes the
 * previous note's decay at its peak — so a note stops decaying and holds until
 * the next note, sounding like a double-hit. `cancelAndHoldAtTime` preserves the
 * decay up to `when`; we fall back to the raw cancel where it is unavailable.
 */
export function cancelAndHold(param: AudioParam, when: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(when);
  else param.cancelScheduledValues(when);
}

/**
 * Set a param now (`when` omitted — live edits) or exactly at `when` (scheduled).
 * Scheduling is what makes per-pattern settings work in the offline renderer: the
 * whole song is scheduled up front there, and `currentTime` never advances, so an
 * immediate `.value` write would apply to the entire render.
 */
export function setParamValue(param: AudioParam, value: number, when?: number): void {
  if (when === undefined) param.value = value;
  else param.setValueAtTime(value, when);
}
