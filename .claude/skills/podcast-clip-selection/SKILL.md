---
name: podcast-clip-selection
description: >-
  Select and package the strongest short-form clips from a long-form podcast or
  interview. Use whenever the user has a timestamped transcript (VTT/SRT/YouTube)
  of an episode and wants to know which moments to clip — the exact start/end
  timestamps, the spoken hook, text-overlay options, format, and edit
  instructions. The selection intelligence layer: the machine finds WHERE, this
  skill decides HOW. Triggers on "which parts should I clip", "find viral
  moments", "podcast clip", "cut this episode into shorts", "clip selection".
---

# Podcast Clip Selection

Editing was never the hard part. **Choosing the moment is.** AI can already cut,
caption and format a clip. What it can't do out of the box is know which 40
seconds of a two-hour conversation deserve to become the clip. This skill is that
missing layer: hand it a timestamped transcript, it returns the strongest
moments with exact timestamps, hook options, text overlays, formats and edit
instructions. The downstream editing skill does the easy part.

## When to use

- The user has a **timestamped** transcript (WebVTT `.vtt`, SubRip `.srt`,
  YouTube transcript, or `[HH:MM:SS] text` lines) of a long-form episode.
- They ask which moments to clip, or for a clip plan / shot of viral candidates.

Timestamps are non-negotiable — they are what lets you match a clip back to the
exact moment. If the transcript has no timestamps, say so and ask for one (most
podcast hosts and YouTube provide them; `yt-dlp --write-auto-sub --sub-format vtt`
or Whisper produce them).

## The two-stage method

**Stage 1 — Shortlist (deterministic, the script).** Run the scorer. It segments
the episode into candidate windows and ranks them on the measurable proxies of a
viral clip (hook strength, payoff, self-containment, specificity, emotion,
duration fit, quotability). This does the mechanical heavy lifting — you are not
skimming a two-hour transcript by eye.

```bash
python .claude/skills/podcast-clip-selection/scripts/select_clips.py \
    --file EPISODE.vtt --top 8 --text
```

Output is JSON: ranked, non-overlapping candidates, each with `start`/`end`,
`timecode`, `score`, a `features` breakdown, and the `opening_line`,
`quotable_line`, `closing_line`, plus the full `text` (with `--text`).

Tune `--min` / `--max` to the target platform (Shorts/Reels/TikTok: 18–60s is
the sweet spot; the default is already that band). Raise `--top` to see more.

**Stage 2 — Package (your judgment, this skill).** For each shortlisted
candidate, do the editorial work the script deliberately does *not*:

1. **Reverse-engineer the decision.** Read `references/selection-rubric.md`.
   For each candidate confirm it genuinely earns a clip: does it open a loop and
   close it inside the window? Is it comprehensible with zero prior context? If a
   candidate scores high on numbers but has a dangling "he said…" open, either
   move the start or reject it.
2. **Find the real cut points.** The script's window is a *starting* boundary.
   Tighten it: start on the most arresting sentence (usually the
   `opening_line`, sometimes one sentence later), end on the payoff/button — cut
   any trailing setup for the next topic. State the tightened `start`/`end` to
   the second.
3. **Decide whether the payoff moves forward.** If the punchline lands late and
   the first 3 seconds are weak, recommend teasing the payoff up front
   (cold-open the promise, then deliver) — the highest-retention podcast teams do
   this constantly. Say exactly which line moves and where.
4. **Write the spoken hook + text overlay + format.** Use
   `references/hook-and-overlay-patterns.md`. Give 2–3 hook framings and 2–3
   overlay options per clip, and one format recommendation with a reason.
5. **Write the edit instructions.** Concrete, cut-ready: in/out timestamps, what
   context to remove, where the payoff goes, caption style, b-roll/emphasis
   beats. This is what you hand to the editing skill or a human editor.

## Output format

Return a ranked clip plan. For each clip:

```
### Clip N — <one-line label>   [score NN]
- **Pull:** HH:MM:SS – HH:MM:SS  (≈ NNs)   ← tightened cut, not the raw window
- **Why it clips:** which principles it hits (loop, payoff, specificity, …) and,
  when the account's own benchmark data is available, how it compares.
- **Spoken hook (first 3s):** 2–3 options.
- **Text overlay:** 2–3 options (≤ ~7 words, front-loaded).
- **Format:** talking-head | captioned-static | split-screen | reaction | b-roll-over — with a reason.
- **Edit instructions:** in/out, context to cut, payoff-forward move (if any), caption + emphasis beats.
```

Lead with the single strongest clip. Be honest when a shortlisted candidate
doesn't actually hold up — a low-evidence clip is worse than one fewer clip.

## The evidence layer (why this gets smarter)

The rubric weights are a strong reverse-engineered starting point, not folklore.
The design is built to be refined by real data: scrape the top-performing clips
from the accounts running serious long-form volume (Bartlett/DOAC, Williamson,
Hormozi, …) with views + post date + duration + transcript + overlay + format,
match each clip back to its source episode by timestamp, and you can measure
which features actually correlate with a clip beating that account's median. Feed
that back into the weights. `references/data-schema.md` defines the exact JSONL
shapes for that clip/episode corpus and how to fold measured lift into the
scorer. Until a corpus exists the rubric is evidence-informed, not
evidence-derived — say so if the user asks how the weights were set.

## Compliance (this channel)

Faceless Finance is UK personal-finance **education, not advice**. Never select
or frame a clip as a product recommendation, a guaranteed return, or regulated
advice. See the repo's `FCA_COMPLIANCE_FRAMEWORK.md`. A moment that would only
work by implying advice is not a clip — drop it.

## Files

- `scripts/select_clips.py` — Stage-1 scorer. Zero-dep. `--selftest` runs offline.
- `references/selection-rubric.md` — the 10 selection principles + scoring rubric.
- `references/hook-and-overlay-patterns.md` — hook taxonomy, overlay + format patterns.
- `references/data-schema.md` — clip/episode corpus schemas + the refinement loop.
- `assets/sample_episode.vtt` — a timestamped sample for demos and the self-test.
