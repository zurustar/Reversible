import { el } from './dom';
import type { UiContext, ViewHandle } from './context';
import { BPM_MIN, BPM_MAX } from '../domain/constants';
import { selectedPattern } from '../state/reducer';

// BPM / Swing belong to the pattern (like the sound settings), so these edit the
// selected pattern and the chain can change tempo from bar to bar.
const PER_PATTERN_HINT = '選択中のパターンの設定(パターンごとに変えられます)';

export function createTransportView(ctx: UiContext): ViewHandle {
  const playBtn = el('button', { class: 'primary', text: 'Play', onclick: () => ctx.transport.toggle() });
  const bpmInput = el('input', {
    type: 'number',
    min: String(BPM_MIN),
    max: String(BPM_MAX),
    value: '120',
    title: PER_PATTERN_HINT,
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
    title: `Swing / Shuffle — ${PER_PATTERN_HINT}`,
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
      const pattern = selectedPattern(state);
      if (document.activeElement !== bpmInput) bpmInput.value = String(Math.round(pattern.bpm));
      if (document.activeElement !== nameInput) nameInput.value = state.song.name;
      if (document.activeElement !== swingInput) swingInput.value = String(pattern.swing);
      swingVal.textContent = `${Math.round(pattern.swing * 100)}%`;
    },
  };
}
