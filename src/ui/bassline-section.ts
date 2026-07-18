/** Bassline section: sound controls (top) + its sequencer / piano roll (bottom). */
import { el, slider } from './dom';
import type { UiContext, ViewHandle } from './context';
import { pitchClassName } from './context';
import { STEP_COUNT, OCTAVE_BANDS, DEFAULT_OCTAVE_BAND, BASSLINE_LABELS } from '../domain/constants';
import type { BasslineParams } from '../domain/types';
import { selectedPattern } from '../state/reducer';

const PITCH_CLASSES = 12;
// octave shown as an arrow (accessible, not color-only): low = down, mid = dot, high = up
const OCT_LABELS = ['↓', '·', '↑'];
const OCT_GLYPH = ['↓', '', '↑']; // glyph drawn inside the lit note cell (mid = none)
const KNOBS: Array<{ key: keyof BasslineParams; label: string; def: number }> = [
  { key: 'tune', label: 'Tune', def: 0.5 },
  { key: 'cutoff', label: 'Cutoff', def: 0.45 },
  { key: 'resonance', label: 'Resonance', def: 0.5 },
  { key: 'envMod', label: 'Env Mod', def: 0.5 },
  { key: 'decay', label: 'Decay', def: 0.4 },
  { key: 'accent', label: 'Accent', def: 0.6 },
  { key: 'drive', label: 'Drive', def: 0 },
  { key: 'slideTime', label: 'Slide', def: 0.4 },
  { key: 'volume', label: 'Volume', def: 0.8 },
];

const bandOf = (note: number): number => Math.floor(note / 12);
const pcOf = (note: number): number => ((note % 12) + 12) % 12;

export function createBasslineSection(ctx: UiContext, trackIndex: number): ViewHandle {
  // --- Sound controls ---
  const inputs = new Map<keyof BasslineParams, HTMLInputElement>();
  const wave = el('select', { class: 'wave' }, [
    el('option', { value: 'saw', text: 'Sawtooth' }),
    el('option', { value: 'square', text: 'Square' }),
  ]) as HTMLSelectElement;
  wave.addEventListener('change', () => ctx.sound.setBasslineParam(trackIndex, 'waveform', wave.value as 'saw' | 'square'));

  const controls = el('div', { class: 'controls bassline-controls' }, [
    el('label', { class: 'ctl' }, [el('span', { class: 'ctl-label', text: 'Waveform' }), wave]),
  ]);
  for (const knob of KNOBS) {
    const { wrap, input } = slider(knob.label, knob.def, (v) => ctx.sound.setBasslineParam(trackIndex, knob.key, v));
    inputs.set(knob.key, input);
    controls.append(wrap);
  }

  // --- Piano roll (rows = pitch class B..C) ---
  const prCells: HTMLButtonElement[][] = Array.from({ length: PITCH_CLASSES }, () => []);
  const pianoRoll = el('div', { class: 'piano-roll' });
  for (let pc = PITCH_CLASSES - 1; pc >= 0; pc--) {
    const name = pitchClassName(pc);
    const cellsWrap = el('div', { class: 'pr-cells' });
    for (let step = 0; step < STEP_COUNT; step++) {
      const cell = el('button', { class: 'pr-cell', onclick: () => onCellClick(pc, step) });
      prCells[pc][step] = cell;
      cellsWrap.append(cell);
    }
    pianoRoll.append(
      el('div', { class: `pr-row${name.includes('#') ? ' sharp' : ''}` }, [
        el('div', { class: 'pr-key', text: name }),
        cellsWrap,
      ]),
    );
  }

  function onCellClick(pc: number, step: number): void {
    const s = selectedPattern(ctx.store.getState()).bassline[trackIndex].steps[step];
    if (s.on && pcOf(s.note) === pc) ctx.edit.setBasslineStep(trackIndex, step, { on: false });
    else {
      const band = s.on ? bandOf(s.note) : DEFAULT_OCTAVE_BAND;
      ctx.edit.setBasslineStep(trackIndex, step, { on: true, note: pc + 12 * band });
    }
  }

  // --- Oct / Accent / Slide rows ---
  const octBtns: HTMLButtonElement[] = [];
  const octCells = el('div', { class: 'pr-flag-cells' });
  for (let i = 0; i < STEP_COUNT; i++) {
    const b = el('button', {
      class: 'pr-flag oct',
      onclick: () => {
        const s = selectedPattern(ctx.store.getState()).bassline[trackIndex].steps[i];
        if (!s.on) return;
        const next = (bandOf(s.note) + 1) % OCTAVE_BANDS;
        ctx.edit.setBasslineStep(trackIndex, i, { note: pcOf(s.note) + 12 * next });
      },
    });
    octBtns.push(b);
    octCells.append(b);
  }
  const octRow = el('div', { class: 'pr-flag-row' }, [el('div', { class: 'pr-key', text: 'Oct' }), octCells]);

  const accentBtns: HTMLButtonElement[] = [];
  const slideBtns: HTMLButtonElement[] = [];
  function flagRow(label: string, btns: HTMLButtonElement[], onClick: (i: number) => void): HTMLElement {
    const cells = el('div', { class: 'pr-flag-cells' });
    for (let i = 0; i < STEP_COUNT; i++) {
      const b = el('button', { class: 'pr-flag', text: label[0], onclick: () => onClick(i) });
      btns.push(b);
      cells.append(b);
    }
    return el('div', { class: 'pr-flag-row' }, [el('div', { class: 'pr-key', text: label }), cells]);
  }
  const accentRow = flagRow('Accent', accentBtns, (i) => {
    const s = selectedPattern(ctx.store.getState()).bassline[trackIndex].steps[i];
    ctx.edit.setBasslineStep(trackIndex, i, { accent: !s.accent });
  });
  const slideRow = flagRow('Slide', slideBtns, (i) => {
    const s = selectedPattern(ctx.store.getState()).bassline[trackIndex].steps[i];
    ctx.edit.setBasslineStep(trackIndex, i, { slide: !s.slide });
  });

  const legend = el('div', { class: 'oct-legend' }, [
    document.createTextNode('オクターブ: '),
    el('span', { class: 'chip oct-2', text: '↑ 高' }),
    el('span', { class: 'chip oct-1', text: '· 中' }),
    el('span', { class: 'chip oct-0', text: '↓ 低' }),
    el('span', { text: '  ▶=次へスライド  ' }),
    el('span', { class: 'accent-hint', text: 'アクセント=枠が光る' }),
  ]);

  const root = el('div', { class: 'panel' }, [
    el('h2', { text: BASSLINE_LABELS[trackIndex] ?? `Bassline #${trackIndex + 1}` }),
    controls,
    el('div', { class: 'divider' }),
    legend,
    pianoRoll,
    octRow,
    accentRow,
    slideRow,
  ]);

  let prevPlayhead = -1;

  return {
    el: root,
    update(state) {
      const pattern = selectedPattern(state);
      const p = pattern.bassline[trackIndex].params;
      if (document.activeElement !== wave) wave.value = p.waveform;
      for (const [key, input] of inputs) {
        if (document.activeElement !== input) {
          const v = p[key];
          input.value = String(typeof v === 'number' ? v : (KNOBS.find((k) => k.key === key)?.def ?? 0.5));
        }
      }

      const playhead = state.playing ? state.currentStep : -1;
      const steps = pattern.bassline[trackIndex].steps;
      for (let step = 0; step < STEP_COUNT; step++) {
        const s = steps[step];
        const litPc = s.on ? pcOf(s.note) : -1;
        const band = s.on ? bandOf(s.note) : -1;
        for (let pc = 0; pc < PITCH_CLASSES; pc++) {
          const cell = prCells[pc][step];
          const lit = pc === litPc;
          cell.classList.toggle('on', lit);
          cell.classList.toggle('oct-0', lit && band === 0);
          cell.classList.toggle('oct-1', lit && band === 1);
          cell.classList.toggle('oct-2', lit && band === 2);
          cell.classList.toggle('accent', lit && s.accent);
          cell.classList.toggle('slide', lit && s.slide);
          cell.textContent = lit ? OCT_GLYPH[band] ?? '' : '';
        }
        const oct = octBtns[step];
        oct.textContent = s.on ? OCT_LABELS[band] : '·';
        oct.classList.toggle('on', s.on);
        oct.classList.toggle('oct-0', s.on && band === 0);
        oct.classList.toggle('oct-1', s.on && band === 1);
        oct.classList.toggle('oct-2', s.on && band === 2);
        accentBtns[step].classList.toggle('active', s.accent);
        slideBtns[step].classList.toggle('active', s.slide);
      }

      if (playhead !== prevPlayhead) {
        for (const col of [prevPlayhead, playhead]) {
          if (col < 0) continue;
          const on = col === playhead;
          for (let pc = 0; pc < PITCH_CLASSES; pc++) prCells[pc][col].classList.toggle('playcol', on);
          octBtns[col].classList.toggle('playcol', on);
          accentBtns[col].classList.toggle('playcol', on);
          slideBtns[col].classList.toggle('playcol', on);
        }
        prevPlayhead = playhead;
      }
    },
  };
}
