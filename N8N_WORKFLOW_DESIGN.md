# n8n Workflow Design — Avatar Pipeline Backend

**Phase**: 4-5  
**Status**: 🔴 Ready for Implementation  
**Purpose**: Orchestrate script → audio → keyframe → animation → stitch pipeline  

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    n8n Avatar Workflow                        │
└──────────────────────────────────────────────────────────────┘

1️⃣ HTTP Trigger
   ↓
   POST /webhook/avatar-pipeline
   Body: {script, voice, soul_id, location_hint, duration_hint}
   
2️⃣ Parse & Validate
   ↓
   Extract: script, voice, soul_id, location_hint
   Validate: script not empty, voice in [pvc, pro, tts]
   
3️⃣ Script Review (Claude)
   ↓
   Check for FCA violations:
   - NO "guaranteed", "should buy", "I recommend"
   - YES education-only tone
   Status: APPROVED or REJECTED
   
4️⃣ [IF REJECTED] Error Response
   ↓
   Webhook → App: {status: 'FCA_VIOLATION', violations: [...]}
   END
   
5️⃣ [IF APPROVED] Audio Generation (ElevenLabs)
   ↓
   Call ElevenLabs API
   Voice: elevenlabs-pvc OR elevenlabs-pro OR google-tts
   Output: MP3 URL
   
6️⃣ Soul Keyframe (Higgsfield)
   ↓
   Create Soul image
   Soul ID: 64da88e0-fe5f-4af6-a2da-3b8de23fad64 (JB-FF-2026)
   Location: location_hint ("generic-london-street")
   Output: Image job ID
   
7️⃣ Wait for Keyframe
   ↓
   Poll job status (max 5 min)
   On timeout: Fail + notify app
   
8️⃣ Seedance Animation (Higgsfield)
   ↓
   Create animation
   Start image: keyframe (from step 6)
   Audio reference: MP3 URL (from step 5)
   Duration: duration_hint
   Output: Video job ID
   
9️⃣ Wait for Animation
   ↓
   Poll job status (max 90 min)
   On timeout: Fail + notify app
   Update app: "Still rendering... ETA: X min"
   
🔟 Stitch & Metadata (FFmpeg)
   ↓
   Add overlays:
   - FCA disclaimer (text overlay, bottom)
   - TikTok AI label (SVG, bottom-right)
   Generate C2PA metadata
   Output: Final MP4
   
1️⃣1️⃣ Store Result (S3)
   ↓
   Upload MP4 to S3
   Store metadata JSON
   Output: Public S3 URL
   
1️⃣2️⃣ Success Response
   ↓
   Webhook → App
   {
     status: 'success',
     video_url: 'https://s3/.../video.mp4',
     duration: 15,
     metadata: {...}
   }
   END
```

---

## Node Specifications

### 1. HTTP Trigger
```
Method: POST
Path: /webhook/avatar-pipeline
Headers: Content-Type: application/json
Body Schema:
{
  "source": "avatar-pipeline" (validate),
  "script": "string (min 10 chars, max 2000 chars)",
  "voice": "enum: elevenlabs-pvc|elevenlabs-pro|google-tts",
  "soul_id": "string (optional, default: JB-FF-2026)",
  "location_hint": "string (optional, default: generic-london-street)",
  "duration_hint": "number (optional, calculated from script length)"
}
```

### 2. Script Review (Code Node)
```javascript
// Check for FCA violations
const script = msg.payload.script.toLowerCase();

const dangerous = [
  'guaranteed returns', 'guaranteed profit',
  'should buy', 'should invest',
  'i recommend', 'i advise',
  'you need', 'you should',
  'best choice', 'best option',
  'everyone should'
];

const violations = dangerous.filter(phrase => script.includes(phrase));

if (violations.length > 0) {
  return {
    status: 'FCA_VIOLATION',
    violations: violations,
    message: `Script contains risky claims: ${violations.join(', ')}. Rewrite without product recommendations.`
  };
}

return { status: 'APPROVED', script: msg.payload.script };
```

### 3. ElevenLabs Audio Node
```
Endpoint: https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
Method: POST
Auth: Bearer {{ $secrets.ELEVENLABS_KEY }}

Headers:
  Content-Type: application/json

Body:
{
  "text": "{{ $node['Script Review'].json.script }}",
  "model_id": "eleven_flash_v2",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75
  }
}

Parse Response:
{
  audio_url: response.url OR generate presigned S3 URL
}
```

### 4. Higgsfield Soul Node
```
Endpoint: https://api.higgsfield.ai/v1/models/text2image_soul_v2/jobs
Method: POST
Auth: Bearer {{ $secrets.HIGGSFIELD_KEY }}

Body:
{
  "prompt": "Standing on {{ $node['Input'].json.location_hint }} London street, head-and-shoulders, looking at camera, confident friendly expression, daytime natural light. No landmarks, no readable signage.",
  "soul_id": "64da88e0-fe5f-4af6-a2da-3b8de23fad64",
  "aspect_ratio": "3:4",
  "quality": "2k"
}

Return:
{
  job_id: response.job_id
}
```

### 5. Wait for Keyframe (Wait Node)
```
Config:
  Max wait time: 5 minutes
  Check interval: 10 seconds
  Timeout behavior: Fail
```

### 6. Higgsfield Seedance Node
```
Endpoint: https://api.higgsfield.ai/v1/models/seedance_2_0/jobs
Method: POST
Auth: Bearer {{ $secrets.HIGGSFIELD_KEY }}

Body:
{
  "prompt": "Talking head: British man speaking to camera about UK personal finance. Natural hand gestures, conversational tone, head-and-shoulders framing.",
  "medias": [
    {
      "role": "start_image",
      "value": "{{ $node['Higgsfield Soul'].json.job_id }}"
    },
    {
      "role": "audio",
      "value": "{{ $node['ElevenLabs'].json.audio_url }}"
    }
  ],
  "duration": "{{ $node['Input'].json.duration_hint }}",
  "aspect_ratio": "9:16",
  "resolution": "1080p",
  "mode": "std"
}

Return:
{
  job_id: response.job_id
}
```

### 7. Wait for Animation (Wait Node)
```
Config:
  Max wait time: 90 minutes
  Check interval: 60 seconds
  Timeout behavior: Notify + Fail
```

### 8. FFmpeg Stitch Node (Code or HTTP)
```javascript
// Add FCA disclaimer overlay + TikTok AI label
// Call Cloudflare Worker or local FFmpeg

const videoUrl = msg.seedance_video_url;
const script = msg.script;
const duration = msg.duration;

const stitchPayload = {
  video_url: videoUrl,
  fca_disclaimer: "Educational content. Not financial advice. Consult an FCA-authorised advisor.",
  ai_label: "🤖 AI-Generated",
  c2pa_metadata: {
    soul_id: "64da88e0-fe5f-4af6-a2da-3b8de23fad64",
    seedance_version: "2.0",
    audio_source: msg.voice,
    timestamp: new Date().toISOString()
  }
};

// Call stitch endpoint (FFmpeg as a service)
// Returns: final_mp4_url
```

### 9. Store to S3 (HTTP Node)
```
Method: PUT
URL: https://[bucket].s3.amazonaws.com/{{ uuid }}.mp4
Auth: AWS Signature v4

Headers:
  Content-Type: video/mp4
  x-amz-acl: public-read

Body: Binary (MP4 file)

Return:
{
  s3_url: response.location
}
```

### 10. Success Response (HTTP Callback)
```
Method: POST
URL: {{ $secrets.APP_WEBHOOK_URL }} (app execution tracker)

Body:
{
  "source": "avatar-pipeline",
  "status": "success",
  "video_url": "{{ $node['Store to S3'].json.s3_url }}",
  "duration_seconds": {{ $node['Input'].json.duration_hint }},
  "metadata": {
    "soul_id": "64da88e0-fe5f-4af6-a2da-3b8de23fad64",
    "soul_name": "JB-FF-2026",
    "voice": "{{ $node['Input'].json.voice }}",
    "seedance_version": "2.0",
    "timestamp": "{{ new Date().toISOString() }}"
  },
  "compliance": {
    "fca_disclaimer_added": true,
    "tiktok_label_added": true,
    "c2pa_metadata_added": true
  }
}
```

---

## Error Paths

### Script Review Fails (FCA Violation)
```
Script Review → [Status: REJECTED]
  ↓
Error Response → App
{
  status: 'FCA_VIOLATION',
  violations: ['guaranteed returns', 'should buy'],
  message: 'Rewrite script without product recommendations'
}
```

### Audio Generation Timeout
```
ElevenLabs → [30s timeout]
  ↓
Retry (max 2)
  ↓
Fallback to Google TTS
  ↓
Continue to step 6 (Soul keyframe)
```

### Soul Keyframe Timeout
```
Wait for Keyframe → [5 min timeout]
  ↓
Error Response → App
{
  status: 'TIMEOUT',
  step: 'soul_keyframe',
  message: 'Avatar generation taking too long. Try again later.'
}
```

### Seedance Animation Timeout
```
Wait for Animation → [90 min timeout]
  ↓
Error Response → App
{
  status: 'TIMEOUT',
  step: 'seedance_animation',
  message: 'Video rendering took too long. Partial results available.'
}
```

---

## Environment Variables (Secrets)

Required secrets in n8n:
- `ELEVENLABS_KEY`: ElevenLabs API key
- `HIGGSFIELD_KEY`: Higgsfield API key
- `AWS_ACCESS_KEY_ID`: AWS S3 access
- `AWS_SECRET_ACCESS_KEY`: AWS S3 secret
- `S3_BUCKET_NAME`: Target S3 bucket
- `APP_WEBHOOK_URL`: Callback URL to app (execution tracker)

---

## Testing Plan

### Mock Test (Phase 5a)
1. Use hardcoded responses for each node
2. Simulate full workflow
3. Verify output schema
4. Test error paths

### Real Test (Phase 5b)
1. Call ElevenLabs with test script
2. Call Higgsfield with test Soul + audio
3. Verify MP4 output
4. Verify overlays present
5. Verify S3 storage working

---

## Performance Targets

| Step | Tool | Est. Time | Max Time |
|------|------|-----------|----------|
| Audio gen | ElevenLabs | 15-30s | 60s |
| Keyframe | Higgsfield | 1-2 min | 5 min |
| Animation | Seedance | 30-60 min | 90 min |
| Stitch | FFmpeg | 30-60s | 5 min |
| Total | | 35–63 min | 100 min |

---

## Cost Estimation

| Step | Credits |
|------|---------|
| Audio (15s) | 0 (ElevenLabs external) |
| Keyframe | 40 |
| Animation (15s) | 100 |
| Stitch + storage | 0 (local FFmpeg) |
| **Total per video** | ~140 |

---

## Deployment Checklist

- [ ] n8n workflow created
- [ ] All secrets configured
- [ ] Mock test passes
- [ ] Real test passes (script → audio → keyframe → animation → MP4)
- [ ] Error paths tested
- [ ] Webhook trigger verified
- [ ] S3 integration working
- [ ] App callback working
- [ ] Logging enabled
- [ ] Production mode enabled

---

**Ready for Implementation**: Phase 5
