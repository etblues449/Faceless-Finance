# podcast-clip-selection — the clip *selection* intelligence layer

> Editing was never the hard part. **Choosing the moment is.**

AI can already cut, caption and format a clip. It does not know which 40 seconds
out of a two-hour conversation deserve to become the clip. This skill is that
missing layer: hand it a **timestamped** transcript and it returns the strongest
moments — exact timestamps, spoken hooks, text overlays, formats and edit
instructions. The downstream editing skill does the easy part.

## How it works — two stages

1. **Shortlist (deterministic).** `scripts/select_clips.py` segments the episode
   into candidate windows and scores each on the measurable proxies of a viral
   clip (hook, payoff, self-containment, specificity, emotion, contrarian,
   quotability, duration fit). The machine finds **where**.
2. **Package (Claude, via `SKILL.md`).** For each candidate, Claude reverse-
   engineers the decision, tightens the cut, decides whether to move the payoff
   forward, and writes the hook / overlay / format / edit instructions. The model
   decides **how**.

The split is the whole design. `SKILL.md` is the entry point Claude follows.

## Try it (offline, zero dependencies)

```bash
cd .claude/skills/podcast-clip-selection
python3 scripts/select_clips.py --selftest                 # proves the whole flow
python3 scripts/select_clips.py --file assets/sample_episode.vtt --top 3
```

On the bundled sample it correctly promotes the "biggest money mistake" and
"everyone thinks you need a huge income" moments and demotes the "welcome back,
tell me where you grew up" small-talk to last — which is exactly the judgment the
layer exists to make.

Real transcripts: pass any `.vtt` / `.srt` / `[HH:MM:SS] text` file with `--file`
(`yt-dlp --write-auto-sub --sub-format vtt`, or Whisper, both produce timestamps).

## Files

| Path | What |
|---|---|
| `SKILL.md` | The skill Claude runs — two-stage method + output format. |
| `scripts/select_clips.py` | Stage-1 scorer. Stdlib only. `--selftest` runs offline. |
| `references/selection-rubric.md` | The 10 selection principles + scoring rubric. |
| `references/hook-and-overlay-patterns.md` | Hook taxonomy, overlay + format patterns. |
| `references/data-schema.md` | Clip/episode corpus schemas + the refinement loop. |
| `assets/sample_episode.vtt` | Timestamped sample used by the demo + self-test. |

## Getting smarter over time

The rubric weights are a reverse-engineered **prior**, not folklore. Scrape the
top clips from the accounts running serious long-form volume (Bartlett/DOAC,
Williamson, Hormozi, …) with views + duration + overlay + format, match each back
to its source episode by timestamp, measure which features actually beat that
account's median, and fold the fitted coefficients back into the scorer.
`references/data-schema.md` defines the exact JSONL shapes and the loop. Until a
corpus is fitted the weights are evidence-*informed*, not evidence-*derived* — and
the skill says so when asked.

## Scope / honesty

- The scorer is validated offline via `--selftest`; it needs no keys or network.
- No scraped corpus is bundled — collecting one is public-data work described in
  `data-schema.md`, not code that ships here.
- Faceless Finance is UK finance **education, not advice**: a moment that only
  works by implying advice or guaranteed returns is not a clip
  (`FCA_COMPLIANCE_FRAMEWORK.md`).
