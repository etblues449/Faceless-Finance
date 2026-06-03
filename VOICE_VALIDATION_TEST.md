# Voice Validation Test — Lip-sync to ElevenLabs PVC

**Issue**: #92  
**Status**: Planned  
**Goal**: Prove that Seedance 2.0 lip-sync works correctly with user's actual ElevenLabs voice clone ("JB Blues Script").

## Problem Statement

The pilot animation (5ded9460) used auto-generated AI audio (`generate_audio: true`), not user's real voice. Lip-sync quality to the actual ElevenLabs Professional Voice Clone is unverified.

## Test Plan

### 1. Script Generation (Claude)
**Goal**: Create 20–30s financial education script suitable for UK TikTok, UK accent context.

**Sample topic**: "The £100k personal allowance taper and how it affects your tax bill"

**Constraints**:
- Educational tone (no product recommendations)
- Clear phoneme articulation (no speed-talk)
- Natural pauses (no wall-of-text)
- UK references (HMRC, ISA, salary sacrifice, etc.)

**Output**: 20–30s script (140–210 words at conversational pace)

### 2. Audio Rendering (ElevenLabs PVC)
**Goal**: Generate MP3 audio from script using user's "JB Blues Script" voice.

**Settings**:
- Voice: `JB Blues Script` (Professional Voice Clone, PVC)
- Model: `eleven_flash_v2` (faster, suitable for TikTok)
- Stability: 0.5 (natural variation, not robotic)
- Similarity: 0.75 (strong identity match)

**Output**: MP3 file with user's actual voice

### 3. Soul Keyframe (Higgsfield Image)
**Goal**: Generate avatar keyframe in a generic London location (no readable signage).

**Settings**:
- Soul ID: `JB-FF-2026` (trained avatar)
- Location: Generic London street (e.g., Southwark residential street, King's Cross plaza, Thames embankment without landmarks)
- Pose: Standing, looking at camera, natural posture
- Framing: Head-and-shoulders (not full body—better for lip-sync focus)
- Time: Daytime, natural light

**Avoid**:
- Named landmarks (Savoy, Tower Bridge, Big Ben — text renders garbled)
- Complex signage
- Busy backgrounds

**Output**: Keyframe image (PNG/JPG, 1080p)

### 4. Seedance Animation (Higgsfield Video)
**Goal**: Animate avatar with audio reference for lip-sync.

**Settings**:
- Start image: Soul keyframe (from step 3)
- Audio reference: ElevenLabs MP3 (from step 2)
- Duration: Same as audio (20–30s)
- Model: `seedance_2_0`
- **Critical**: No `generate_audio` flag (use real voice, not AI audio)
- Motion hint: "Talking head, natural hand gestures, conversational tone"

**Output**: MP4 video (1080p, 9:16 or 16:9)

### 5. Lip-sync Quality Inspection
**Goal**: Frame-by-frame analysis of mouth-audio alignment.

**Method**:
1. Download MP4 output from Seedance
2. Open in browser video player (or ffmpeg)
3. Play at normal speed, assess overall sync quality
4. Slow-play at 0.5x speed, inspect mouth movements vs. phonemes
5. Note any drift, delay, or visual artifacts

**Metrics**:
- **Sync error**: Max deviation (ms) at any point in clip
- **Drift**: Whether error accumulates over time
- **Phoneme coverage**: % of phonemes with visible mouth movement
- **Artifacts**: Distortion, blur, uncanny valley issues

**Success Criteria**:
- Sync error: < 100ms at animation start
- No cumulative drift over 30s
- 80%+ phoneme coverage (mouth moves for /p/, /b/, /m/, /ch/, etc.)
- No visible distortion or uncanny valley

## Test Data

| Step | Component | Tool | Est. Credits | Constraints |
|------|-----------|------|--------|-------------|
| 1 | Script | Claude | 2 | ~25 words/100 tokens |
| 2 | Audio | ElevenLabs | 30 | 20–30s @ 25k chars/credit (PVC) |
| 3 | Keyframe | Higgsfield | 40 | Soul character, no landmarks |
| 4 | Animation | Seedance 2.0 | 150 | 20–30s, audio reference, 1080p |
| **Total** | | | **~222 cr** | One-shot test |

## Success Outcome

If lip-sync error < 100ms and no drift:
- ✅ Green light for daily posting with avatar hook (45cr per 5s sparing hero shot)
- ✅ Include in app interface (no caveats)
- ✅ Proceed with #91 (app interface build)
- ✅ Plan full production pipeline

## Fallback Plans

| Scenario | Action |
|----------|--------|
| Sync error > 100ms | Use shorter clips (< 15s), wider framing (less face close-up) |
| Cumulative drift | Test with lower motion hints (reduce hand gestures) |
| Phoneme misses | Adjust Stability (lower = more variation) |
| Uncanny valley | Use wider shot (head+torso) instead of close-up |

## Timeline

- **Session 1**: Run test (2–3 hours for 50+ min Seedance render)
- **Session 2+**: Analyze results, adjust if needed, document outcome

## Notes

- Seedance render time is ~50 min for 5s; expect 60+ min for 20–30s
- Audio reference must be MP3 (or supported format); test with standard bitrate (128–256kbps)
- Report will include video comparison (side-by-side of audio waveform + video frames)
