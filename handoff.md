# Handoff — Faceless Finance App

_Last updated: 2026-05-17 (session continuation)_

## Goal

Produce **cinematic walking-around UK personal-finance shorts** featuring the
user's avatar — NOT static talking-head / direct-to-camera output — generated
as cheaply as possible (ideally free), driven entirely from an **Android
phone** (the user's only device). Output: a single stitched MP4 with the
user's cloned ElevenLabs voice muxed over AI-generated cinematic clips.

The app is a single-file React/JSX (in-browser Babel) page served from GitHub
Pages, backed by a Cloudflare Worker CORS proxy.

## Current state — IT WORKS (mostly)

As of this session, a render **succeeded end-to-end visually**:
- Veo 3 (free Google AI Studio tier) generated a genuinely cinematic clip — the
  avatar walking down a wet, blue-hour London street glancing at his phone.
  **Zero talking-head.** This is exactly the target look.
- Confirmed live: Veo-3-first routing, the talking-head-bias fixes, the new
  full-body reference photo, and the ffmpeg CSP fix.

### The one open issue: final video is only 8 seconds

The approved video plays only **0:08** even though the script is 114 words
(~30s, ≈4 Veo scenes). Root cause is understood:

1. Veo 3 **did** generate all scenes — the debug log showed multiple
   `veo3-poll … done:true` operations, each with its own video URI.
2. The auto-stitch step then called `ffmpeg.wasm`, which **failed on the old
   code** with a CSP `Failed to construct 'Worker'` error (jsDelivr worker
   script blocked cross-origin on GitHub Pages).
3. On stitch failure the code sets `render.stitchError` and leaves
   `heygen.videoUrl = successful[0].videoUrl` — i.e. **scene 1 only** (8s).
   That's what the screenshot shows.
4. **PR #75 (merged this session) fixed the ffmpeg CSP error** by fetching the
   class-worker/core/wasm as same-origin `blob:` URLs. This is now deployed but
   was NOT yet exercised by a fresh render at session end.

## What's been touched (all merged to `Faceless-Finance-App`)

| PR | What | Status |
|----|------|--------|
| #72 | Talking-head bias: expanded `applyCharacterBible` strip patterns + stronger NOT-pattern directive; force-`cinematic` post-parse validation in `generateScript`; `migrateScriptToStoryboard` default → cinematic; `scriptSystemPrompt` FORBIDDEN list + GOOD/BAD examples; Pexels orientation fix; Runway reference-photo warning callout | merged |
| (commit) | Added `visual-references/elliot-fullbody.png` (non-selfie 3/4 full-body London-bus-doorway photo) + "Use cinematic default" button + placeholder URL | merged |
| #73 | TikTok-length scripts: Mat 15–22s / Rebecca 25–35s / Neutral 18–25s, with word caps, to keep cost under £5 | merged |
| #74 | Promote **Veo 3 to FAST PATH 0** (free Google quota) above paid Runway in the orchestrator + both ladder UIs + cost-sim `failIdx` | merged |
| #75 | **ffmpeg.wasm CSP fix** — `toBlobURL()` helper; load `classWorkerURL`/`coreURL`/`wasmURL` from same-origin blobs | merged |

Single source file for all app changes: **`/home/user/Faceless-Finance/index.html`**
(~5,200 lines, single-file React app). No active uncommitted edits at handoff
(working tree clean, on branch `fix/ffmpeg-blob-worker`, already merged).

## What didn't work and why

- **LongCat-Video-Avatar (HF Space)** — the only open-source cinematic+lip-sync
  option. Dead end: the `cpuai/LongCat-Video-Avatar` Space declares
  `@spaces.GPU(duration=900)`, exceeding HF's free 300s / Pro 480s ZeroGPU caps.
  Un-fixable client-side. Left in the ladder but disabled; needs HF Enterprise
  or self-hosting. (PRs #67–#69 were the integration attempts.)
- **Local generation (Wan2GP / HunyuanVideo / LTX-2 / Open-Sora)** — impossible
  on the user's Android phone (no NVIDIA GPU; these need 8–24GB VRAM). Ruled out.
- **Cheap cinematic** — doesn't exist. Cheap providers (HeyGen/Hedra) only do
  talking-head; cinematic (Runway/Fal/Veo) is the expensive tier. Veo 3's free
  Google quota is the only "free cinematic" path, hence PR #74.
- **ffmpeg.wasm direct CDN load** — blocked by GitHub Pages CSP on Worker
  construction. Fixed via blob URLs in PR #75.

## The single next thing to try

**Run one fresh render end-to-end** (after a hard-refresh `?cb=now`) and confirm
the stitched MP4 matches the full script length:

1. New Video → Mat-style tone → generate → render via Veo 3 (free).
2. Let ALL scenes finish (watch 🐞 for N× `veo3-poll done:true`).
3. The inline auto-stitch (index.html ~line 5137) fires because a fresh video
   has no `stitchError` flag. Watch for `stitch ffmpeg_loaded` → `stitch done`.
4. **Expected:** Approval card shows scene 1 first, then swaps to a ~30s
   stitched video with the ElevenLabs voice over all scenes.

If it still ends up 8s, check in 🐞:
- `stitch start { sceneCount: N }` — is N the full scene count or 1?
- If N>1 but output still 8s → ffmpeg concat issue in `_stitchVeoCinematicInner`
  (index.html ~line 4911), likely the `-c copy` mux dropping segments; try
  re-encoding the mux step too.
- If N==1 → only one scene's `videoUrl` reached stitch; inspect `updatedJobs`
  assembly in `pollAllJobs` / the completion handler (~line 5124).

### Note on the OLD 8-second video
The existing approved video has `stitchError` set, so on page load the
auto-retry effect (index.html ~line 4990) _should_ re-stitch it — BUT only if
its Veo file URLs are still alive (~48h expiry) AND still carry the original
API key. **If the user rotates the Google key (recommended — it leaked in
pasted logs this session), those baked-in URLs will 403 and the old video can't
re-stitch.** Don't rely on the old video; validate with a fresh render.

## Standing reminders / constraints

- **Rotate the Google AI Studio API key** — it appeared in pasted debug logs
  (`?key=AIza…`). Revoke + reissue at aistudio.google.com, repaste in Settings.
- Runway API key the user supplied earlier must NEVER be logged/committed/echoed.
- GitHub MCP scope is restricted to `etblues449/Faceless-Finance` only.
- Worker code lives in a separate `fincast-worker` repo (not in MCP scope); the
  user syncs worker changes manually. Cloudflare auto-deploys it on push.
- Never push to a branch other than the designated dev branch without explicit
  permission; develop on `claude/setup-finance-channel-FYhHe` per task config,
  though recent work merged feature branches into `Faceless-Finance-App`.
