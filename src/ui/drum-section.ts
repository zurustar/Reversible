/** Drum machine section: per-voice controls (top) + step grid (bottom). */
import { el, slider, refreshSlider } from './dom';
import type { UiContext, ViewHandle } from './context';
import {
  STEP_COUNT,
  DRUM_VOICE_IDS,
  DRUM_VOICE_LABELS,
  DRUM_VOICE_CONTROLS,
  DRUM_MACHINE_LABELS,
  type DrumVoiceId,
} from '../domain/constants';
import type { DrumVoiceParams } from '../domain/types';
import { selectedPattern } from '../state/reducer';

export function createDrumSection(ctx: UiContext, machineIndex: number): ViewHandle {
  // --- Per-voice controls, analog style: vertical faders grouped per instrument,
  //     laid out left-to-right in a single row ---
  const paramInputs = new Map<string, HTMLInputElement>(); // `${voiceId}.${paramKey}`
  const controls = el('div', { class: 'drum-panel' });

  for (const id of DRUM_VOICE_IDS) {
    const faders = el('div', { class: 'drum-group-faders' });
    const specs: Array<{ key: keyof DrumVoiceParams; label: string; def: number }> = [
      { key: 'level', label: 'Level', def: 0.8 },
      ...DRUM_VOICE_CONTROLS[id].map((c) => ({ key: c.key, label: c.label, def: 0.5 })),
    ];
    for (const spec of specs) {
      const { wrap, input } = slider(spec.label, spec.def, (v) => ctx.sound.setDrumParam(machineIndex, id, spec.key, v));
      paramInputs.set(`${id}.${spec.key}`, input);
      faders.append(wrap);
    }
    // grow proportional to fader count so every fader ends up ~equal width across the row
    controls.append(
      el('div', { class: 'drum-voice-group', style: `flex: ${specs.length} 1 0` }, [
        faders,
        el('div', { class: 'drum-group-name', text: DRUM_VOICE_LABELS[id] }),
      ]),
    );
  }

  // --- Step grid (one row per voice) ---
  const drumButtons: Record<DrumVoiceId, HTMLButtonElement[]> = {} as Record<DrumVoiceId, HTMLButtonElement[]>;
  const rows: HTMLElement[] = [];
  for (const voiceId of DRUM_VOICE_IDS) {
    const buttons: HTMLButtonElement[] = [];
    const cells = el('div', { class: 'steps' });
    for (let i = 0; i < STEP_COUNT; i++) {
      const b = el('button', {
        class: 'step',
        title: 'クリック: オフ → オン → アクセント',
        onclick: () => ctx.edit.cycleDrumStep(machineIndex, voiceId, i),
      });
      buttons.push(b);
      cells.append(b);
    }
    drumButtons[voiceId] = buttons;
    rows.push(el('div', { class: 'grid-row' }, [el('div', { class: 'row-label', text: DRUM_VOICE_LABELS[voiceId] }), cells]));
  }

  const root = el('div', { class: 'panel' }, [
    el('h2', { text: DRUM_MACHINE_LABELS[machineIndex] ?? `Drum Machine ${machineIndex + 1}` }),
    controls,
    el('div', { class: 'divider' }),
    ...rows,
  ]);

  return {
    el: root,
    update(state) {
      const pattern = selectedPattern(state);
      const machine = pattern.drums[machineIndex];
      const playhead = state.playing ? state.currentStep : -1;
      for (const id of DRUM_VOICE_IDS) {
        const params = machine.voices[id].params as unknown as Record<string, number | undefined>;
        for (const [mapKey, input] of paramInputs) {
          if (!mapKey.startsWith(`${id}.`)) continue;
          const key = mapKey.slice(id.length + 1);
          if (document.activeElement !== input) {
            input.value = String(params[key] ?? 0.5);
            refreshSlider(input);
          }
        }
        const steps = machine.voices[id].steps;
        drumButtons[id].forEach((btn, i) => {
          btn.classList.toggle('on', steps[i].on);
          btn.classList.toggle('accent', steps[i].on && steps[i].accent === true);
          btn.classList.toggle('playhead', i === playhead);
        });
      }
    },
  };
}
