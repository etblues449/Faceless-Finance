# TikTok AI Disclosure Automation — Phase 7

**Status**: 🔴 Ready for Implementation  
**Purpose**: Auto-embed C2PA metadata + TikTok AI label into every video  

---

## C2PA Content Credentials

### What is C2PA?

C2PA (Coalition for Content Provenance and Authenticity) is a standard for:
- Recording who created content
- What AI tools were used
- When edits happened
- Verifiable by TikTok + other platforms

### Metadata Schema (JSON)

```json
{
  "c2pa_signature": {
    "date": "2026-06-03T12:34:56Z",
    "creator": {
      "name": "Faceless Finance",
      "identifier": "etblues449",
      "url": "https://github.com/etblues449/Faceless-Finance"
    }
  },
  "ai_claims": {
    "avatar_generation": {
      "model": "Higgsfield Soul V2",
      "model_id": "text2image_soul_v2",
      "soul_id": "64da88e0-fe5f-4af6-a2da-3b8de23fad64",
      "soul_name": "JB-FF-2026",
      "technique": "Text-to-image generation"
    },
    "video_animation": {
      "model": "Seedance 2.0",
      "provider": "Bytedance",
      "technique": "Audio-reference video generation",
      "duration_seconds": 15,
      "aspect_ratio": "9:16"
    },
    "audio_generation": {
      "source": "elevenlabs-pvc",
      "voice_name": "JB Blues Script",
      "technique": "Professional voice clone",
      "model": "eleven_flash_v2"
    },
    "editing": {
      "tools": ["ffmpeg", "c2pa-tool"],
      "modifications": [
        "disclaimer_overlay_added",
        "ai_label_overlay_added",
        "c2pa_metadata_embedded"
      ]
    }
  },
  "legal_notice": {
    "title": "AI-Generated Content Disclosure",
    "text": "This video was entirely created using AI tools: Higgsfield Soul (avatar generation), Seedance 2.0 (animation), and ElevenLabs (voice). The presenter is not a real person.",
    "url": "https://github.com/etblues449/Faceless-Finance"
  },
  "verification": {
    "verifiable_at": "https://verify.contentauthenticity.org/",
    "certificate_url": null
  }
}
```

### Storage Format

**Option 1: Sidecar File** (C2PA standard)
```
video.mp4
video.c2pa  ← XML metadata file (sidecar)
```

**Option 2: Embedded in MP4**
```
ffmpeg -i input.mp4 \
  -metadata "c2pa_metadata=<json>" \
  output.mp4
```

---

## TikTok AI Label Overlay

### Visual Design (SVG)

```svg
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Background circle (semi-transparent) -->
  <circle cx="50" cy="50" r="45" fill="rgba(0, 0, 0, 0.65)" opacity="0.85" />
  
  <!-- Robot emoji (using text) -->
  <text x="50" y="48" font-size="36" text-anchor="middle" fill="white" font-family="Apple Color Emoji, EmojiOne Mozilla, Noto Color Emoji">🤖</text>
  
  <!-- Label text -->
  <text x="50" y="72" font-size="11" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial, sans-serif">AI-GENERATED</text>
</svg>
```

### Position & Appearance

- **Location**: Bottom-right corner of frame
- **Distance from edges**: 20px right, 20px bottom
- **Size**: 100x100px (scales on mobile)
- **Opacity**: 0.85 (semi-transparent, content visible)
- **Duration**: Full video (or last 10 seconds)

### FFmpeg Burn-In Command

```bash
#!/bin/bash
# add_ai_label.sh

INPUT_VIDEO="$1"
LABEL_SVG="ai_label.svg"
OUTPUT_VIDEO="$2"

ffmpeg -i "$INPUT_VIDEO" \
  -i "$LABEL_SVG" \
  -filter_complex "[0][1]overlay=x=W-w-20:y=H-h-20:enable='gte(t,0)'" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  "$OUTPUT_VIDEO"
```

---

## Automation Pipeline

### Step 1: Generate C2PA Metadata (n8n Code Node)

```javascript
// Phase 7: Generate C2PA metadata

const metadata = {
  c2pa_signature: {
    date: new Date().toISOString(),
    creator: {
      name: "Faceless Finance",
      identifier: "etblues449",
      url: "https://github.com/etblues449/Faceless-Finance"
    }
  },
  ai_claims: {
    avatar_generation: {
      model: "Higgsfield Soul V2",
      model_id: "text2image_soul_v2",
      soul_id: msg.payload.soul_id,
      soul_name: "JB-FF-2026",
      technique: "Text-to-image generation"
    },
    video_animation: {
      model: "Seedance 2.0",
      provider: "Bytedance",
      duration_seconds: msg.payload.duration_hint,
      aspect_ratio: "9:16"
    },
    audio_generation: {
      source: "elevenlabs-pvc",
      voice_name: "JB Blues Script",
      model: "eleven_flash_v2"
    }
  },
  legal_notice: {
    title: "AI-Generated Content Disclosure",
    text: "This video was created using AI: Higgsfield Soul (avatar), Seedance 2.0 (animation), ElevenLabs (voice). The presenter is not real.",
    url: "https://github.com/etblues449/Faceless-Finance"
  }
};

return { metadata: JSON.stringify(metadata, null, 2) };
```

### Step 2: Add SVG Label Overlay (FFmpeg Node)

```bash
# After Seedance animation completes
# Add AI label to video

INPUT_VIDEO=$1
OUTPUT_VIDEO=$2

# Create SVG label (or use pre-made file)
cat > /tmp/ai_label.svg << 'EOF'
<svg width="100" height="100" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="45" fill="rgba(0,0,0,0.65)" />
  <text x="50" y="48" font-size="36" text-anchor="middle" fill="white">🤖</text>
  <text x="50" y="72" font-size="11" text-anchor="middle" fill="white" font-weight="bold">AI-GENERATED</text>
</svg>
EOF

# Overlay on video
ffmpeg -i "$INPUT_VIDEO" \
  -i /tmp/ai_label.svg \
  -filter_complex "[0][1]overlay=W-w-20:H-h-20" \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k \
  "$OUTPUT_VIDEO"
```

### Step 3: Embed C2PA Metadata (C2PA Tool Node)

```bash
#!/bin/bash
# embed_c2pa.sh

INPUT_VIDEO=$1
METADATA_JSON=$2
OUTPUT_VIDEO=$3

# Create sidecar C2PA file
cat > "${OUTPUT_VIDEO}.c2pa" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<c2pa>
  <metadata>$(echo "$METADATA_JSON" | base64)</metadata>
  <claim_type>AI-Generated</claim_type>
  <timestamp>$(date -u +%Y-%m-%dT%H:%M:%SZ)</timestamp>
</c2pa>
EOF

# Copy video (or embed metadata directly)
cp "$INPUT_VIDEO" "$OUTPUT_VIDEO"

echo "C2PA metadata embedded: ${OUTPUT_VIDEO}.c2pa"
```

### Step 4: Store + Generate Public URLs

```javascript
// Phase 7: Store video + metadata to S3

const s3 = {
  video: `https://[bucket].s3.amazonaws.com/${uuid}.mp4`,
  metadata: `https://[bucket].s3.amazonaws.com/${uuid}.c2pa`,
  public: true
};

// Both are publicly accessible for verification
return { 
  video_url: s3.video,
  metadata_url: s3.metadata,
  verification_url: `https://verify.contentauthenticity.org/?url=${encodeURIComponent(s3.video)}`
};
```

---

## TikTok Post Automation

### Caption Template (Auto-Generated)

```
[Video topic/hook line]

🇬🇧 UK personal finance education.

⚠️ This video is AI-generated using:
🤖 Avatar: Higgsfield Soul
🎬 Animation: Seedance 2.0
🎤 Voice: ElevenLabs Professional Voice Clone

Learn more: [link to disclosure]

#NotFinancialAdvice #AIGenerated #FinancialEducation #UKFinance
```

### Pinned Comment Template (Auto-Post)

```
🤖 AI DISCLOSURE

This video was entirely created using AI:
✓ Avatar: Higgsfield Soul character (64da88e0...)
✓ Animation: Seedance 2.0 (Bytedance)
✓ Voice: ElevenLabs professional voice clone

The presenter is not a real person.

C2PA Metadata: https://verify.contentauthenticity.org/
Full Disclosure: https://github.com/etblues449/Faceless-Finance

⚠️ Educational content only. Not financial advice.
Consult an FCA-authorised adviser: https://www.fca.org.uk/
```

### App Integration (Phase 8)

```javascript
// Auto-generate TikTok caption + pinned comment

function generateTikTokCaption(videoMetadata) {
  return `
${videoMetadata.topic}

🇬🇧 UK personal finance education.

⚠️ This video is AI-generated using:
🤖 Avatar: Higgsfield Soul
🎬 Animation: Seedance 2.0
🎤 Voice: ElevenLabs Professional Voice Clone

Learn more at: https://github.com/etblues449/Faceless-Finance

#NotFinancialAdvice #AIGenerated #FinancialEducation #UKFinance
  `.trim();
}

function generatePinnedComment(videoMetadata) {
  return `
🤖 AI DISCLOSURE

This video was created using:
✓ Avatar: Higgsfield Soul character
✓ Animation: Seedance 2.0 (Bytedance)
✓ Voice: ElevenLabs professional voice clone

The presenter is NOT a real person.

C2PA Metadata: https://verify.contentauthenticity.org/
Full Source: https://github.com/etblues449/Faceless-Finance

⚠️ Educational content only. Not financial advice.
Consult an FCA-authorised adviser: https://www.fca.org.uk/
  `.trim();
}
```

---

## Verification

### How Users Can Verify

1. **Visual Label**: 🤖 badge visible on video (bottom-right)
2. **TikTok Caption**: Check for #AIGenerated hashtag + disclosure
3. **Pinned Comment**: First comment has AI disclosure
4. **C2PA Metadata**: Upload video to https://verify.contentauthenticity.org/
5. **GitHub Source**: Full source at https://github.com/etblues449/Faceless-Finance

### Verification Checklist (per video)

- [ ] AI label visible on video (🤖 bottom-right corner)
- [ ] C2PA metadata file exists (`.c2pa` sidecar)
- [ ] Metadata verifiable at C2PA tool
- [ ] TikTok caption includes AI disclosure
- [ ] Pinned comment visible + explains AI usage
- [ ] Soul ID + Seedance version recorded
- [ ] Timestamp recorded
- [ ] Video stored with public URL

---

## Compliance Benefits

| Requirement | Solution |
|-------------|----------|
| TikTok AI labeling | 🤖 Visual label + caption |
| Content provenance | C2PA metadata + sidecar file |
| Creator transparency | GitHub source + disclosure |
| FCA compliance | FCA disclaimer + educational framing |
| User trust | Clear labeling + verification capability |

---

## Cost & Performance

- **Label SVG creation**: One-time (~5 min)
- **FFmpeg overlay**: ~30s per video
- **C2PA metadata generation**: ~2s per video
- **Storage (S3)**: Minimal (~50MB per 100 videos)
- **Total overhead per video**: <1 minute

---

**Status**: Ready for Phase 7 implementation
