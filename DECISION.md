# Consolidation Decision Record

**Date:** 2026-05-26
**Status:** Accepted
**Decision by:** Elliot Horton (etblues449) — executed by Claude

## Context

Four repositories had grown up around the same goal — a fully automated,
faceless, cinematic UK personal-finance video channel ("Jelly Bean", fronted by
Elliot Horton, Chartered Accountant). They overlapped and competed. This record
collapses them into **one** source of truth and retires the rest.

## Decision

**`Faceless-Finance` is the single source of truth.** All future work happens here.

| Repo | Verdict | Reason |
|------|---------|--------|
| **Faceless-Finance** | ✅ **Home** | Most evolved: web dashboard (`index.html`), the full multi-platform publish Worker (`worker/`), real reference images (`visual-references/`), browser ffmpeg groundwork (`coi-serviceworker.js`), CHARACTER_BIBLE + SETUP. |
| **fincast-worker** | 🗄️ **Archive — superseded** | Its Worker is an *older* copy. `Faceless-Finance/worker/src/index.js` is 14.8 KB with full TikTok/YouTube/Instagram OAuth + publish; the standalone is 7.5 KB. The good version already lives here. Nothing to fold. |
| **Fincast** | 🗄️ **Archive** | A single React UI draft (`finance-channel-app.jsx.txt`). Superseded by `index.html`. Salvage UI ideas only. |
| **App** | 🗄️ **Archive** | Expo RN + FastAPI + MongoDB + Termux agent — a heavy always-on server stack that fights the free/serverless goal. Wrong direction. The Termux trigger idea can be revisited later if mobile kick-off is wanted. |

## Architecture (what "best + future-proof" means here)

```
            ┌──────────────────────── GitHub Actions cron (free, serverless) ────────────────────────┐
  topic  →  │  Claude (script + shot list)  →  ElevenLabs (cloned voice)  →  RENDER  →  ffmpeg edit   │ →  Worker (OAuth publish)
            └──────────────────────────────────────────────────────────────────────────────────────┘                │
                                                                                                                      ▼
                                                                                            TikTok / YouTube / Instagram
   index.html dashboard (GitHub Pages)  ── human review / override / manual trigger ──┘
```

- **Orchestrator — GitHub Actions cron.** Free, serverless, no VM, no billing.
  *Replaces* the abandoned n8n Cloud trial and the billing-blocked GCP VM.
- **Render — modular, swappable adapters.** This is the future-proofing: each
  generator sits behind one interface, so a new model (Veo, Sora, Kling, …) is a
  one-file swap, never a rewrite.
  - **Higgsfield** (Soul `JB-FF-2026`) — cinematic motion / walk-around shots. *Proven.*
  - **Hedra** — lip-synced close-ups. *Proven.*
  - **HeyGen** — alternate talking-head adapter (existing avatar).
- **Edit — ffmpeg** stitch + burned captions (browser path already scaffolded via `coi-serviceworker.js`).
- **Publish — the existing `worker/`** (Cloudflare Worker, server-side key injection + OAuth). Blotato kept as an interim direct-post adapter.
- **Dashboard — `index.html`** on GitHub Pages for review / override.

## What is proven (on Elliot's own Soul + paid credits)

| Capability | Artifact | Job |
|---|---|---|
| Lip-synced talking shot (presenter still + voice) | `PROOF-talking-render.mp4` (720×1280, 9.1 s, AAC) | `bd1ddf1e` |
| **Cinematic walk** — full-body Soul, golden-hour city, camera dolly, 9:16 | `PROOF-cinematic-walk.mp4` (5 s, ~22 cr, seedance_2_0) | `11cc9d03` |
| Full-body Soul still (source for the walk) | — | `e287542c` |
| Script + caption generation | live (Anthropic) | — |
| Voice clone "JB Blues" | live (ElevenLabs `Ddap889CVJzcRLn7e4nG`) | — |

Both halves of the cinematic look — **walking motion** and **lip-sync** — are
real outputs, not mockups.

## What this consolidation adds

- `pipeline/faceless_finance.py` — the **proven, runnable baseline**: topic →
  Claude script → ElevenLabs voice → Hedra render → download → optional publish.
  Passes `--selftest` offline. This is the working single-shot baseline.
- `pipeline/faceless_finance.env.example` — every secret it needs.
- `.github/workflows/faceless.yml` — the Wed/Fri/Sun cron (UTC, BST-aligned).
- This `DECISION.md`.

The dashboard and the publish Worker were already here. The missing piece was the
automated render brain — now added.

## Status — the cinematic engine is BUILT and self-tested

The **cinematic multi-shot engine** is implemented in `pipeline/cinematic.py` +
`pipeline/render/` + `pipeline/edit.py`. It builds a 4-shot plan (hook to-camera →
walk → b-roll over voiceover → payoff), renders each shot, lays narration over the
motion shots, stitches to 1080×1920 and burns captions. `python pipeline/cinematic.py
--selftest` runs the whole flow offline and produces a real 1080×1920 captioned mp4
(verified). Default render engine is **Hedra** (server-callable, your existing
credits); **Higgsfield** is wired as the premium motion adapter behind a validation
flag. The only step left is the **first live run on real keys** (burns Hedra credits)
— a button press, not a build. The render *look* is already proven (jobs `11cc9d03`
walk, `bd1ddf1e` lip-sync). The original single-shot script remains as a fallback.

## Archiving the retired repos

The GitHub API available here cannot flip the Archive bit. Each retired repo has
been given a `SUPERSEDED.md` pointing here. To finish:

> For **App**, **Fincast**, **fincast-worker**: open the repo →
> **Settings** → scroll to **Danger Zone** → **Archive this repository**.

One tap each. Read-only after that; nothing is deleted.
