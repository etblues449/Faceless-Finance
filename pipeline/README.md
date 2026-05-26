# pipeline/ — the render brain

Turns a topic into a finished, captioned 9:16 finance video and hands it to the
publish Worker. Runs unattended on GitHub Actions (Wed/Fri/Sun) or on demand.

## Files

| File | Role |
|---|---|
| `faceless_finance.py` | Proven baseline orchestrator (single lip-synced shot). `--selftest`, `--dry-run`, `--credits`. |
| `faceless_finance.env.example` | All required secrets (copy to GitHub repo **Secrets**). |
| `../.github/workflows/faceless.yml` | The cron that runs this. |

## Run it

**Automatically:** the workflow fires Wed 16:00 / Fri 17:00 / Sun 11:00 London.
Or trigger by hand: repo → **Actions → Faceless Finance → Run workflow**.

**Required GitHub Secrets** (Settings → Secrets and variables → Actions):
`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`,
`HEDRA_API_KEY`, `PRESENTER_IMAGE_URL`.
Publishing is **off** until you set repo **Variable** `POST_TO_TIKTOK=true` and add
`BLOTATO_API_KEY` + `BLOTATO_TIKTOK_ACCOUNT_ID` (interim), or wire the `worker/`
OAuth path. Until then the run uploads the finished mp4 as a downloadable artifact.

**Locally:** `pip install requests` → copy env → `python faceless_finance.py --selftest`.

## The render adapter interface (future-proofing)

Every generator implements the same contract, so swapping models never touches
the orchestrator:

```python
def render_shot(shot: Shot, *, audio_path: str | None) -> str:
    """Take one Shot, return a local path to a 9:16 mp4 clip."""
```

```python
@dataclass
class Shot:
    kind: str          # "to_camera" | "walk" | "broll"
    prompt: str        # cinematic description (camera, motion, setting, lighting)
    vo_text: str | None
    seconds: int
```

Adapters:
- `higgsfield_cinematic` — Soul `JB-FF-2026`; walk-around + camera motion. **Proven** (job `11cc9d03`).
- `hedra_lipsync` — presenter still + voice → lip-synced close-up. **Proven** (job `bd1ddf1e`).
- `heygen` — alternate talking head (existing avatar).

Higgsfield audio must be a `media_upload` UUID (URL ingestion is image-only) and
its MCP needs a live session, so cinematic shots are generated via its API, not a
one-shot HTTP node — the lesson that killed the n8n route.

## Cinematic multi-shot — the build to finish

The baseline renders one shot. The target stitches several:

1. **Shot list** — Claude returns 3–5 `Shot`s (hook to-camera → walking transition
   → b-roll over VO → payoff to-camera) as JSON.
2. **Voice** — ElevenLabs renders the VO per shot (or one track, split on timing).
3. **Render** — `higgsfield_cinematic` for walk/b-roll, `hedra_lipsync` for the
   to-camera lines. Adapters run; clips land in `out/`.
4. **Stitch** — ffmpeg concatenates, normalises to 1080×1920, burns captions.
5. **Publish** — POST the final mp4 to the `worker/` (TikTok/YouTube/Instagram).

Steps 1–2 and the two render adapters are proven in isolation; steps 3–5 wiring is
the focused next commit.

## Proof record

`PROOF-cinematic-walk.mp4` (Higgsfield, job `11cc9d03`) and
`PROOF-talking-render.mp4` (Hedra/Higgsfield lip-sync, job `bd1ddf1e`) were both
generated on Elliot's own Soul and paid credits. The look is real today.
