# Voice Validation Test #92 — Execution Record

**Status**: In Progress  
**Test Date**: 2026-06-03  
**Goal**: Prove Seedance 2.0 lip-sync works with ElevenLabs PVC audio

---

## Constraint Discovered

Seedance 2.0 max duration: **15 seconds** (not 30s as originally planned)

**Adjustment**: Use shorter test script (hook + opening body)

---

## Adjusted Test Script (15s version)

```
[HOOK - 0:00–0:05]
"Most people get the £100k personal allowance taper completely wrong. Let me explain how it actually works."

[BODY - 0:05–0:15]
"If you earn over £100,000, you lose £1 of allowance for every £2 above that threshold. So at £125k, you've lost it all. This creates a 60% marginal tax rate—higher than the standard 45%. That's the hidden trap. The fix? Salary sacrifice. Follow for more."

[Duration: ~15 seconds at conversational pace]
[Word count: ~95 words]
[Character count: ~560 characters]
```

---

## Execution Steps (User Must Complete)

### Step 1: Generate ElevenLabs Audio ✅
**What**: Render the 15s test script using "JB Blues Script" PVC

**Tools**: ElevenLabs API (`POST /v1/text-to-speech`)
- Voice ID: `JB Blues Script` (or equivalent PVC voice ID in your account)
- Text: [Script above]
- Model: `eleven_flash_v2`
- Stability: `0.5`
- Similarity: `0.75`

**Output**: MP3 file (~150 KB for 15s)

**How to get MP3 URL**:
- Download from ElevenLabs dashboard, OR
- Use API to fetch from signed S3 URL, OR
- Upload directly to Higgsfield via media_upload

### Step 2: Upload Audio to Higgsfield (Optional if using S3 URL)
**If audio is local**: Use `media_upload` → `media_confirm` to get media ID
- File: MP3 (from Step 1)
- Type: audio
- Returns: `media_id` (UUID)

### Step 3: Wait for Soul Keyframe ✅
**Status**: Job ID `9685f267-3273-4eda-8dca-c77fa4ce9d21` (pending)
- Soul: JB-FF-2026
- Prompt: Generic London street (Southwark, no landmarks)
- Output: Keyframe image (when ready)

### Step 4: Create Seedance Animation
**When**: After audio (Step 1) + keyframe (Step 3) are ready

**Call**:
```python
generate_video(
  model="seedance_2_0",
  prompt="Talking head: British man speaking to camera about UK personal finance. Natural hand gestures, conversational tone, head-and-shoulders framing.",
  medias=[
    {"role": "start_image", "value": "<keyframe_job_id_from_step_3>"},
    {"role": "audio", "value": "<audio_media_id_from_step_2>"}  # or S3 URL
  ],
  duration=15,
  aspect_ratio="9:16",
  resolution="1080p"
)
```

**Expected output**: MP4 video (Seedance will animate avatar to match audio for lip-sync)

### Step 5: Inspect & Document
**Frame-by-frame analysis**:
1. Download MP4 from Step 4
2. Play in browser or ffmpeg
3. Compare mouth movements to audio phonemes at key timestamps:
   - t=1.5s: "Most" (M sound) — lips should round/close
   - t=3.0s: "taper" (T, P sounds) — lips should show articulation
   - t=7.5s: "allowance" (L, W sounds) — lips position for /w/ glide
   - t=9.0s: "threshold" (TH sound) — lips/teeth visibility
4. Measure offset:
   - If mouth moves BEFORE audio → negative offset (lag)
   - If mouth moves AFTER audio → positive offset (lead)
   - Acceptable range: ±80ms

---

## Current Progress

| Step | Task | Status | Notes |
|------|------|--------|-------|
| 1 | ElevenLabs audio | ⏳ Blocked | Needs user ElevenLabs API call |
| 2 | Audio upload | ⏳ Blocked | After Step 1 complete |
| 3 | Soul keyframe | ⏳ Pending | Job: 9685f267-3273-4eda-8dca-c77fa4ce9d21 |
| 4 | Seedance animation | ⏳ Blocked | After Steps 1–3 complete |
| 5 | Quality inspection | ⏳ Pending | After Step 4 complete |

---

## Success Criteria

- ✅ Mouth movements visible in keyframe (not blank/distorted)
- ✅ Audio-to-video sync error < 80ms (acceptable for TikTok)
- ✅ No cumulative drift over 15s
- ✅ Phoneme articulation matches audio (80%+ coverage)
- ✅ No uncanny valley / distortion artifacts

**If all ✅**: Proceed with app deployment + daily posting strategy  
**If any ✗**: Adjust (shorter clips, wider framing, different motion hints)

---

## Cost Summary

| Component | Credits | Notes |
|-----------|---------|-------|
| Soul keyframe | 40 | Being generated |
| Seedance 15s | 100 | (estimate for 15s vs 150 for 30s) |
| Total | ~140 | Conservative estimate |

---

## Next Actions

1. **User**: Generate ElevenLabs audio for 15s script (Step 1)
2. **User**: Provide audio URL or upload to Higgsfield (Step 2)
3. **Claude**: Trigger Seedance animation (Step 4)
4. **Claude**: Download + analyze output (Step 5)
5. **Document**: Record metrics and recommendation

**Timeline**: ~4 hours (accounting for Seedance render time)
