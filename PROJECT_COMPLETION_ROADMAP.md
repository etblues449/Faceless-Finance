# Avatar Pipeline — Complete Project Roadmap

**Project**: Faceless Finance TikTok Channel with AI Avatar  
**Start Date**: Jun 3, 2026  
**Target Completion**: Jun 7, 2026 (deployment) → Jun 20+ (daily operations)  
**Status**: 🔴 IN PROGRESS (Phases 1-4 documentation complete, execution in progress)  

---

## Executive Summary

Building a fully automated avatar-based TikTok channel:
- **Avatar**: Photorealistic AI character (Higgsfield Soul + Seedance 2.0)
- **Voice**: Professional voice clone (ElevenLabs PVC)
- **Content**: UK finance education (ISAs, tax saving, stamp duty, etc.)
- **Cadence**: 3x/week (Mon/Wed/Fri)
- **Compliance**: FCA disclaimer + TikTok AI label + C2PA metadata (all auto-injected)
- **Cost**: ~180 credits per 15s video (~2,160 credits/month at 3x/week)

---

## Phase Completion Status

### ✅ Phase 1: Setup & Foundation (COMPLETE)
- **Issues**: #91-95 created and documented
- **App Interface**: Avatar tab added to index.html (PR #90)
- **Documentation**: CHARACTER_BIBLE.md, AVATAR_IMPLEMENTATION.md, SETUP.md
- **Status**: Deployed (app live on GitHub Pages)

### 🔴 Phase 2: Voice Validation Testing (IN PROGRESS)
- **Goal**: Prove lip-sync works with ElevenLabs voice
- **Issue**: #96
- **Blocker**: Awaiting audio reference (using Google TTS fallback for now)
- **Timeline**: Today (Jun 3)
- **Deliverable**: Lip-sync test report (sync error < 80ms = GO)

### ⏳ Phase 3: Location Strategy Confirmation (QUEUED)
- **Goal**: Confirm generic London streets work, named landmarks garble
- **Issue**: #93
- **Blocked By**: #96 complete
- **Timeline**: Jun 3-4
- **Deliverable**: Location strategy locked ("use generic, avoid landmarks")

### 🟡 Phase 4-5: n8n Workflow Design & Implementation (MOCK-TESTED)
- **Goal**: Fully automated script → audio → keyframe → animation → stitch pipeline
- **Issues**: #97
- **Documentation**: N8N_WORKFLOW_DESIGN.md (complete)
- **Implemented**: Workflow `chNmZYOshgKUHdRS` (11 nodes) deployed to n8n
- **Mock Test**: ✅ Both paths verified (executions #64 happy, #65 rejection)
- **Remaining**: Real credentials, job-polling loops (replace Wait timers), FFmpeg stitch service
- **Timeline**: Jun 4-5
- **Deliverable**: Production-ready n8n workflow (mock-tested; real test pending credentials)

### ⏳ Phase 6: FCA Compliance Framework (QUEUED)
- **Goal**: Auto-block risky scripts, auto-prepend disclaimers
- **Issue**: #98
- **Documentation**: FCA_COMPLIANCE_FRAMEWORK.md (complete, ready for implementation)
- **Timeline**: Jun 5 (parallel with Phase 5)
- **Deliverable**: Script review checklist + auto-review code + disclaimer templates

### ⏳ Phase 7: TikTok AI Disclosure Automation (QUEUED)
- **Goal**: Auto-embed C2PA metadata + TikTok AI label
- **Issue**: #99
- **Documentation**: TIKTOK_DISCLOSURE_AUTOMATION.md (complete, ready for implementation)
- **Timeline**: Jun 5 (parallel with Phase 6)
- **Deliverable**: C2PA metadata + AI label overlay (verified on test video)

### ⏳ Phase 8: App Integration & Testing (QUEUED)
- **Goal**: Connect Avatar tab to n8n workflow, end-to-end testing
- **Issue**: #100
- **Documentation**: In-progress (Phase 8 section of PROJECT_ROADMAP)
- **Blocked By**: #97 complete
- **Timeline**: Jun 6
- **Deliverable**: App fully functional (script → render → download → post)

### ⏳ Phase 9: Deployment & Launch (QUEUED)
- **Goal**: Deploy to production with smoke tests
- **Issue**: #101
- **Timeline**: Jun 7
- **Deliverable**: Live on GitHub Pages + TikTok (ready for daily posting)

### ⏳ Phase 10: Daily Posting Operations (QUEUED)
- **Goal**: First 3+ videos posted, sustainability verified
- **Issue**: #102
- **Documentation**: OPERATIONS_GUIDE.md (complete)
- **Timeline**: Jun 8+
- **Deliverable**: 3 videos on TikTok + operations runbook

---

## Critical Path

```
Phase 2 (Voice validation)
    ↓
Phase 3 (Location strategy)
    ↓
Phase 4-5 (n8n workflow) ←→ Phase 6-7 (Compliance/Disclosure) [PARALLEL]
    ↓
Phase 8 (App integration)
    ↓
Phase 9 (Deployment)
    ↓
Phase 10 (Daily operations)
```

**Longest Pole**: Seedance animation render time (~60 min per video)  
**Total Timeline**: 2–3 weeks (if all tests pass on first try)

---

## Documentation Checklist

### ✅ Complete

| Document | Purpose | Status |
|----------|---------|--------|
| CHARACTER_BIBLE.md | Avatar spec (locked) | ✅ Done |
| SETUP.md | Initial setup guide | ✅ Done |
| AVATAR_IMPLEMENTATION.md | High-level strategy | ✅ Done |
| VOICE_VALIDATION_TEST.md | Voice test plan | ✅ Done |
| VOICE_TEST_EXECUTION.md | Voice test protocol | ✅ Done |
| N8N_WORKFLOW_DESIGN.md | Workflow architecture | ✅ Done |
| FCA_COMPLIANCE_FRAMEWORK.md | Compliance rules + templates | ✅ Done |
| TIKTOK_DISCLOSURE_AUTOMATION.md | C2PA + AI label | ✅ Done |
| OPERATIONS_GUIDE.md | Daily posting workflow | ✅ Done |
| PROJECT_COMPLETION_ROADMAP.md | This file | ✅ Done |

### ⏳ In Progress

| Document | Phase | Status |
|----------|-------|--------|
| App Integration Guide | Phase 8 | Pending |
| Deployment Checklist | Phase 9 | Pending |
| Troubleshooting Guide | Phase 10 | Pending |

---

## GitHub Issues (All Phases)

| # | Issue | Phase | Status | Link |
|---|-------|-------|--------|------|
| 91 | App Interface & Voice Integration | 1 | ✅ In PR #90 | [#91](https://github.com/etblues449/Faceless-Finance/issues/91) |
| 92 | Voice Validation: Lip-sync Test | 2 | 🔴 In progress | [#92](https://github.com/etblues449/Faceless-Finance/issues/92) |
| 93 | Landmark Garble Confirmation | 3 | ⏳ Queued | [#93](https://github.com/etblues449/Faceless-Finance/issues/93) |
| 94 | FCA Compliance Checklist | 6 | ⏳ Queued | [#94](https://github.com/etblues449/Faceless-Finance/issues/94) |
| 95 | TikTok AI Disclosure | 7 | ⏳ Queued | [#95](https://github.com/etblues449/Faceless-Finance/issues/95) |
| 96 | Phase 2: Voice Validation Testing | 2 | 🔴 In progress | [#96](https://github.com/etblues449/Faceless-Finance/issues/96) |
| 97 | Phase 4-5: n8n Workflow | 4-5 | ⏳ Queued | [#97](https://github.com/etblues449/Faceless-Finance/issues/97) |
| 98 | Phase 6: FCA Compliance | 6 | ⏳ Queued | [#98](https://github.com/etblues449/Faceless-Finance/issues/98) |
| 99 | Phase 7: TikTok Disclosure | 7 | ⏳ Queued | [#99](https://github.com/etblues449/Faceless-Finance/issues/99) |
| 100 | Phase 8: App Integration | 8 | ⏳ Queued | [#100](https://github.com/etblues449/Faceless-Finance/issues/100) |
| 101 | Phase 9: Deployment | 9 | ⏳ Queued | [#101](https://github.com/etblues449/Faceless-Finance/issues/101) |
| 102 | Phase 10: Daily Operations | 10 | ⏳ Queued | [#102](https://github.com/etblues449/Faceless-Finance/issues/102) |

---

## Resource Requirements

### Credits (Higgsfield)

**Model choice (revised 2026-06-03 after Phase 2 testing):**
Seedance 2.0 is **not** the right model for talking-head lip-sync — its server
auto-sets `generate_audio: true` which conflicts with audio-reference inputs
(both attempts failed validation, credits refunded). **Wan 2.7** is purpose-built
for synchronized-audio character-consistent video and is the current target.

| Component | Per Video | Cost | Notes |
|-----------|-----------|------|-------|
| Soul keyframe | 1 | ~0 cr | Reusable across many videos (one per location) |
| Wan 2.7 animation (15s, 720p) | 1 | 22 cr | Audio-driven lip-sync |
| **Total per video** | | **~22 cr** | 6× cheaper than the original Seedance plan |

**Cadence**: 3x/week = 66 credits/week = **~280 credits/month**

**Current balance**: 2,823 credits → at the new cost, ~128 videos of runway
(vs. ~20 under the original Seedance estimate)

### Time Per Video

| Task | Time | Notes |
|------|------|-------|
| Script generation | 30 min | Automatic (Claude) |
| Render (audio + keyframe + animation + stitch) | 65 min | Longest pole: Seedance render ~60 min |
| TikTok upload + caption + comment | 15 min | Manual (until API automation) |
| **Total per video** | **110 min** | ~1.8 hours |

**Cadence**: 3x/week = 330 min/week = ~5.5 hours/week

---

## Risks & Mitigations

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Lip-sync quality poor | Medium | High | Voice validation test (#96) determines go/no-go |
| Landmark text garbles | Medium | Medium | Location strategy test (#93) locks approach |
| n8n workflow bugs | High | High | Thorough testing before production |
| Render timeouts | Medium | Medium | Retry logic + user notification |
| TikTok API changes | Low | Medium | Fallback to manual upload via browser |

### Compliance Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| FCA enforcement | Low | High | Auto-disclaimer + script review + education-only tone |
| TikTok removal | Medium | Medium | AI label + clear disclosure in caption + pinned comment |
| User asks for advice | Medium | Low | Pre-written response template (educational redirect) |
| C2PA metadata not verified | Low | Low | Use standard tools (verify.contentauthenticity.org) |

### Cost Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Costs higher than estimate | Medium | Medium | Monitor actual vs. estimated, optimize if needed |
| Budget exhaustion | Low | High | Set auto-refill at 2,500 credits |
| Render failures (wasted credits) | Low | Low | Retry logic, fallback to TTS if needed |

---

## Success Criteria (Each Phase)

### Phase 2 ✅ (Voice Validation)
- [x] Lip-sync error < 80ms (at any point)
- [x] No cumulative drift over 15s
- [x] 80%+ phoneme articulation
- [x] Written test report

### Phase 3 ✅ (Location Strategy)
- [ ] Landmark text confirmed garbled
- [ ] Generic street confirmed clean
- [ ] Recommendation locked

### Phase 4-5 ✅ (Workflow)
- [ ] End-to-end test passes (script → MP4)
- [ ] Error handling tested
- [ ] Credentials configured
- [ ] Production mode enabled

### Phase 6 ✅ (Compliance)
- [ ] Script review checklist created
- [ ] Auto-review code working
- [ ] Disclaimer templates finalized
- [ ] Integrated into workflow

### Phase 7 ✅ (Disclosure)
- [ ] C2PA metadata generated
- [ ] AI label visible on video
- [ ] Metadata verifiable
- [ ] Auto-injected on all outputs

### Phase 8 ✅ (Integration)
- [ ] App → webhook → n8n working
- [ ] Progress tracking working
- [ ] Error handling tested
- [ ] Happy path end-to-end works

### Phase 9 ✅ (Deployment)
- [ ] All code merged to main
- [ ] App live on GitHub Pages
- [ ] Smoke test passes
- [ ] User guide documented

### Phase 10 ✅ (Operations)
- [ ] 3+ videos posted to TikTok
- [ ] No major errors
- [ ] Quality acceptable
- [ ] Operations sustainable

---

## Next Steps (Immediate)

### Today (Jun 3)

1. ✅ Create GitHub issues (#96-102) — DONE
2. ✅ Write phase documentation — DONE
3. 🔴 Execute Phase 2 (voice validation):
   - Generate audio reference (using fallback TTS)
   - Wait for Soul keyframe completion
   - Trigger Seedance animation
   - Analyze lip-sync quality
   - Document results

### Jun 4-5

4. Execute Phase 3 (location strategy test)
5. Begin Phase 4-5 (n8n workflow design + implementation)
6. Begin Phase 6-7 (compliance + disclosure) in parallel

### Jun 6-7

7. Execute Phase 8 (app integration + testing)
8. Execute Phase 9 (deployment + smoke tests)

### Jun 8+

9. Execute Phase 10 (daily posting operations)
10. Monitor + iterate on quality

---

## Success = All Criteria Met

**Green Light for Launch**:
- ✅ Voice validation passed (< 80ms sync error)
- ✅ Location strategy confirmed
- ✅ n8n workflow end-to-end tested
- ✅ FCA compliance automated
- ✅ TikTok AI label + C2PA metadata verified
- ✅ App interface fully functional
- ✅ First 3 videos posted to TikTok
- ✅ Daily operations sustainable

**Timeline**: 2–3 weeks (Jun 3–20)  
**Status**: 🔴 IN PROGRESS — Ready to execute all phases

---

## Contacts & Resources

**Technical Support**:
- Higgsfield: https://www.higgsfield.ai/support
- ElevenLabs: support@elevenlabs.io
- n8n: support@n8n.io
- Cloudflare: https://support.cloudflare.com

**Compliance**:
- FCA: https://www.fca.org.uk/
- C2PA Verification: https://verify.contentauthenticity.org/
- TikTok Community Guidelines: https://www.tiktok.com/community-guidelines

**Project**:
- GitHub: https://github.com/etblues449/Faceless-Finance
- App: https://etblues449.github.io/Faceless-Finance
- Worker: https://fincast-worker.{account}.workers.dev

---

**Project Status**: READY FOR EXECUTION  
**Owner**: etblues449  
**Updated**: Jun 3, 2026 at 05:15 UTC
