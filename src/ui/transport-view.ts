import { el } from './dom';
import type { UiContext, ViewHandle } from './context';
import { BPM_MIN, BPM_MAX } from '../domain/constants';

export function createTransportView(ctx: UiContext): ViewHandle {
  const playBtn = el('button', { class: 'primary', text: 'Play', onclick: () => ctx.transport.toggle() });
  const bpmInput = el('input', {
    type: 'number',
    min: String(BPM_MIN),
    max: String(BPM_MAX),
    value: '120',
    onchange: (e: Event) => ctx.transport.setBpm(Number((e.target as HTMLInputElement).value)),
  });
  const nameInput = el('input', {
    type: 'text',
    value: 'Untitled',
    onchange: (e: Event) => ctx.store.dispatch({ type: 'setName', name: (e.target as HTMLInputElement).value }),
  });
  const swingInput = el('input', {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
    value: '0',
    title: 'Swing / Shuffle',
    oninput: (e: Event) => ctx.transport.setSwing(Number((e.target as HTMLInputElement).value)),
  });
  const swingVal = el('span', { class: 'swing-val', text: '0%' });

  const root = el('div', { class: 'panel' }, [
    el('div', { class: 'transport' }, [
      playBtn,
      el('div', { class: 'bpm' }, [el('span', { text: 'BPM' }), bpmInput]),
      el('div', { class: 'bpm' }, [el('span', { text: 'Swing' }), swingInput, swingVal]),
      el('div', { class: 'bpm' }, [el('span', { text: 'Name' }), nameInput]),
    ]),
  ]);

  return {
    el: root,
    update(state) {
      playBtn.textContent = state.playing ? 'Stop' : 'Play';
      playBtn.classList.toggle('playing', state.playing);
      if (document.activeElement !== bpmInput) bpmInput.value = String(Math.round(state.song.bpm));
      if (document.activeElement !== nameInput) nameInput.value = state.song.name;
      if (document.activeElement !== swingInput) swingInput.value = String(state.song.swing);
      swingVal.textContent = `${Math.round(state.song.swing * 100)}%`;
    },
  };
}
