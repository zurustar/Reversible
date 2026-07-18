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

export function slider(
  label: string,
  value: number,
  onInput: (v: number) => void,
): { wrap: HTMLElement; input: HTMLInputElement } {
  const input = el('input', {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
    value: String(value),
    oninput: (e: Event) => onInput(Number((e.target as HTMLInputElement).value)),
  });
  const wrap = el('label', { class: 'ctl' }, [el('span', { class: 'ctl-label', text: label }), input]);
  return { wrap, input };
}
