# Faceless Finance — automation pipeline

Turns a **topic** into a published short-form video, end to end:

```
topic ─▶ script (Claude, FCA-safe UK tax) ─▶ voiceover (your ElevenLabs clone)
      ─▶ talking video (HeyGen Avatar V — "Elliot" walking + talking to camera)
      ─▶ per-platform captions (+ FCA disclaimer)
      ─▶ auto-publish to TikTok / YouTube Shorts / Instagram Reels (Postiz)
```

This is the server-side pipeline recommended after the provider research: a thin,
testable orchestrator over **best-in-class ready-built services** rather than a
bespoke multi-provider engine. HeyGen Avatar V does the hard part (a consistent
twin that walks while talking to camera); Postiz does the publishing.

## Why these pieces

| Stage | Service | Why |
|---|---|---|
| Script | Anthropic Claude | Compliant-by-construction UK tax scripts (rules baked into the system prompt) |
| Voice | ElevenLabs | Keeps your existing professional voice clone |
| Video | HeyGen Avatar V | Only 2026 service with a *consistent* twin that walks + talks to camera, with an API |
| Publish | Postiz (self-host) | Free, official-API direct publishing to all three platforms |

## Requirements

- Node.js ≥ 20 (uses native `fetch`; **zero runtime dependencies**)
- API keys: Anthropic, ElevenLabs, HeyGen
- A HeyGen **Avatar V** twin of your presenter (created once in the HeyGen
  dashboard from your reference photos + `../CHARACTER_BIBLE.md`)
- A running Postiz instance (see `deploy/postiz/`) — optional; set
  `POSTIZ_ENABLED=false` to render-only and publish manually

## Setup

```bash
cd pipeline
cp .env.example .env        # fill in keys + ids
npm test                    # 28 tests, no network/keys needed
```

There is nothing to `npm install` — the pipeline has no third-party runtime deps.

## Usage

```bash
# Generate a batch of topic ideas
node src/cli.js ideas --count 8 --theme "pensions and SIPPs"

# Dry-run: write the script + captions, skip the paid voice/video/publish steps
node src/cli.js run --topic "How the £20k ISA allowance works in 2025/26" --dry-run

# Full run: script -> voice -> video -> publish NOW
node src/cli.js run --topic "How the £20k ISA allowance works in 2025/26"

# Full run, but SCHEDULE the post instead of publishing immediately
node src/cli.js run --topic "Marriage Allowance explained" --schedule 2026-05-21T09:00:00Z
```

Every run writes its artifacts to `output/<timestamp>_<slug>/`:
`script.json`, `captions.json`, `voiceover.mp3`, `video.mp4`, `publish.json`.

> A `--dry-run` still calls Claude (cheap) so you can review the actual script;
> it stops *before* the paid voice/video/publish steps.

## Run it on a schedule (4 videos/week, hands-off)

Generate ideas weekly and render one each weekday morning via cron:

```cron
# render + publish a video at 09:00 Mon–Thu, topic piped from a queue file
0 9 * * 1-4  cd /srv/faceless-finance/pipeline && node src/cli.js run --topic "$(head -n1 topics.txt)" && sed -i '1d' topics.txt
```

(Or import the same stages into n8n as HTTP Request nodes if you prefer a no-code
graph — the four `src/*.js` clients map 1:1 to nodes.)

## Cost (≈4 × 30s videos/week)

| Item | Approx |
|---|---|
| HeyGen Avatar V API (~$4/min 1080p) | ~$2/video → ~$32/mo |
| HeyGen plan | ~$29/mo |
| ElevenLabs | a few $/mo at this volume |
| Claude scripts | pennies |
| Postiz | £0 (self-hosted) |
| **Total** | **≈ $60–90/mo, fully automated** |

## Tests

```bash
npm test
```

28 unit tests cover caption/disclaimer logic, JSON-parsing resilience, the HeyGen
poll state machine (processing → completed / failed / timeout), Postiz payload
assembly, and the full orchestration with every external call mocked. They run
offline with no API keys.

## File map

```
src/
  config.js      env loading + validation (single source of required keys)
  http.js        fetch wrapper: timeout + exponential-backoff retry (429/5xx)
  anthropic.js   script generation (FCA-safe UK system prompt) + JSON parsing
  elevenlabs.js  text-to-speech with your voice clone -> MP3 bytes
  heygen.js      upload audio -> generate -> poll -> download MP4
  captions.js    per-platform captions + disclaimer + length caps
  postiz.js      upload media + create/schedule posts
  ideas.js       batch topic-idea generation
  pipeline.js    the orchestrator (fully injectable for testing)
  cli.js         command-line entry point
deploy/postiz/   self-host the auto-poster (docker compose)
test/            28 unit tests (node:test, no network)
```

## Honest caveats

- **Avatar V realism ceiling (2026):** the twin is *waist-up, moving,
  scene-changing* — convincing as a handheld walk-and-talk, but not yet a
  flawless full-leg street vlog. Set creative expectations accordingly.
- **Third-party API shapes** (HeyGen Avatar V fields, Postiz public API field
  names) can change between releases. Each provider is isolated in its own file
  with response-shape tolerance, so adapting to a change touches one module. Do
  a single live `--dry-run` then one real run after entering your keys to confirm
  the field mappings against your accounts.
