# Avatar Pipeline Execution Log

**Start Date**: 2026-06-03 04:55 UTC  
**Target Completion**: 2026-06-07  
**Status**: 🔴 IN PROGRESS  

---

## Phase 2: Voice Validation Test Execution

### Challenge
User's ElevenLabs credentials unavailable. Proceeding with:
1. Generate synthetic audio reference (Google TTS fallback)
2. Complete lip-sync test with available audio
3. Document results + go/no-go recommendation

### Step 1: Audio Generation (Workaround)

Since ElevenLabs PVC unavailable, I'll use Google Cloud Text-to-Speech as reference audio.

**Script** (15s):
```
Most people get the £100k personal allowance taper completely wrong. 
Let me explain how it actually works. If you earn over £100,000, you lose £1 
of allowance for every £2 above that threshold. So at £125k, you've lost it all. 
This creates a 60% marginal tax rate—higher than the standard 45%. That's the hidden trap. 
The fix? Salary sacrifice. Follow for more.
```

**Audio Reference**: Will use Google TTS with en-GB voice (male)
**Duration**: ~15 seconds
**Purpose**: Serve as audio reference for Seedance lip-sync animation

### Step 2: Soul Keyframe Status

**Job ID**: 9685f267-3273-4eda-8dca-c77fa4ce9d21  
**Model**: Soul V2 (text2image_soul_v2)  
**Status**: ✅ COMPLETE  
**Image URL**: https://d8j0ntlcm91z4.cloudfront.net/user_3DTLmgHXqDZdcq1wpnNDD4pHteF/hf_20260603_044007_9685f267-3273-4eda-8dca-c77fa4ce9d21.png  
**Location**: Generic London street (Southwark residential area, brick buildings, neutral background)  
**Frame**: Head-and-shoulders, looking at camera, confident friendly expression, ready to speak  

### Step 3: Seedance Animation Ready

Keyframe complete. Now triggering Seedance 2.0 animation with test audio reference.

**Parameters**:
- Start image: Keyframe (9685f267-3273-4eda-8dca-c77fa4ce9d21)
- Duration: 15 seconds
- Aspect ratio: 9:16
- Resolution: 1080p
- Mode: standard (audio-reference lip-sync)

---

## Current Status (2026-06-03 05:00 UTC)

**Phase 2**: Keyframe ready ✅. Audio reference blocked.  
**Phase 4-5**: n8n Workflow implemented ✅  
  - Workflow ID: chNmZYOshgKUHdRS
  - 11 nodes: webhook trigger → FCA review → (approved: audio→keyframe→animation→stitch→response | rejected: error response)
  - Credentials: Manual configuration required for ElevenLabs + Higgsfield APIs

**Status Summary**:
- ✅ Soul keyframe generated (9685f267-3273-4eda-8dca-c77fa4ce9d21)
- ✅ n8n orchestration workflow designed and deployed
- ✅ **Workflow mock-tested — both paths verified** (see below)
- ⏳ Audio reference needed for Phase 2 completion
- ⏳ Credentials need configuration in n8n (ElevenLabs + Higgsfield)
- ⏳ Phase 3 (location strategy) + Phase 6-7 (compliance/disclosure) ready for implementation

### Phase 4-5 Mock Test Results (2026-06-03 05:02 UTC)

Workflow `chNmZYOshgKUHdRS` tested with pin data (external APIs simulated):

| Test | Input | Execution | Result | Verdict |
|------|-------|-----------|--------|---------|
| Happy path | Clean tax-education script | #64 | APPROVED → audio → keyframe → wait (paused on timer) | ✅ Pass |
| Rejection path | Script with banned phrases | #65 | FCA_VIOLATION (5 caught) → 400 error response | ✅ Pass |

**Key validation**: The FCA gate blocks non-compliant scripts BEFORE any generation
API is called — zero credits wasted on rejected content. Rejection test caught:
`guaranteed returns`, `should buy`, `i recommend`, `you should`, `best option`.

**Remaining for production**: configure real ElevenLabs + Higgsfield credentials,
replace Wait-node timers with proper job-status polling loops, wire the Stitch node
to a real FFmpeg service.

---

## Phase 2 Real Render — IN FLIGHT (2026-06-03 05:17 UTC)

User supplied 5 voice files via uploads. Selected `a916aa0b-4.m4a` (1:55, shortest = most focused take). Trimmed with FFmpeg to seconds 3–18 to skip intro silence, mono 44.1kHz AAC. Uploaded to Higgsfield as audio media. Seedance render fired.

### Render Attempts

**Attempt 1 — Seedance 2.0 @ 1080p std (FAILED — refunded)**
- Job: `222b410c-15c2-46d7-881d-9cd19bc0a899`
- Failed in ~23s; root cause: server auto-set `generate_audio: true`
  which conflicts with passing an audio reference (mutually exclusive).
- 135 credits refunded.

**Attempt 2 — Seedance 2.0 @ 720p std (FAILED — refunded)**
- Job: `a1f5c7d7-636d-4cb5-88a7-463bad488dc0`
- Same auto-applied `generate_audio: true` conflict.
- Credits refunded.

**Attempt 3 — Wan 2.7 @ 720p (IN FLIGHT)**
- Job: `e7a6c9f6-0f9a-4a02-a580-50171109d83b`
- Model selected because its description literally says "Synchronized
  audio, character-consistent video" and audio is a first-class media role.
- Status: `pending`
- No conflicting params auto-applied
- Cost: 22.5 credits (6× cheaper than Seedance)
- Same inputs: keyframe `9685f267…` + audio `6cd8b16f…`
- Spec: 720p, 9:16, 15s

### Lesson Captured

Seedance 2.0's `generate_audio` auto-default conflicts with audio reference.
For talking-head lip-sync, use **Wan 2.7** (purpose-built for sync+audio)
or pre-validate Seedance params to ensure `generate_audio: false` is forced.

### Acceptance Criteria

When render completes:
- [ ] Video downloads cleanly
- [ ] Avatar identity matches Soul keyframe (JB-FF-2026)
- [ ] Lip movement tracks audio waveform (sync error < 100ms)
- [ ] No cumulative drift across 15s
- [ ] Face shows natural micro-expressions, not frozen
- [ ] Background stays generic (no landmark text garbling)

If all ✅ → Phase 2 PASSED → Phase 4-5 ready for real (non-mock) execution.
If sync fails → fall back to ElevenLabs PVC path (cleaner audio source).
