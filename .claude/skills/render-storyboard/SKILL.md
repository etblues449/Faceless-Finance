---
name: render-storyboard
description: >
  Render a Faceless Finance storyboard.json into cinematic short-form clips using
  the Higgsfield video connector. Use when the user asks to render/produce/generate
  the actual video from a storyboard, turn a storyboard into clips, or make the
  b-roll. Runs inside a Claude Code session where the Higgsfield connector is
  available (it is NOT a standalone server — see the note below).
---

# render-storyboard

Turns the v2 `storyboard.json` produced by the faceless-finance-video agent into
real cinematic clips, one per scene, via the **Higgsfield** MCP connector.

## Why this is a skill, not a headless agent step

The Higgsfield video tools (`generate_image`, `generate_video`, `job_display`,
`balance`, `models_explore`, `show_plans_and_credits`, `show_characters`, …) are
exposed as a **Claude Code connector** scoped to the current session — there is no
reusable public URL/credential, so a Managed Agent cannot call them headlessly.
This skill therefore runs in a Claude Code session (interactive, scheduled via
`/loop`, or triggered on Claude Code web) where the connector is authenticated to
the user's Higgsfield account.

The tool names below are the connector's; in-session they are prefixed with the
connector id (e.g. `mcp__<uuid>__generate_video`). Find them with ToolSearch if
their schemas aren't loaded yet.

## Inputs

- A `storyboard.json` (v2 schema) — default `outputs/storyboard.json`. Each scene
  has: `id`, `dialogue`, `durationSec`, `type` ("cinematic"), `visualPrompt`,
  `brollKeywords`, `textOverlay`, `transition`.

## Procedure

1. **Preflight.** Call `balance` to confirm the connector is live and read
   available credits. Read the storyboard and count scenes.

2. **Estimate cost, then confirm.** For one representative scene call
   `generate_image` and `generate_video` with `get_cost: true` (no job is
   submitted). Multiply by the scene count, report the estimated total to the
   user, and DO NOT spend until they confirm — unless they already said "just
   render it". A 9:16 1k image ≈ 2 credits; a 5s `cinematic_studio_video_v2`
   clip ≈ 7.5 credits.

3. **Per scene (in order):**
   a. **Keyframe** — `generate_image`:
      - `model: "nano_banana_pro"`, `aspect_ratio: "9:16"`
      - `prompt`: the scene's `visualPrompt` verbatim (the Character Bible is
        already prepended by the agent where a person appears). Reinforce
        cinematic, observational framing — **never** talking-head / direct-to-camera.
   b. **Poll** with `job_display(id)` until `status: "completed"`; capture the
      image job id and `results.rawUrl`.
   c. **Animate** — `generate_video`:
      - `model: "cinematic_studio_video_v2"`, `aspect_ratio: "9:16"`
      - `duration`: `clamp(round(scene.durationSec), 3, 12)`
      - `medias: [{ role: "start_image", value: "<image job id>" }]`
      - `prompt`: a short motion description derived from the scene (camera move,
        subject action, light). Keep it subtle and premium; no face-to-camera.
   d. **Poll** `job_display(id)` until completed; capture the video `results.rawUrl`.

4. **Collect.** Download each image + clip to `outputs/renders/` named
   `scene_0.png` / `scene_0.mp4`, etc. Write `outputs/renders.json`:
   ```json
   {
     "storyboard": "outputs/storyboard.json",
     "scenes": [
       { "id": "scene_0", "imageUrl": "...", "imageFile": "outputs/renders/scene_0.png",
         "videoUrl": "...", "videoFile": "outputs/renders/scene_0.mp4",
         "imageJobId": "...", "videoJobId": "..." }
     ],
     "creditsSpent": <number>
   }
   ```
   Leave `storyboard.json` untouched — it stays the pure v2 source of truth.

5. **Deliver.** Send the rendered clips to the user (SendUserFile) and report
   credits spent vs. remaining (`balance`).

## Rules

- **Cinematic b-roll only.** Reject/skip any scene whose `type` is not
  "cinematic" or whose prompt implies a presenter addressing camera.
- **Consistency.** If a recurring presenter appears across scenes and a trained
  Soul exists (`show_characters action=list status=ready`), reuse its `soul_id`
  with `model: "soul_2"` for the keyframe; otherwise rely on the Character Bible
  text in `visualPrompt`.
- **Credits.** If any call returns `structuredContent.recovery_tool ==
  'show_plans_and_credits'` (out of credits), surface that to the user and stop —
  do not loop retrying.
- **Voiceover** is separate (ElevenLabs, host-side); this skill renders visuals only.
