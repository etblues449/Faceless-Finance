# Character Bible — Faceless Finance avatar

The locked-in visual description of the channel's on-camera presenter.
Use these strings verbatim wherever a tool asks for a character / avatar
description. Copy from here, do not paraphrase — consistency across renders
is what makes the channel look like one channel rather than a stitched-up
collage.

---

## SHORT version

Use this in form fields, tags, single-line "describe your avatar" prompts,
HeyGen Photo Avatar setup, etc.

```
British man, late twenties, athletic build, short cropped brown hair with subtle blonde highlights at the tips, light blue-grey eyes, strong squared jawline, defined cheekbones, well-groomed dark beard stubble (full coverage chin and jawline, kept tight), full forearm sleeve tattoos on right arm, smart-casual style (crew-neck tees, polos, fitted shirts), warm natural skin tone, direct confident gaze, approachable expression
```

---

## LONG version (canonical Character Bible)

Use this in Faceless Finance App → Settings → Character Bible, in cinematic prompt
templates (Hedra Character-2 / Veo / Sora / Runway), and anywhere a more
detailed description is supported. The cinematic providers prepend this
to every visual prompt via `applyCharacterBible()`.

```
Subject: British man, late twenties, photographed selfie-style direct-to-camera.
Build: Athletic, broad shoulders, lean.
Hair: Short, cropped on sides, slightly textured/curly on top, mid-brown
  with subtle blonde tips; clean fade above ears.
Eyes: Light blue-grey, alert, level gaze.
Face: Strong squared jawline, defined cheekbones, slightly fuller lips,
  symmetrical features, warm natural skin tone with light flush in cheeks.
Beard: Tight stubble — fully connected from sideburns through jawline and
  chin to moustache. Kept short, well-groomed, dark brown matching brows.
  Never overgrown, never patchy.
Tattoos: Full sleeve tattoo on the right forearm visible when wearing
  short-sleeves. Black-ink design, dense lower forearm coverage.
Wardrobe: Smart-casual British everyday — fitted plain tees (white, navy,
  black), Cruyff/adidas branded polos, open-collar fitted shirts (light
  grey, sage green), a thin gold chain visible at neckline, quality watch
  on left wrist. No flashy logos. No formalwear unless scene-specified.
Demeanour: Confident, friendly, direct eye contact. Slight half-smile when
  hooking the viewer. Clear, deliberate speaking style. Hands occasionally
  used for emphasis but never overgesturing.
Setting context for cinematic scenes: UK indoor or natural-light outdoor.
  Backgrounds neutral or domestic — dining tables, kitchens, garden
  benches, modern bars/restaurants. Never in a studio. Never in front of
  green screen.
```

---

## Where to use which

| Tool / Field | Version |
|---|---|
| HeyGen Photo Avatar — "Describe your avatar" | SHORT |
| HeyGen Avatar IV / appearance tags | SHORT |
| Faceless Finance App → Settings → Character Bible | LONG |
| Hedra Character-2 cinematic prompt | LONG (auto-prepended via `applyCharacterBible()`) |
| Veo 3 / Sora 2 / Runway Gen-4 subject prompt | LONG |
| Midjourney / DALL-E reference image generation | SHORT or LONG |
| Voice-cloning service "describe yourself" fields | SHORT |

---

## Best reference photo for HeyGen Photo Avatar

From the photo set, the cleanest reference for HeyGen's avatar extraction
is the **white Cruyff t-shirt selfie with the pink wall behind**, head-and-
shoulders framing, looking nearly direct-to-camera. Reasons:

- Head fills the frame
- Face is sharp, eyes pointed at lens
- Beard stubble visible clearly
- Skin tone, hair, jawline all readable
- No background distractions, no other faces
- Direct-to-camera angle matches Faceless Finance App's talking-head cinematography

If HeyGen rejects it: try the **green-shirt at-the-restaurant** photo as a
secondary — face is clean, expression is neutral.

---

## Voice (paired with this avatar)

- Provider: ElevenLabs
- Type: PVC (Professional Voice Clone)
- Voice name: `JB Blues Script`
- Voice ID: stored in Faceless Finance App → Settings → ElevenLabs Voice ID

The voice and the avatar are the channel. Don't mix in other voices or
avatars without a deliberate creative reason — consistency is the brand.
