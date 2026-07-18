# Reversible

A browser-based **acid groovebox** — bassline synths plus drum machines with a 16-step sequencer.

## Features
- **Bassline synths (×2)**: saw/square osc → resonant low-pass filter, per-step note / accent / slide, drive, real-time tweaking.
- **Drum machines (×2, analog- and digital-voiced)**: 11 synthesized voices each (Bass Drum, Snare, 3 Toms, Rim, Clap, Cowbell, Cymbal, Closed/Open Hat) with per-voice controls.
- **16-step sequencer**: play/stop, tempo (20–300 BPM), audio-clock look-ahead scheduling (glitch-free tweaking while playing).
- **Save / load**: auto-saves to the browser (localStorage).
- **Export / import**: download the song as JSON, or import by pasting JSON text (or a `.json` file). Imports are validated safely.

## Getting started

### Option A — just open a file (no server, no tooling)
Run the build once to produce a single self-contained HTML file, then open it directly:
```bash
npm install
npm run build          # produces dist/index.html (everything inlined)
```
Then **double-click `dist/index.html`** (or open it in any browser). It runs from the
filesystem (`file://`) with no server — all JS/CSS is inlined and the audio is fully
synthesized, so there are no external files to load — a self-contained "download and run" build.

### Option B — dev server (for hacking on it)
```bash
npm run dev            # open the printed http://localhost:5173/
```

Either way: the browser blocks audio until you interact — press **Play** to start
(this resumes the AudioContext).

> Note: the raw `index.html` at the repo root will **not** work if opened directly — it
> points at TypeScript source (`src/main.ts`) that needs the build/dev step above.

## Scripts
- `npm run dev` — dev server (Vite)
- `npm run build` — typecheck + production build to `dist/`
- `npm run preview` — preview the production build
- `npm test` — run unit + property-based tests (Vitest + fast-check)

## Architecture
Layered, UI decoupled from the audio engine. Three units:
- **U1 Core** — `src/domain`, `src/state`, `src/sequencer`, `src/services` (data model, reactive store, look-ahead scheduler).
- **U2 Audio Engine** — `src/audio` (AudioEngine, Bassline voice with swappable filter stage, drum voices, parameter maps).
- **U3 IO + UI** — `src/io` (serializer, validator, persistence, import/export) and `src/ui` (views), `src/main.ts` (bootstrap).

Design docs and the full development workflow record live under `aidlc-docs/`.

## License
MIT
