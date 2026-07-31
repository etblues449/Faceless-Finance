# Evidence Corpus — schema & refinement loop

The selection rubric ships with reverse-engineered weights. This file defines how
to turn *public* data into measured coefficients, so every result makes the next
selection smarter. None of it needs new software — the tools and the clipping
skills already exist; this is the intelligence layer nobody has assembled.

## What to collect

For each account running serious long-form volume (Bartlett/DOAC, Williamson,
Hormozi, …):

1. **Their latest N short-form clips** — views, post date, duration, transcript,
   text overlay, format.
2. **The source long-form episodes** — full transcripts **with timestamps**. The
   timestamps are non-negotiable: they are what lets you match every clip back to
   the exact episode and the exact moment it came from.

Everything here is public (published clips, published episodes). Respect each
platform's ToS and robots rules when collecting; store only what you need.

## `clips.jsonl` — one clip per line

```json
{
  "clip_id": "doac_2026_0142",
  "account": "DiaryOfACEO",
  "platform": "youtube_shorts",
  "url": "https://…",
  "posted_at": "2026-07-14",
  "views": 1840000,
  "duration_s": 43,
  "text_overlay": "Save FIRST, spend second",
  "format": "talking_head_captioned",
  "transcript": "Here's the biggest mistake …",
  "source_episode_id": "doac_ep_318",
  "source_start_s": 1875.0,
  "source_end_s": 1918.0
}
```

## `episodes.jsonl` — one episode per line

```json
{
  "episode_id": "doac_ep_318",
  "account": "DiaryOfACEO",
  "url": "https://…",
  "published_at": "2026-07-10",
  "duration_s": 7420,
  "cues": [
    {"start": 1875.0, "end": 1879.0, "text": "Here's the biggest mistake …"}
  ]
}
```

`cues` is exactly the shape `select_clips.py` parses — a VTT/SRT dump normalised
to `{start,end,text}`.

## The refinement loop

1. **Match** each clip to its source moment by `source_episode_id` +
   `[source_start_s, source_end_s]`. (Confirm by fuzzy-matching the clip
   transcript against the episode cues in that span.)
2. **Normalise performance.** A clip's success is relative to *its own account*,
   not absolute views. Compute `lift = views / median(views of that account's
   clips in a trailing window)`. `lift > 1` beat the account's norm.
3. **Featurise** each matched source moment with the same signals
   `select_clips.py` computes (hook, payoff, containment, specificity, emotion,
   contrarian, quotable, duration_fit).
4. **Fit.** Regress `log(lift)` on the features. The fitted coefficients replace
   the hand-set weights in `_score_window`. Re-run the self-test; the money-
   mistake sample must still rank top (a guardrail against overfitting).
5. **Also learn the negative space.** Sample high-scoring windows from episodes
   that were *never* clipped — they teach the model what looks clippable but
   isn't.

## Reverse-engineering fields (per matched clip)

Capture these so the *decision*, not just the outcome, is in the corpus:

| Field | Question it answers |
|---|---|
| `clip_start_offset_s` | Where does the clip start vs the natural start of the thought? (How much setup was cut.) |
| `context_removed` | What was cut from before/after to make it stand alone. |
| `payoff_moved_forward` | Did they lift the payoff into the first 3s? |
| `spoken_hook` | The first ~3 seconds, verbatim. |
| `overlay_pattern` | Which overlay mold (stat / contrarian / mistake / question / list). |
| `format` | talking_head / split_screen / broll / reaction / static. |
| `lift` | Performance vs that account's median. |

Run enough of these and the patterns surface — that is the whole thesis.
"Impossible to fail" doesn't mean every clip goes viral; it means every clip
starts with real evidence, and every result makes the next selection smarter.

## Status

No corpus is bundled in this repo. The schemas and loop above are the collection
spec; the rubric weights remain evidence-*informed* until a corpus is fitted. Be
honest about that when asked how the weights were chosen.
