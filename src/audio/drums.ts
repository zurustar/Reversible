/** Synthesized drum machine (U2, C-07). Minimal MVP voices: bd, sd, ch, oh, clap. */
import type { DrumVoiceParams, TriggerEvent } from '../domain/types';
import type { DrumVoiceId, DrumStyle } from '../domain/constants';
import { DRUM_VOICE_IDS } from '../domain/constants';
import type { Instrument } from './instrument';
import { clamp01 } from '../util/num';

function makeNoiseBuffer(ctx: BaseAudioContext, seconds = 1): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // Deterministic pseudo-noise (no Math.random dependency at import time)
  let seed = 12345;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x3fffffff) - 1;
  }
  return buf;
}

export class DrumMachine implements Instrument {
  private ctx: BaseAudioContext;
  private out: GainNode;
  private noise: AudioBuffer;
  private params: Record<DrumVoiceId, DrumVoiceParams>;
  private style: DrumStyle;

  constructor(ctx: BaseAudioContext, params: Record<DrumVoiceId, DrumVoiceParams>, style: DrumStyle = 'analog') {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.noise = makeNoiseBuffer(ctx);
    this.params = { ...params };
    this.style = style;
  }

  connect(destination: AudioNode): void {
    this.out.connect(destination);
  }

  getVoiceIds(): readonly string[] {
    return DRUM_VOICE_IDS;
  }

  setParam(): void {
    /* drum machine params are per-voice; see setVoiceParam */
  }

  setVoiceParam(voiceId: DrumVoiceId, key: keyof DrumVoiceParams, value: number): void {
    const p = this.params[voiceId];
    if (p) p[key] = clamp01(value);
  }

  trigger(event: TriggerEvent, when: number): void {
    const id = event.voiceId as DrumVoiceId | undefined;
    if (!id || !(id in this.params)) return;
    const accent = event.accent === true;
    switch (id) {
      case 'bd':
        this.bd(when, accent);
        break;
      case 'sd':
        this.sd(when, accent);
        break;
      case 'ch':
        this.hat(when, accent, false);
        break;
      case 'oh':
        this.hat(when, accent, true);
        break;
      case 'clap':
        this.clap(when, accent);
        break;
      case 'lt':
        this.tom(when, accent, 'lt', 90);
        break;
      case 'mt':
        this.tom(when, accent, 'mt', 130);
        break;
      case 'ht':
        this.tom(when, accent, 'ht', 190);
        break;
      case 'rs':
        this.rim(when, accent);
        break;
      case 'cb':
        this.cowbell(when, accent);
        break;
      case 'cy':
        this.cymbal(when, accent);
        break;
    }
  }

  private gainFor(id: DrumVoiceId, accent: boolean): number {
    const level = clamp01(this.params[id]?.level ?? 0.8);
    return level * (accent ? 1.3 : 1);
  }

  private bd(when: number, accent: boolean): void {
    const p = this.params.bd;
    const isDigital = this.style === 'digital';
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const startF = (isDigital ? 220 : 120) + (p.tune ?? 0.5) * 80;
    osc.frequency.setValueAtTime(startF, when);
    osc.frequency.exponentialRampToValueAtTime(isDigital ? 55 : 45, when + (isDigital ? 0.03 : 0.06));
    const decay = (isDigital ? 0.1 : 0.15) + (p.decay ?? 0.5) * (isDigital ? 0.25 : 0.4);
    g.gain.setValueAtTime(this.gainFor('bd', accent), when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(g).connect(this.out);
    osc.start(when);
    osc.stop(when + decay + 0.05);
    // Tone adds an attack click (digital has some inherently); more Tone = clickier/brighter.
    const clickAmt = (isDigital ? 0.3 : 0) + (p.tone ?? 0.5) * 0.4;
    if (clickAmt > 0.02) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noise;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1500;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(this.gainFor('bd', accent) * clickAmt, when);
      ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.02);
      n.connect(hp).connect(ng).connect(this.out);
      n.start(when);
      n.stop(when + 0.04);
    }
  }

  private sd(when: number, accent: boolean): void {
    const p = this.params.sd;
    const isDigital = this.style === 'digital';
    const snappy = p.snappy ?? 0.5; // more snappy = less tonal body, more noise "snap"
    const tone = p.tone ?? 0.5; // Tone drives the body pitch + noise brightness over a wide range
    // tonal body (Tone sweeps the pitch widely so it's clearly audible)
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime((isDigital ? 220 : 150) + tone * (isDigital ? 320 : 260), when);
    og.gain.setValueAtTime(this.gainFor('sd', accent) * (isDigital ? 0.4 : 0.5) * (1.7 - 1.5 * snappy), when);
    og.gain.exponentialRampToValueAtTime(0.0001, when + (isDigital ? 0.08 : 0.12));
    osc.connect(og).connect(this.out);
    osc.start(when);
    osc.stop(when + 0.15);
    // noise (Tone widens the highpass a lot; Snappy scales the noise burst strongly)
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = (isDigital ? 2000 : 800) + tone * 4500;
    const ng = this.ctx.createGain();
    const decay = (isDigital ? 0.16 : 0.1) + (p.decay ?? 0.5) * (isDigital ? 0.25 : 0.2);
    ng.gain.setValueAtTime(this.gainFor('sd', accent) * (isDigital ? 0.9 : 0.7) * (0.3 + 1.5 * snappy), when);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    n.connect(hp).connect(ng).connect(this.out);
    n.start(when);
    n.stop(when + decay + 0.05);
  }

  private hat(when: number, accent: boolean, open: boolean): void {
    const id: DrumVoiceId = open ? 'oh' : 'ch';
    const p = this.params[id];
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    // digital-style hats are more metallic (brighter highpass).
    const hpBase = this.style === 'digital' ? 8000 : 6000;
    hp.frequency.value = hpBase + (p.tone ?? 0.5) * 3000;
    const g = this.ctx.createGain();
    const decay = open ? 0.25 + (p.decay ?? 0.5) * 0.35 : 0.03 + (p.decay ?? 0.5) * 0.05;
    g.gain.setValueAtTime(this.gainFor(id, accent) * 0.6, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    n.connect(hp).connect(g).connect(this.out);
    n.start(when);
    n.stop(when + decay + 0.05);
  }

  private clap(when: number, accent: boolean): void {
    const p = this.params.clap;
    const isDigital = this.style === 'digital';
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = (isDigital ? 1400 : 1000) + (p.tone ?? 0.5) * 800;
    bp.Q.value = isDigital ? 3 : 5;
    bp.connect(this.out);
    // digital clap has an extra burst and a longer diffuse tail
    const offsets = isDigital ? [0, 0.008, 0.016, 0.024, 0.05] : [0, 0.01, 0.02, 0.03];
    offsets.forEach((off, idx) => {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noise;
      const g = this.ctx.createGain();
      const t = when + off;
      const tail = isDigital && idx === offsets.length - 1 ? 0.12 : 0.05;
      g.gain.setValueAtTime(this.gainFor('clap', accent) * 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + tail);
      n.connect(g).connect(bp);
      n.start(t);
      n.stop(t + tail + 0.03);
    });
  }

  private tom(when: number, accent: boolean, id: DrumVoiceId, baseHz: number): void {
    const p = this.params[id];
    const isDigital = this.style === 'digital';
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    // analog toms: pure boomy sine; digital toms: punchier (triangle) with a bit of noise attack
    osc.type = isDigital ? 'triangle' : 'sine';
    const start = baseHz * (0.9 + (p.tune ?? 0.5) * 0.6) * (isDigital ? 1.15 : 1);
    osc.frequency.setValueAtTime(start * 1.6, when);
    osc.frequency.exponentialRampToValueAtTime(start, when + (isDigital ? 0.04 : 0.06));
    const decay = (isDigital ? 0.14 : 0.2) + (p.decay ?? 0.5) * (isDigital ? 0.3 : 0.4);
    g.gain.setValueAtTime(this.gainFor(id, accent), when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(g).connect(this.out);
    osc.start(when);
    osc.stop(when + decay + 0.05);
    if (isDigital) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noise;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2000;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(this.gainFor(id, accent) * 0.25, when);
      ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
      n.connect(hp).connect(ng).connect(this.out);
      n.start(when);
      n.stop(when + 0.05);
    }
  }

  private rim(when: number, accent: boolean): void {
    const p = this.params.rs;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1700 + (p.tone ?? 0.5) * 400, when);
    const decay = 0.03 + (p.decay ?? 0.5) * 0.03;
    g.gain.setValueAtTime(this.gainFor('rs', accent) * 0.8, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(g).connect(this.out);
    osc.start(when);
    osc.stop(when + decay + 0.02);
  }

  private cowbell(when: number, accent: boolean): void {
    const p = this.params.cb;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2640;
    bp.Q.value = 2;
    const g = this.ctx.createGain();
    const decay = 0.15 + (p.decay ?? 0.5) * 0.3;
    g.gain.setValueAtTime(this.gainFor('cb', accent) * 0.6, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    bp.connect(g).connect(this.out);
    // classic analog cowbell: two square oscillators (~540 / ~800 Hz)
    const tune = 0.85 + (p.tune ?? 0.5) * 0.3;
    for (const f of [540, 800]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f * tune;
      osc.connect(bp);
      osc.start(when);
      osc.stop(when + decay + 0.02);
    }
  }

  private cymbal(when: number, accent: boolean): void {
    const p = this.params.cy;
    const isDigital = this.style === 'digital';
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = (isDigital ? 3000 : 4000) + (p.tone ?? 0.5) * 8500;
    const g = this.ctx.createGain();
    // digital crash: longer, fuller; analog cymbal: shorter, thinner
    const decay = (isDigital ? 0.9 : 0.4) + (p.decay ?? 0.5) * (isDigital ? 1.2 : 0.8);
    g.gain.setValueAtTime(this.gainFor('cy', accent) * 0.5, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    n.connect(hp).connect(g).connect(this.out);
    // digital adds a metallic band for more shimmer
    if (isDigital) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 9000;
      bp.Q.value = 0.7;
      n.connect(bp).connect(g);
    }
    n.start(when);
    n.stop(when + decay + 0.05);
  }
}
