# Avatar Implementation Strategy

**Goal**: Build a faceless TikTok channel with a photorealistic AI avatar (Higgsfield Soul + Seedance 2.0) walking/talking on London streets, with natural lip-sync to user's actual voice.

**Status**: In Progress  
**Latest**: Avatar app interface added (PR #90), validation tests planned

---

## Architecture Overview

```
User Script Input
       ↓
┌─────────────────────────────────────┐
│     Avatar Pipeline (n8n)            │
├─────────────────────────────────────┤
│ 1. Claude: Script refinement         │
│ 2. ElevenLabs: Voice rendering       │
│ 3. Higgsfield Soul: Keyframe gen     │
│ 4. Higgsfield Seedance: Animation    │
│ 5. FFmpeg: Stitch + metadata         │
│ 6. TikTok: C2PA labels + AI tag      │
└─────────────────────────────────────┘
       ↓
   MP4 Output
    (1080p, with AI disclosure)
```

## Current Implementation Status

### ✅ Phase 1: App Interface (PR #90)

**Avatar tab** added to index.html with:
- **Voice selector**: ElevenLabs PVC, alt voices, TTS fallback
- **Script input**: Textarea for manual paste or generation from Script tab
- **Render button**: One-click trigger to n8n webhook
- **Character reference**: Locked avatar spec (linked to CHARACTER_BIBLE.md)

**Flow**:
```javascript
User taps "Render Avatar Video"
  ↓
App sends {script, voice, soul_id, location_hint, duration_hint}
  ↓
n8n webhook receives (source: 'avatar-pipeline')
  ↓
n8n routes to avatar sub-workflow (TBD)
```

### ⏳ Phase 2: Validation Tests (Issues #92–#93)

**#92 — Voice Validation** (Planned)
- Test lip-sync with real ElevenLabs audio
- 20–30s script → ElevenLabs PVC → Seedance animation
- Measure sync error, drift, phoneme coverage
- Success: < 100ms error, no cumulative drift

**#93 — Landmark Garble Confirmation** (Planned)
- Re-test on generic London street (no readable text)
- Confirm that avoid-landmark strategy works
- Lock location strategy for future renders

### ⚠️ Phase 3: Backend Workflow (Not yet started, Issue #91)

**n8n Workflow**: Handle `source: 'avatar-pipeline'` payloads
- Route script → Claude refinement
- Generate audio (ElevenLabs PVC)
- Create keyframe (Higgsfield Soul image)
- Animate (Seedance 2.0 with audio reference)
- Stitch (FFmpeg + Cloudflare Worker)
- Output: MP4 with metadata

**Key Design Decisions**:
- **Voice flexibility**: User can swap voice (clone → professional → TTS) without re-scripting
- **Audio-synced lip-sync**: Seedance audio reference must match playback audio
- **Location strategy**: Generic London streets, avoid landmark text garble
- **Character lock**: Avatar spec (CHARACTER_BIBLE.md) is immutable across renders

### ⚠️ Phase 4: Compliance (Issues #94–#95, Not yet started)

**#94 — FCA Compliance Checklist**
- Auto-prepend FCA disclaimer ("Educational content only. Not financial advice.")
- Script review template (blocks product recommendations, guaranteed-returns claims)
- Caption template with auto-pinned FCA disclaimer

**#95 — TikTok AI Disclosure Automation**
- Embed C2PA Content Credentials (provenance XML)
- Inject TikTok AI label overlay (bottom-right badge)
- Auto-submit with C2PA metadata + AI label on publish

---

## Technical Decisions

### Voice Strategy

**Primary**: ElevenLabs Professional Voice Clone ("JB Blues Script")
- Trained on user's audio samples
- High-quality, identity-faithful
- Used for hero shots (5–15s) where lip-sync matters most

**Fallback**: ElevenLabs other professional voices or Google TTS
- If PVC unavailable or cost-prohibitive
- User can select in avatar UI voice dropdown

### Location Strategy

**Learned from Pilot**: Landmark text renders as garbled (Savoy → "SIAVOB")

**Solution**: Generic London backdrops
- Residential streets (Southwark, Whitechapel, King's Cross)
- Parks + embankments (Thames, St. James's Park)
- Commercial plazas (Piccadilly, Leicester Square)
- **Rule**: No readable signage in frame

**Framing**:
- Head-and-shoulders (focus on lip-sync for hero shot)
- B-roll of locations/stock footage for body of video
- VoiceOver + captions carry narrative (avatar hook only 3–5s)

### Render Strategy

**Sparing hero approach** (cost-effective):
```
3–5s: Avatar hook (full motion, lip-synced, ~45 credits)
10–20s: B-roll + captions (location B-roll, ~0 credits, user-provided)
5s: Outro (avatar or text, ~45 credits)
---
Total: ~90–180 credits per 60s video
vs. all-avatar (~400+ credits)
```

### Compliance Strategy

**FCA**: Education-only framing
- "This video explains UK tax saving, ISAs, stamp duty changes."
- Never: "You should do X," "Guaranteed returns," product recommendations
- Pre-baked disclaimer in every video

**TikTok**: AI disclosure mandatory
- C2PA metadata (Soul ID, Seedance version, audio source)
- Visible AI label (bottom-right corner, transparent badge)
- Auto-posted on publish

---

## Workstreams & Dependencies

| Issue | Title | Type | Blocker | Status |
|-------|-------|------|---------|--------|
| #91 | App Interface & Voice Integration | Epic | – | 🟢 In PR #90 |
| #92 | Voice Validation: Lip-sync Test | Validation | #91 | 🟡 Planned |
| #93 | Landmark Garble Confirmation | Validation | #91 | 🟡 Planned |
| #94 | FCA Compliance Checklist | Compliance | #91 | ⚠️ Blocked |
| #95 | TikTok AI Disclosure Automation | Compliance | #91 | ⚠️ Blocked |

**Critical Path**:
1. Merge PR #90 (avatar app interface)
2. Run #92 voice validation test (inform app design)
3. Confirm #93 location strategy
4. Build #94 compliance framework
5. Automate #95 TikTok disclosure
6. Deploy n8n workflow backend
7. Launch pilot daily posting

**Estimate**: 2–3 weeks for full implementation (assuming tests pass without rework)

---

## Cost Analysis (Actual Spend)

**Pilot (completed)**:
- Soul keyframe: 40 cr
- Seedance animation (5s): 150 cr
- **Total**: 190 cr

**Voice validation test (#92, ~1 test)**:
- Claude script: 2 cr
- ElevenLabs audio: 30 cr
- Soul keyframe: 40 cr
- Seedance (20–30s): 150 cr
- **Total**: ~222 cr

**Daily posting (conservative)**:
- 3 videos/week × 90 credits/video = 270 cr/week = **~1,080 cr/month**

**Optimization potential**:
- Reduce Seedance render time (shorter clips, lower res)
- Batch Soul keyframes (similar locations, one render for multiple angles)
- Cache B-roll (reduce per-video cost)
- TikTok repurposing (same video → YouTube Shorts, Instagram Reels, no regeneration)

---

## Next Immediate Steps

1. **Execute voice validation test** (#92)
   - Generate 20–30s script
   - Render ElevenLabs audio + Soul keyframe + Seedance animation
   - Inspect lip-sync quality
   - Document outcome

2. **Confirm location strategy** (#93)
   - Test generic London street (no landmarks)
   - Verify text garble is landmark-specific

3. **Design n8n workflow** (Phase 3)
   - Sketch nodes: script → audio → keyframe → animation → stitch
   - Decide on looping (real-time vs. batch) vs. async

4. **Build compliance framework** (Phase 4)
   - FCA disclaimer template
   - Script review checklist
   - TikTok AI label overlay spec

---

## References

- **Character Bible**: CHARACTER_BIBLE.md (locked avatar spec)
- **Setup & Secrets**: SETUP.md (Worker deployment, key management)
- **Architecture**: CLAUDE.md (app + worker + pipeline)
- **Voice Test**: VOICE_VALIDATION_TEST.md (detailed test plan)
