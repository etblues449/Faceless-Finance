# CLAUDE.md — Faceless Finance

Guidance for Claude working in this repo. UK-tax-saving faceless short-form video
channel: idea → script → cinematic scenes → stitch + voiceover → approve → publish.

## Architecture

Two independent ways to make videos live in this repo:

1. **The app** (`index.html`) — a single-file in-browser React app (React 18 via
   esm.sh importmap + in-browser Babel), deployed to **GitHub Pages**. This is
   the primary, interactive tool. ~5k lines, no build step.
   - **`worker/`** — a Cloudflare Worker (`fincast-worker`) that backs the app:
     - `/proxy/<host>/<path>` — CORS-busting passthrough **+ server-side key
       injection (Design A)**: generation keys live as Worker secrets and are
       injected into the upstream call, so the browser never holds a real key.
       See `SECRET_INJECTION` in `worker/src/index.js`.
     - `/oauth/*`, `/auth/*`, `/publish/*` — Phase 2 social auto-publishing
       (needs the KV `TOKENS` namespace + OAuth secrets). Multi-file:
       `cors.js`, `storage.js`, `oauth/*`, `publish/*`.
   - **`coi-serviceworker.js`** — supplies COOP/COEP so `ffmpeg.wasm` can use
     `SharedArrayBuffer` to **stitch** on Pages (which can't send those headers).
     COEP is `credentialless` so CDN scripts still load. Registered as the first
     script in `index.html`'s `<head>`.

2. **The pipeline** (`pipeline/`) — a separate, server-side, zero-dependency
   Node service (topic → Claude script → ElevenLabs → HeyGen → captions →
   Postiz). Fully unit-tested (`cd pipeline && npm test`). An alternative,
   hands-off path; does not use the app or the Worker.

## Provider stack (consolidated)

Core: **Veo 3** (Google AI Studio) + **Runway Gen-4** (cinematic) + **ElevenLabs**
(voice) + **Claude** (script) + **Pexels** (B-roll). Dormant but wired (activate
by setting their Worker secret): HeyGen, Hedra, Higgsfield, fal.

## Key facts / gotchas

- **Keys: Design A.** Never put a real generation key in the browser or in chat.
  They go in Worker secrets (`wrangler secret put`). `proxiedUrl()` strips any
  inline `?key=` so a secret can't be persisted into a saved render URL.
- **Stitch needs cross-origin isolation.** If stitch breaks, check the COI
  service worker registered (console) and that the page is `crossOriginIsolated`.
- **Compliance:** education, not advice. UK terms, FCA disclaimer. No product
  recommendations, no guaranteed returns. Presenter spec: `CHARACTER_BIBLE.md`.
- `main` is the default branch; the Pages workflow deploys **only** the static
  front-end from `main` (not `worker/` or `pipeline/`).

## Validating changes (no browser needed)

- App JSX compiles: extract the `text/babel` block and run it through
  `@babel/standalone` (preset `react`). A syntax error there breaks the whole app.
- `node --check` on `worker/src/index.js`, `coi-serviceworker.js`.
- `cd pipeline && npm test`.
- A real end-to-end test (esp. stitch + publish) requires a browser + deployed
  Worker + secrets — see `SETUP.md`. State clearly when something is unverified.

## Conventions

- Keep `index.html` edits surgical — it's one giant file with in-browser Babel.
- Don't commit secrets. Don't deploy `worker/`/`pipeline/` to Pages.
