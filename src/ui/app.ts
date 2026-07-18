import { el } from './dom';
import type { UiContext, ViewHandle } from './context';
import { createTransportView } from './transport-view';
import { createSongSection } from './song-section';
import { createBasslineSection } from './bassline-section';
import { createDrumSection } from './drum-section';
import { createEffectsSection } from './effects-section';
import { createIoView } from './io-view';
import { BASSLINE_COUNT, DRUM_MACHINE_COUNT } from '../domain/constants';

export interface AppMeta {
  buildTime: string;
  filterKind: string;
  sampleRate: number;
}

export function mountApp(root: HTMLElement, ctx: UiContext, meta: AppMeta): void {
  const header = el('div', {}, [
    el('h1', {}, [document.createTextNode('Re'), el('span', { text: 'vers' }), document.createTextNode('ible')]),
    el('p', { class: 'tagline', text: 'acid groovebox — bassline synths + drum machines' }),
    el('p', {
      class: 'build-stamp',
      text: `build ${meta.buildTime} · Bassline filter: ${meta.filterKind} · ${meta.sampleRate}Hz`,
    }),
  ]);

  // Each instrument is a pair: sound controls on top, its sequencer below.
  const views: ViewHandle[] = [
    createTransportView(ctx),
    createSongSection(ctx),
    ...Array.from({ length: BASSLINE_COUNT }, (_, i) => createBasslineSection(ctx, i)),
    ...Array.from({ length: DRUM_MACHINE_COUNT }, (_, i) => createDrumSection(ctx, i)),
    createEffectsSection(ctx),
    createIoView(ctx),
  ];

  root.append(header);
  for (const v of views) root.append(v.el);

  ctx.store.subscribe((state) => {
    for (const v of views) v.update(state);
  });
}
