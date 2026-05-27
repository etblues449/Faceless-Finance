# HANDSOFF — running this channel without touching it

This is the operations runbook for the **Faceless Finance** channel: a fully
automated, faceless, AI-avatar UK personal-finance video channel fronted by a
Chartered Accountant. Once the one-time setup below is done, it produces and
(optionally) posts videos **Wed / Fri / Sun** with zero manual work.

---

## 1. How it runs hands-off

```
GitHub Actions cron (Wed 16:00 / Fri 17:00 / Sun 11:00 London)
  → Claude writes a 4-shot script + caption
  → ElevenLabs voices each line in your cloned voice
  → Hedra renders each shot (Avatar = talking, Omnia = motion) at 720p, 9:16
  → ffmpeg stitches to 1080×1920 and burns lower-third captions
  → finished mp4 is uploaded as an artifact AND reported to the app for review
  → if publishing is ON, the Worker posts it to TikTok / YouTube / Instagram
```

Nothing here needs you in the loop. The schedule lives in
`.github/workflows/faceless.yml`. Manual trigger any time:
**Actions → Faceless Finance (cinematic) → Run workflow**.

---

## 2. Current state (what's built and proven)

- **One repo** (`Faceless-Finance`) is the single source of truth. `App`,
  `Fincast`, `fincast-worker` were consolidated/retired (see `DECISION.md`).
- **Render pipeline** (`pipeline/`) — proven end to end on the live runner:
  Claude → ElevenLabs → 4× Hedra shots → ffmpeg stitch → captioned 1080×1920 mp4.
- **Your likeness** — `visual-references/elliot-headshot-walk.png` (talking) and
  `elliot-fullbody-walk.png` (motion) are used for every shot.
- **Captions** — lower-third, ~52px, readable (fixed from the earlier oversized pass).
- **App** (`app.html`) — mobile control panel: generate → review → approve & publish.
- **Worker** (`worker/`) — secure backend: key-injection proxy, OAuth publish for
  TikTok/YouTube/Instagram, and the `/api/*` control plane the app uses.

---

## 3. One-time setup to reach TRUE zero-touch

These are the only things that need *your* accounts. Do them once.

### Already done
- GitHub repo **Secrets**: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`,
  `ELEVENLABS_VOICE_ID`, `HEDRA_API_KEY`. (Presenter/full-body images now come
  from the repo, so no image URLs are needed.)

### To turn on automatic posting
1. **Deploy the Worker** — Cloudflare → Workers & Pages → Connect to Git →
   Faceless-Finance, root directory `worker`. Add a **KV namespace** bound as
   `TOKENS`, and secrets `GH_TOKEN` (fine-grained PAT, Actions read+write) and
   `INGEST_SECRET` (any long random string). Note the Worker URL.
2. **GitHub Secrets**: add `WORKER_INGEST_URL = https://<worker>/api/ingest` and
   `INGEST_SECRET` (same string).
3. **Connect socials** — open the app, tap Connect for each platform (uses the
   Worker's OAuth). Requires the platform OAuth secrets on the Worker
   (`TIKTOK_CLIENT_KEY`, `GOOGLE_CLIENT_ID`, `META_APP_ID`, etc.).
4. **Flip the switch** — repo **Variable** `POST_TO_TIKTOK = true`.

Until step 4, every run still renders and saves the video (artifact + app review) —
it just doesn't post. That's the safe default.

### Optional — premium cinematic motion (Higgsfield)
Create an API key at cloud.higgsfield.ai → API. Add GitHub Secrets
`HIGGSFIELD_TOKEN` and `HIGGSFIELD_VIDEO_MODEL` (slug from docs.higgsfield.ai),
and set `RENDER_MOTION=higgsfield` in the workflow. Motion shots then use your
Soul instead of Hedra Omnia.

---

## 4. Day-to-day operation

**Nothing.** It runs on the schedule. Two optional habits:

- **Review before it posts:** keep `POST_TO_TIKTOK=false` and use the app —
  Generate, watch, then Approve & Publish only what you like.
- **Steer topics:** edit the `TOPICS` list in `pipeline/cinematic.py`, or pass a
  topic via the app / the workflow's Run-workflow box.

---

## 5. Tuning levers (where to change what)

| Want to change… | Edit |
|---|---|
| Topics | `pipeline/cinematic.py` → `TOPICS` |
| Script style / length | `pipeline/shotlist.py` (SYSTEM/INSTRUCT, `seconds`) |
| Caption size/position | `pipeline/edit.py` → `burn_captions` style |
| Voice | `ELEVENLABS_VOICE_ID` secret |
| Your photos | replace files in `visual-references/` |
| Render quality | `HEDRA_RESOLUTION` (540p/720p) |
| Render engine | `RENDER_TO_CAMERA` / `RENDER_MOTION` (hedra | higgsfield) |
| Schedule | `.github/workflows/faceless.yml` cron |

---

## 6. Troubleshooting

- **Run failed → read the log:** Actions → the red run → the red step.
- **Image fetch error:** the runner reads images from `visual-references/` on disk
  (no public URL needed). Make sure the files exist and the workflow points at the
  repo-relative paths.
- **Hedra 422:** every shot needs an audio track; the pipeline always voices each
  shot (real or silent). Don't remove the audio step.
- **`ffprobe not found`:** the workflow installs ffmpeg; keep that step.
- **Video saved but not posted:** publishing is off (`POST_TO_TIKTOK` unset) or the
  Worker/OAuth isn't connected — that's the safe default, not a bug.

---

## 7. Cost per run (your existing credits)

~4 Hedra shots at 720p (Avatar + Omnia), a few hundred ElevenLabs characters, and a
small Claude call. Roughly one short video's worth of Hedra credit per run, three
runs a week. No third-party render gateways — only your own Hedra/ElevenLabs/Claude.

---

## 8. Security

Keys live **only** as GitHub repo Secrets and Worker secrets — never in the repo or
the browser (the Worker injects them server-side). Rotate any key that was ever
pasted into a chat or screenshot, and update the corresponding Secret.

---

## 9. Repo map

```
pipeline/        the render brain (cinematic.py orchestrator + render adapters + edit)
worker/          Cloudflare Worker: proxy + OAuth publish + /api control plane
app.html         mobile control panel (GitHub Pages)
visual-references/  your headshot + full-body stills
.github/workflows/faceless.yml   the Wed/Fri/Sun cron
DECISION.md      why the architecture is what it is
HANDSOFF.md      this file
```
