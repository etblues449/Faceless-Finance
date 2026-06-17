# Remotion ↔ Faceless Finance integration

This Remotion project renders the **deterministic, code-driven** parts of a video
that AI generation does poorly: branded intros/outros, burned-in captions, and
animated data (tax thresholds, comparisons). The AI providers (Veo 3 / Runway)
still produce the cinematic footage; Remotion produces the graphics, and the
existing **stitch** step composites them together.

> Remotion needs a build step + headless Chrome, so it runs **server-side** —
> in `pipeline/` (Node) or CI, **not** inside `index.html`. The in-browser app
> stays no-build; it can call out to a render that happens elsewhere, or you
> pre-render these clips and drop the MP4s into the stitch input list.

## Compositions (the contract)

Each composition takes JSON props, so the **script step can drive them directly**.
Render from the CLI:

```bash
cd remotion && npm i

# Branded title card (full-frame, prepended)
npx remotion render Intro out/intro.mp4 \
  --props='{"title":"The £20,000 ISA Trick","subtitle":"UK tax-free saving","accent":"#16a34a"}'

# Animated data point (full-frame scene)
npx remotion render Chart out/chart.mp4 \
  --props='{"label":"ISA allowance (2025/26)","value":20000,"prefix":"£","accent":"#16a34a"}'

# Captions OVERLAY — transparent background, alpha codec (vp8/vp9 webm)
npx remotion render Captions out/captions.webm --codec=vp8 \
  --props='{"highlight":"#22c55e","words":[{"text":"Put","fromFrame":0},{"text":"£20k","fromFrame":8}]}'
```

| Composition | Format            | Role                         | Render to        |
| ----------- | ----------------- | ---------------------------- | ---------------- |
| `Intro`     | 1080×1920 opaque  | Title card, prepend          | `.mp4`           |
| `Chart`     | 1080×1920 opaque  | Data scene, insert           | `.mp4`           |
| `Captions`  | 1080×1920 **alpha** | Overlay on footage         | `.webm` (vp8/vp9) |

Props shape lives next to each component (`introDefaultProps`, `chartDefaultProps`,
`captionsDefaultProps` in `src/`). The Claude script step should emit a storyboard
JSON whose fields map onto these props (e.g. word-level caption timings come from
the ElevenLabs / Whisper alignment already in the pipeline).

## Where it slots into stitch

The app/pipeline already stitches scene clips with ffmpeg. The order becomes:

```
intro.mp4  →  [ai_scene_1.mp4 + captions.webm overlay]  →  chart.mp4  →  outro.mp4
```

Example ffmpeg (overlay captions onto a scene, then concat with intro/chart):

```bash
# 1) overlay alpha captions onto the AI scene
ffmpeg -i ai_scene_1.mp4 -i captions.webm \
  -filter_complex "[0:v][1:v]overlay=0:0:format=auto" scene_1_captioned.mp4

# 2) concat intro + captioned scene + chart (same codec/size/fps)
ffmpeg -f concat -safe 0 -i list.txt -c copy final.mp4
# list.txt: file 'intro.mp4' / file 'scene_1_captioned.mp4' / file 'chart.mp4'
```

In the **app's** `ffmpeg.wasm` stitch the same idea applies: add the rendered
clips to the input list and use an `overlay` filter for the alpha captions.

## Notes

- Keep everything **1080×1920 @ 30fps** so clips concat without re-encoding.
- Captions overlay must be a codec with alpha (`vp8`/`vp9` webm, or ProRes 4444).
  A plain `.mp4` (h264) has no alpha and will paint a black box.
- This is a **sketch** — the three compositions are starting points; the real
  styling/branding should follow `CHARACTER_BIBLE.md`.
