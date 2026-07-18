/** Effects section: distortion / delay / PCF / compressor (master bus). */
import { el, slider } from './dom';
import type { UiContext, ViewHandle } from './context';
import type { EffectName } from '../state/actions';

interface FxDef {
  name: EffectName;
  label: string;
  params: Array<{ key: string; label: string }>;
}

const FX: FxDef[] = [
  { name: 'distortion', label: 'Distortion', params: [{ key: 'amount', label: 'Amount' }] },
  {
    name: 'delay',
    label: 'Delay',
    params: [
      { key: 'time', label: 'Time' },
      { key: 'feedback', label: 'Feedback' },
      { key: 'mix', label: 'Mix' },
    ],
  },
  {
    name: 'pcf',
    label: 'PCF (Pattern Filter)',
    params: [
      { key: 'rate', label: 'Rate' },
      { key: 'depth', label: 'Depth' },
      { key: 'cutoff', label: 'Cutoff' },
      { key: 'resonance', label: 'Resonance' },
    ],
  },
  { name: 'compressor', label: 'Compressor', params: [{ key: 'amount', label: 'Amount' }] },
];

export function createEffectsSection(ctx: UiContext): ViewHandle {
  const toggles = new Map<EffectName, HTMLButtonElement>();
  const sliders = new Map<string, HTMLInputElement>(); // `${name}.${key}`

  const blocks: HTMLElement[] = FX.map((fx) => {
    const toggle = el('button', {
      class: 'fx-toggle',
      text: fx.label,
      onclick: () => ctx.store.dispatch({ type: 'toggleEffect', effect: fx.name }),
    });
    toggles.set(fx.name, toggle);

    const controls = el('div', { class: 'controls' });
    for (const p of fx.params) {
      const { wrap, input } = slider(p.label, 0.5, (v) =>
        ctx.store.dispatch({ type: 'setEffectParam', effect: fx.name, key: p.key, value: v }),
      );
      sliders.set(`${fx.name}.${p.key}`, input);
      controls.append(wrap);
    }
    return el('div', { class: 'fx-block' }, [toggle, controls]);
  });

  const root = el('div', { class: 'panel' }, [el('h2', { text: 'Effects' }), ...blocks]);

  return {
    el: root,
    update(state) {
      const effects = state.song.effects;
      for (const fx of FX) {
        const group = effects[fx.name] as unknown as Record<string, number | boolean>;
        toggles.get(fx.name)!.classList.toggle('on', group.on === true);
        for (const p of fx.params) {
          const input = sliders.get(`${fx.name}.${p.key}`)!;
          if (document.activeElement !== input) input.value = String(group[p.key]);
        }
      }
    },
  };
}
