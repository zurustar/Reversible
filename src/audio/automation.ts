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
