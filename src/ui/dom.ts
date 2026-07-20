/** Tiny DOM helpers (no framework). */

type Attrs = Record<string, string | number | boolean | ((e: Event) => void)>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (typeof v === 'boolean') {
      if (v) node.setAttribute(k, '');
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const c of children) node.append(c);
  return node;
}

import { applyDetent } from '../util/num';

export interface SliderOptions {
  /** Value the fader returns to on double-click, and detents toward. Defaults to the initial `value`. */
  def?: number;
  /** Enable the center/default detent. Defaults to true when `def` is 0.5 (a natural center). */
  snap?: boolean;
  /** Format the raw 0..1 value for the always-visible readout. Defaults to a 0..100 number. */
  format?: (v: number) => string;
}

// Each fader carries its readout + formatter so refreshSlider() can resync the
// displayed number whenever code sets input.value directly (e.g. in update()).
const sliderMeta = new WeakMap<HTMLInputElement, { readout: HTMLElement; fmt: (v: number) => string }>();

/** Update a fader's always-visible number to match its current input.value. */
export function refreshSlider(input: HTMLInputElement): void {
  const m = sliderMeta.get(input);
  if (m) m.readout.textContent = m.fmt(Number(input.value));
}

/**
 * A 0..1 range fader with an always-visible value readout below it. To make
 * "return a control to the right spot" easy, the fader also:
 *  - snaps to its default when dragged near it (center detent, opt-in via `snap`),
 *  - resets to its default on double-click / double-tap.
 */
export function slider(
  label: string,
  value: number,
  onInput: (v: number) => void,
  opts: SliderOptions = {},
): { wrap: HTMLElement; input: HTMLInputElement } {
  const def = opts.def ?? value;
  const snap = opts.snap ?? def === 0.5;
  const fmt = opts.format ?? ((v: number) => String(Math.round(v * 100)));

  const labelSpan = el('span', { class: 'ctl-label', text: label });
  const input = el('input', {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
    value: String(value),
  });
  const readout = el('span', { class: 'ctl-value', text: fmt(value) });
  sliderMeta.set(input, { readout, fmt });

  input.addEventListener('input', () => {
    const snapped = applyDetent(Number(input.value), def, snap);
    if (snapped !== Number(input.value)) input.value = String(snapped);
    onInput(snapped);
    refreshSlider(input);
  });
  input.addEventListener('dblclick', () => {
    input.value = String(def);
    onInput(def);
    refreshSlider(input);
  });

  const wrap = el('label', { class: 'ctl' }, [labelSpan, input, readout]);
  return { wrap, input };
}
