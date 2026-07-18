# Build and Test Summary — Reversible

## Build
- `npm install` — installs pinned dev dependencies (lockfile committed, SEC-10).
- `npm run build` — `tsc --noEmit` (strict typecheck) + `vite build` → static bundle in `dist/`.
- Result: **success**. Bundle ~23 KB JS (gzip ~8 KB) + ~3 KB CSS. Static-only, no backend (NFR-2).

## Tests (Vitest + fast-check)
- `npm test` → **24 tests, all passing**.
- Unit: reducer rules (clamp/immutability/transitions), validator (malformed/version/range/prototype-safety), scheduler counting.
- Property-based (PBT, partial mode):
  - **PBT-02** round-trip: `deserialize(serialize(song)) === song`; export→validate→equal.
  - **PBT-03** invariants: step-count preserved, bpm/params/notes clamped, toggle involution, drum voice-key set stable, per-bar trigger count = on-steps (P-01..P-07).
  - **PBT-07** domain generators; **PBT-08** fast-check default shrink/seed; **PBT-09** fast-check configured.

## Verification (operable)
- Dev server (Vite 7) serves the app; all module transforms return HTTP 200.
- Production build renders and typechecks clean.

## Security (SEC compliance, enabled Full)
- **SEC-05/13/15**: JSON import validated (type/schema/version), parse errors caught, fail-safe (clamp/no-op, no throws across boundaries). Verified by `validator.test.ts` and reducer tests.
- **SEC-10**: dependency scanning via `npm audit`. After upgrading to Vite 7 + Vitest 4, **`npm audit` reports 0 vulnerabilities**. Dependencies pinned via committed `package-lock.json`; no `latest` tags.
- **SEC-04 (hosting note)**: when deploying the static bundle, serve with a restrictive `Content-Security-Policy` (at minimum `default-src 'self'`), plus `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and HSTS over HTTPS. No inline scripts are required by the app.
- Other SEC rules (DB/auth/network/IAM) — N/A (client-only static app).

## CI / Release (GitHub Actions)
- `.github/workflows/release.yml` runs on **Release published** (and manual `workflow_dispatch`):
  `npm ci` → `npm test` → `npm run build`, then attaches the single-file `reversible-<tag>.html`
  to the GitHub Release and uploads a `dist` build artifact.
- Least-privilege token (`contents: write`, SEC-06). Actions pinned by major version;
  can be pinned to full SHAs for stricter supply-chain integrity (SEC-10/13).

## Hosting
- `npm run build`, then serve `dist/` on any static host (with the headers above).

## Single-file / offline build
- `npm run build` produces a **single self-contained `dist/index.html`** (~27 KB) via
  `vite-plugin-singlefile` — all JS/CSS inlined, no external references.
- It runs directly from the filesystem (`file://`) by double-clicking, since the app has
  no runtime asset fetches (audio is synthesized). This is the "download and run" form.
- The raw repo-root `index.html` requires the dev server / build (it points at `src/main.ts`).
