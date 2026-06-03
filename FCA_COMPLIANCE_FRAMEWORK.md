# FCA Compliance Framework — Phase 6-7

**Status**: 🔴 Ready for Implementation  
**Purpose**: Auto-block risky scripts, auto-inject disclaimers, auto-embed TikTok labels  

---

## FCA Disclaimer (Auto-Prepended)

### Text Version (for captions + pinned comments)

```
⚠️ IMPORTANT: EDUCATIONAL CONTENT ONLY

This video is educational content about UK personal finance.

❌ This is NOT financial advice.
❌ I am NOT an FCA-authorised financial adviser.
❌ I do NOT recommend any specific investments or actions.

✅ Always consult with an FCA-authorised financial adviser before making decisions about your personal situation.

✅ Past performance is not a guarantee of future returns.

✅ Tax laws and rules change. Always verify current regulations before acting.

#NotFinancialAdvice #EducationalContent #UKFinance
```

### Video Overlay Version (burn into MP4)

```
Position: Bottom 15% of frame
Font: Arial, white, 12pt
Background: Semi-transparent black (rgba(0, 0, 0, 0.6))
Text: "Educational content. Not financial advice. Consult an FCA-authorised advisor."
Duration: Last 5 seconds of video
```

### TikTok Post Template

```
[Video hook line]

📚 Educational content about [topic] for UK taxpayers.

⚠️ This is NOT financial advice. I am not an FCA-authorised financial adviser.

Always consult with a qualified professional before making financial decisions.

#UKFinance #FinancialEducation #TaxSaving #NotFinancialAdvice
```

### Pinned Comment Template

```
🔔 IMPORTANT DISCLAIMER

This video is educational content only. It is NOT financial advice.

I am not an FCA-authorised financial adviser.

Always consult with an FCA-authorised professional before making financial decisions.

Tax laws change. Rules mentioned may not apply to you. Verify current regulations.

For regulatory complaints: https://www.fca.org.uk/
```

---

## Script Review Checklist

### 🚫 Dangerous Claims (Block Immediately)

These phrases trigger automatic rejection:

1. **"Guaranteed returns", "guaranteed profit", "guaranteed income"**
   - Example: "This ISA guarantees 5% annual returns"
   - Fix: "This ISA historically returns ~5% annually. Past performance not guaranteed."

2. **Product Recommendations ("should buy", "I recommend")**
   - Example: "You should buy this fund"
   - Fix: "Consider whether this fund matches your needs"

3. **Personalized Advice ("for your situation", "you need")**
   - Example: "For your tax bracket, you need a SIPP"
   - Fix: "Depending on your tax bracket, a SIPP might apply"

4. **Overgeneralizations ("everyone should", "anyone in your situation")**
   - Example: "Everyone should salary sacrifice"
   - Fix: "Many people benefit from salary sacrifice"

5. **Tax Avoidance Language ("avoid tax", "minimize tax illegally")**
   - Example: "How to avoid paying tax legally"
   - Fix: "How to legally reduce your tax bill"

### ✅ Safe Claims (Always Allowed)

These phrases are education-only and safe:

1. **"How X works", "What is X", "Explanation of X"**
   - Example: "How ISAs work for UK taxpayers"
   - Safe: ✅ Educational

2. **"Consider whether", "might apply to you", "depending on your situation"**
   - Example: "Depending on your income, stamp duty might apply"
   - Safe: ✅ Conditional, not advice

3. **"Tax saving", "reduce your tax bill", "legal tax strategies"**
   - Example: "Three legal ways to reduce your tax bill"
   - Safe: ✅ Education, not recommendation

4. **"Here's what happened", "This is how it worked"**
   - Example: "Here's what the dividend tax changes mean"
   - Safe: ✅ Factual, not predictive

5. **Statistics + disclaimer**
   - Example: "Studies show ISA usage is up 20%. This doesn't guarantee returns."
   - Safe: ✅ Data + caveats

---

## Auto-Review Implementation

### Code Node (n8n Workflow)

```javascript
// Phase 6: FCA Script Review
// Runs BEFORE rendering

const script = msg.script.toLowerCase();

// Dangerous phrases (reject immediately)
const dangerous = [
  'guaranteed returns', 'guaranteed profit', 'guaranteed income',
  'should buy', 'should invest', 'should purchase',
  'i recommend', 'i advise', 'i suggest',
  'you need', 'you should', 'you must',
  'best choice', 'best option', 'best investment',
  'everyone should', 'anyone should'
];

// Find violations
const violations = [];
dangerous.forEach(phrase => {
  if (script.includes(phrase)) {
    violations.push(phrase);
  }
});

// Risk scoring
if (violations.length > 0) {
  return {
    status: 'REJECTED',
    severity: 'HIGH',
    violations: violations,
    message: `Script contains ${violations.length} risky claims that violate FCA rules. Rewrite without product recommendations or guaranteed returns language.`,
    examples: {
      bad: violations[0],
      suggestion: `Reframe as: "Consider whether this applies to your situation" instead of "You should..."`
    }
  };
}

// Passed review
return {
  status: 'APPROVED',
  severity: 'NONE',
  violations: [],
  message: 'Script approved for rendering. Disclaimer will be auto-prepended.'
};
```

### App-Side Implementation (index.html)

```javascript
// Phase 8: App Integration
// Show compliance status before render

const reviewButton = document.getElementById('gen-script');
const reviewOutput = document.getElementById('avatar-compliance-out');

async function checkFCACompliance(script) {
  const dangerous = [
    'guaranteed returns', 'guaranteed profit',
    'should buy', 'i recommend',
    'you need', 'everyone should'
  ];

  const found = dangerous.filter(phrase => 
    script.toLowerCase().includes(phrase)
  );

  if (found.length > 0) {
    reviewOutput.innerHTML = `
      <div style="color: var(--red); padding: 12px; background: rgba(255, 77, 109, 0.1); border-radius: 8px;">
        <strong>❌ FCA Compliance Issue</strong><br/>
        Script contains risky claims:<br/>
        ${found.map(p => `• "${p}"`).join('<br/>')}
        <br/><br/>
        <strong>Fix:</strong> Remove product recommendations and guaranteed return claims.
        Reframe as: "Consider whether...", "Depending on...", "This might apply to you"
      </div>
    `;
    return false; // Block render
  }

  reviewOutput.innerHTML = `
    <div style="color: var(--accent); padding: 12px; background: rgba(16, 242, 160, 0.1); border-radius: 8px;">
      <strong>✅ Compliance Approved</strong><br/>
      Script ready for rendering. FCA disclaimer will be auto-added.
    </div>
  `;
  return true; // Allow render
}

// On render button click
renderButton.onclick = async () => {
  const approved = await checkFCACompliance(scriptTextarea.value);
  if (!approved) return; // Block if FCA issues
  
  // Proceed with render...
};
```

---

## Output Modification (FFmpeg Integration)

### Disclaimer Overlay (FFmpeg)

```bash
#!/bin/bash
# stitch.sh — Add disclaimer overlay to MP4

INPUT_VIDEO="$1"
OUTPUT_VIDEO="$2"

ffmpeg -i "$INPUT_VIDEO" \
  -vf "
    drawtext=
      text='Educational content. Not financial advice. Consult an FCA-authorised advisor.':
      fontsize=12:
      fontcolor=white:
      x=(w-text_w)/2:
      y=h-40:
      box=1:
      boxcolor=black@0.6:
      boxborderw=5:
      enable='between(t,duration-5,duration)'
  " \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  "$OUTPUT_VIDEO"
```

### C2PA Metadata Integration

```javascript
// Phase 7: TikTok Disclosure
// Embed C2PA metadata + AI label

const c2paMetadata = {
  signature: {
    date: new Date().toISOString(),
    creator: "etblues449",
    source: "https://github.com/etblues449/Faceless-Finance"
  },
  claims: {
    avatar: {
      soul_id: "64da88e0-fe5f-4af6-a2da-3b8de23fad64",
      soul_name: "JB-FF-2026",
      model: "text2image_soul_v2"
    },
    animation: {
      model: "seedance_2_0",
      provider: "Bytedance",
      duration_seconds: 15
    },
    audio: {
      source: "elevenlabs-pvc",
      voice_name: "JB Blues Script",
      model: "eleven_flash_v2"
    },
    disclaimer: {
      text: "AI-generated video using Higgsfield Soul + Seedance 2.0",
      url: "https://github.com/etblues449/Faceless-Finance"
    }
  }
};
```

---

## Compliance Verification Checklist

Before publishing each video:

- [ ] **Script Review**
  - [ ] No "guaranteed" language
  - [ ] No product recommendations
  - [ ] No "you should" or "I recommend"
  - [ ] Education-only framing

- [ ] **Disclaimer Present**
  - [ ] Text disclaimer in captions ✅
  - [ ] Video overlay visible (last 5s) ✅
  - [ ] TikTok pinned comment visible ✅

- [ ] **Metadata**
  - [ ] C2PA metadata embedded ✅
  - [ ] Soul ID recorded ✅
  - [ ] Seedance version recorded ✅
  - [ ] Timestamp recorded ✅

- [ ] **TikTok Compliance**
  - [ ] AI label visible (🤖 badge) ✅
  - [ ] Caption includes #NotFinancialAdvice ✅
  - [ ] Pinned comment visible ✅

- [ ] **Platform Review**
  - [ ] Posted successfully (not rejected) ✅
  - [ ] Disclaimer visible on preview ✅
  - [ ] No TikTok warnings/flags ✅

---

## Legal Reference

- **FCA Handbook**: COBS 2.1.1R (Financial promotions rules)
- **Key Rule**: Cannot give "financial advice" without FCA authorisation
- **Safe Harbor**: Education + clear "not advice" disclaimer
- **Your Protection**: Auto-disclaimer + script review + clear labeling

---

## Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| FCA enforcement | Low | Auto-review + disclaimer + education-only tone |
| TikTok removal | Medium | AI label + FCA disclaimer visible + caption mentions it's education |
| User asks for advice (comments) | Medium | Pre-written response: "This is education only. Consult an FCA-authorised adviser for your situation." |
| Misinterpretation as advice | Medium | Prominent disclaimer + repetition in captions + pinned comment |

---

**Status**: Ready for Phase 6-7 implementation
