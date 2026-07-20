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
  /** Format the raw 0..1 value for the readout shown while dragging/hovering. Defaults to percent. */
  format?: (v: number) => string;
}

/**
 * A 0..1 range fader. To make "return to the right spot" easy without adding
 * visible chrome (see UX note), the fader also:
 *  - shows its current value in the label while focused / hovered / dragging,
 *  - snaps to its default when dragged near it (center detent, opt-in via `snap`),
 *  - resets to its default on double-click / double-tap.
 * The idle appearance (just the label name) is unchanged from a plain fader.
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

  let hovering = false;
  const showValue = (): void => {
    labelSpan.textContent = fmt(Number(input.value));
    labelSpan.classList.add('is-value');
  };
  const showName = (): void => {
    labelSpan.textContent = label;
    labelSpan.classList.remove('is-value');
  };
  const idle = (): void => {
    if (!hovering && document.activeElement !== input) showName();
  };

  input.addEventListener('input', () => {
    const snapped = applyDetent(Number(input.value), def, snap);
    if (snapped !== Number(input.value)) input.value = String(snapped);
    onInput(snapped);
    showValue();
  });
  input.addEventListener('dblclick', () => {
    input.value = String(def);
    onInput(def);
    showValue();
  });
  input.addEventListener('focus', showValue);
  input.addEventListener('blur', idle);
  input.addEventListener('mouseenter', () => {
    hovering = true;
    showValue();
  });
  input.addEventListener('mouseleave', () => {
    hovering = false;
    idle();
  });

  const wrap = el('label', { class: 'ctl' }, [labelSpan, input]);
  return { wrap, input };
}
