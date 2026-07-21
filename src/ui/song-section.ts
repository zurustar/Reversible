/** Song section: pattern bank (add/dup/delete/select) + pattern-chain (song mode). */
import { el } from './dom';
import type { UiContext, ViewHandle } from './context';

export function createSongSection(ctx: UiContext): ViewHandle {
  const modeBtn = el('button', {
    onclick: () => ctx.store.dispatch({ type: 'setSongMode', on: !ctx.store.getState().songMode }),
  });

  const bank = el('div', { class: 'pattern-bank' });
  const chain = el('div', { class: 'chain' });

  const newBtn = el('button', { text: '+ New', onclick: () => ctx.store.dispatch({ type: 'addPattern' }) });
  const dupBtn = el('button', { text: 'Duplicate', onclick: () => ctx.store.dispatch({ type: 'duplicatePattern' }) });
  const delBtn = el('button', {
    text: 'Delete',
    onclick: () => {
      const state = ctx.store.getState();
      const id = state.selectedPatternId;
      const i = state.song.patterns.findIndex((p) => p.id === id);
      const label = `P${i + 1}`;
      // Guard against an accidental click (e.g. meaning to press Duplicate): confirm first.
      if (!window.confirm(`パターン ${label} を削除します。よろしいですか?\nこの操作は元に戻せません。`)) return;
      ctx.store.dispatch({ type: 'deletePattern', id });
    },
  });
  const addToChainBtn = el('button', {
    text: '+ Chain に追加',
    onclick: () => ctx.store.dispatch({ type: 'appendToChain', id: ctx.store.getState().selectedPatternId }),
  });

  const root = el('div', { class: 'panel' }, [
    el('h2', { text: 'Song / Patterns' }),
    el('div', { class: 'song-row' }, [el('span', { class: 'song-label', text: 'Mode' }), modeBtn]),
    el('div', { class: 'song-row' }, [el('span', { class: 'song-label', text: 'Patterns' }), bank, newBtn, dupBtn, delBtn]),
    el('div', { class: 'song-row' }, [el('span', { class: 'song-label', text: 'Chain' }), chain, addToChainBtn]),
  ]);

  function patternLabel(id: string, patterns: { id: string }[]): string {
    const i = patterns.findIndex((p) => p.id === id);
    return `P${i + 1}`;
  }

  return {
    el: root,
    update(state) {
      modeBtn.textContent = state.songMode ? 'Song ▶' : 'Pattern';
      modeBtn.className = state.songMode ? 'primary' : '';

      // pattern bank
      bank.replaceChildren();
      for (const p of state.song.patterns) {
        const b = el('button', {
          class: `pat${p.id === state.selectedPatternId ? ' on' : ''}`,
          text: patternLabel(p.id, state.song.patterns),
          onclick: () => ctx.store.dispatch({ type: 'selectPattern', id: p.id }),
        });
        bank.append(b);
      }

      // chain
      chain.replaceChildren();
      state.song.patternOrder.forEach((pid, i) => {
        const playing = state.songMode && state.playing && i === state.songPos;
        const chip = el('span', { class: `chain-chip${playing ? ' playing' : ''}` }, [
          document.createTextNode(patternLabel(pid, state.song.patterns)),
          el('button', {
            class: 'chip-x',
            text: '×',
            title: 'remove',
            onclick: () => ctx.store.dispatch({ type: 'removeChainAt', index: i }),
          }),
        ]);
        chain.append(chip);
      });
    },
  };
}
