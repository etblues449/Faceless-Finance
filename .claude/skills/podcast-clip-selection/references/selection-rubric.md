# Selection Rubric — reverse-engineering the clip decision

This is the intelligence layer's core: *why those 40 seconds and not the other
7,160 in the episode*. It reverse-engineers the decisions the best podcast
teams make — where a clip starts, what context they cut, whether they moved the
payoff forward, the hook, the overlay, the format — into ten principles and a
scoring rubric the `select_clips.py` scorer approximates and you apply.

## The ten principles

A clip that goes viral almost always satisfies most of these. Score each
candidate against them.

1. **Self-contained loop.** The clip opens a question/tension and closes it
   *inside the window*. If the payoff lives 40 seconds after the clip ends, it's
   not a clip — it's a teaser with no delivery.
2. **Cold-open on the hook, not the setup.** The strongest clips start on the
   most arresting sentence. The 20 seconds of "so tell me about the early days"
   preamble is cut. Find the sentence a stranger would stop scrolling for and
   start there.
3. **Payoff-forward.** If the punchline lands late and the open is soft, the
   payoff is teased in the first 3 seconds, then delivered. Retention-obsessed
   teams do this constantly ("This one habit turned £200 into £40k — here's how").
4. **Emotional or contrarian spike.** Surprise, disagreement, a confession, a
   bold number, a counterintuitive claim. Flat agreement doesn't travel.
5. **Concrete over abstract.** Specific numbers, names, and stories beat
   generalities. "20% the day you're paid" beats "save regularly."
6. **Tight duration.** The highest-performing band is ~20–45s; 60s is a hard
   ceiling for most feeds. Every second must earn its place.
7. **Standalone comprehension.** No unresolved "as I said earlier", no dangling
   "he" / "that" with no antecedent in the window. A first-time viewer must
   fully understand it.
8. **One quotable line.** There is a single sentence that could be the title or
   the text overlay. If you can't find it, the clip is probably muddy.
9. **Speaker dynamics.** A guest revelation, a host challenge, a genuine
   disagreement, an "I've never said this before." Tension between two people
   out-performs a monologue.
10. **Button ending.** End on the payoff or a clean button — never trailing off
    into the setup for the next topic. The last line should land.

## The scoring rubric (what the script measures)

Each candidate window gets a 0–100 score. The signals and their weights:

| Signal | Weight | Proxy the script uses |
|---|---:|---|
| **Hook** | 26 | Opening sentence: hook lexicon, question form, a number, direct "you". |
| **Payoff** | 15 | Last two sentences carry a resolution marker (`because`, `that's why`, `turns out`) and/or a number. |
| **Quotable** | 14 | Exists a short (≈4–16 word) sentence bearing a strong marker → overlay candidate. |
| **Specificity** | 12 | Density of numbers, %, currency, magnitudes. |
| **Emotion** | 10 | Emotional/high-arousal lexicon hits. |
| **Contrarian** | 8 | Contrast / myth-busting / "most people" markers. |
| **Containment** | 9 | Penalises back-reference phrases and dangling-pronoun opens. |
| **Duration fit** | 6 | Bell curve peaking in the sweet-spot band. |
| **Density** | ×0.6–1.0 | Overall multiplier — rambling, marker-free windows are damped. |

These weights are the reverse-engineered prior. They are **evidence-informed,
not yet evidence-derived** — see `data-schema.md` for how a scraped clip/episode
corpus turns them into measured coefficients.

## Applying the rubric (your job in Stage 2)

The script hands you ranked windows. For each, before packaging it:

- **Verify the loop closes.** Read `text`. Is the tension resolved inside the
  window? If not, either extend `end` to include the payoff (within the max) or
  reject.
- **Tighten the cut.** The window boundary is a *start*, not gospel. Move `start`
  to the most arresting sentence; move `end` to the button. Report the tightened
  in/out to the second.
- **Check comprehension cold.** Would a first-time viewer with zero context
  understand it? A dangling "he" / "that habit" at the open means either move the
  start past it or cut it.
- **Decide payoff-forward.** Weak first 3 seconds + strong late payoff → tease
  the payoff up front. Name the exact line that moves.
- **Reject honestly.** A high score with a fatal comprehension or compliance
  problem is not a clip. Fewer, real clips beat a padded list.

## Red flags that override a high score

- Opens on an unresolved pronoun/reference with no antecedent in the window.
- The payoff is outside the window (teaser with no delivery).
- Requires prior context from earlier in the episode to make sense.
- Would only "work" by implying financial advice or a guaranteed return
  (see `FCA_COMPLIANCE_FRAMEWORK.md`) — drop it.
