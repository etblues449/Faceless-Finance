# pipeline/ — the cinematic render brain

Turns a topic into a finished, captioned **1080×1920** multi-shot finance video and
hands it to the publish Worker. Runs unattended on GitHub Actions (Wed/Fri/Sun) or on
demand. Built around **swappable render adapters** so a new model is a one-line swap.

## Modules

| File | Role | Status |
|---|---|---|
| `cinematic.py` | Orchestrator: topic → shot list → voice → render → stitch → publish. `--selftest`, `--dry-run`, `--topic`. | ✅ self-test passing |
| `shotlist.py` | Claude → structured 4-shot cinematic plan (JSON) + offline fallback. | ✅ tested (parser+fallback) |
| `voice.py` | ElevenLabs TTS per shot (clone "JB Blues") + silent fallback. | ✅ (live = key) |
| `edit.py` | ffmpeg: normalise→narration-over-motion→concat→burn captions. | ✅ proven on real clips |
| `render/base.py` | `Shot` / `ShotPlan` + the engine contract. | ✅ |
| `render/hedra.py` | Hedra **Avatar** (lip-sync) + **Omnia** (image→motion). Default engine. | ✅ contract proven |
| `render/higgsfield.py` | Premium cinematic Soul adapter (behind a validation flag). | ⏳ needs 1 live call |
| `publish.py` | Worker (multi-platform OAuth) → else Blotato (TikTok). | ✅ (live = config) |
| `config.py` | All env in one place, import-safe. | ✅ |
| `faceless_finance.py` | Original single-shot baseline (kept as a fallback). | ✅ |

## How a video is built (the cinematic flow)

```
topic
  → Claude shot list: 4 shots  [hook to-camera → walk → b-roll → payoff to-camera]
  → ElevenLabs voices each line
  → render per shot:
        to_camera → Hedra Avatar (still + voice → lip-sync)
        walk/broll → Hedra Omnia (still + prompt → cinematic motion, ≤8s)
  → ffmpeg: each clip → 1080×1920, narration laid over motion, last frame frozen
            to fit the VO, all concatenated, captions burned from real timings
  → final_YYYYMMDD.mp4  → Worker publishes (or saved as an Actions artifact)
```

## Default vs premium render engine

- **Default = Hedra** (`RENDER_TO_CAMERA=hedra`, `RENDER_MOTION=hedra`). Server-callable,
  uses your existing Hedra credits, proven. The pipeline runs unattended on this today.
- **Premium = Higgsfield** (the cinematic Soul walk you liked). The look is proven via the
  Higgsfield MCP; headless use needs a validated REST endpoint. Once you confirm one live
  call, set `HIGGSFIELD_API_BASE` + `HIGGSFIELD_TOKEN` and `RENDER_MOTION=higgsfield` — the
  orchestrator doesn't change. Until then it refuses to run (no silent wrong calls).

## Run it

```bash
pip install requests          # ffmpeg must be on PATH
python pipeline/cinematic.py --selftest   # offline, proves the whole flow (no keys, no credits)
python pipeline/cinematic.py --dry-run    # real script/voice path, no publish
python pipeline/cinematic.py --topic "ISA allowance before 5 April"   # full live run
```

**Automatically:** `.github/workflows/faceless.yml` fires Wed 16:00 / Fri 17:00 / Sun 11:00
London, or **Actions → Faceless Finance (cinematic) → Run workflow** (optional topic box).

**Secrets:** see `faceless_finance.env.example`. Publishing stays **off** until repo Variable
`POST_TO_TIKTOK=true` and either the Worker URL or Blotato keys are set; until then every run
uploads the finished mp4 as a downloadable artifact.

## What's proven

- **End-to-end orchestration + editor:** `--selftest` builds the 4-shot plan, renders, and
  produces a real 1080×1920 captioned mp4. Verified.
- **Render look:** Higgsfield cinematic walk (job `11cc9d03`) and Hedra/lip-sync (job
  `bd1ddf1e`) on your own Soul + paid credits.
- **Remaining live step:** first scheduled run on real keys (burns Hedra credits) to confirm
  the API renders inside the full flow. That's a button press, not a build.
