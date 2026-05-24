// Script generation. Produces a single structured JSON object for one video:
// spoken VO + platform metadata. The system prompt encodes the channel's
// non-negotiable rules (UK-only, FCA-safe, TikTok-length) so every script is
// compliant by construction rather than by post-hoc filtering.

export function buildSystemPrompt({ tonePreset }) {
  return `You write scripts for a UK personal-finance / tax-saving short-form video channel.
The on-camera presenter is a British man who appears to walk through everyday UK
settings while talking to camera. Output is spoken aloud by a cloned voice, so
write for the EAR, not the page.

HARD RULES (never break):
- UK only. Use UK terminology and bodies: HMRC, FCA, ISA, SIPP, PAYE, NI, etc.
- Use 2025/26 UK tax thresholds and allowances. If unsure of an exact figure,
  speak in correct general terms rather than inventing a number.
- EDUCATION, NOT ADVICE. Never recommend a specific product, fund, broker,
  platform or provider. Never tell the viewer what they personally should do.
- No guarantees of returns. No "get rich" framing. No hype.
- No on-screen text directions, no emojis inside the spoken script, no stage
  directions — just the words the presenter says.

TONE: ${tonePreset.label}
${tonePreset.style}

Return STRICT JSON only (no markdown, no commentary) with exactly these keys:
{
  "hook":     string,  // the opening line, must grab in under 2 seconds
  "script":   string,  // the FULL spoken voiceover, INCLUDING the hook, within the word cap above
  "title":    string,  // <= 80 chars, punchy, for YouTube Shorts
  "caption":  string,  // 1-3 sentence social caption (NO hashtags here, NO disclaimer)
  "hashtags": string[] // 4-8 relevant tags, each starting with '#', no spaces
}`;
}

export function createScriptWriter({ config, http }) {
  return {
    async generate(topic, { extraGuidance } = {}) {
      const system = buildSystemPrompt({ tonePreset: config.tonePreset });
      const userMsg =
        `Topic for this video: ${topic}\n` +
        (extraGuidance ? `Extra guidance: ${extraGuidance}\n` : '') +
        `Write one video now. Remember: STRICT JSON only.`;

      const data = await http.postJson(
        `${config.anthropic.baseUrl}/v1/messages`,
        {
          model: config.anthropic.model,
          max_tokens: 1024,
          system,
          messages: [{ role: 'user', content: userMsg }],
        },
        {
          headers: {
            'x-api-key': config.anthropic.apiKey(),
            'anthropic-version': '2023-06-01',
          },
        }
      );

      const text = (data.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();

      return parseScriptJson(text);
    },
  };
}

export function parseScriptJson(text) {
  // Models occasionally wrap JSON in prose or fences despite instructions.
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Script generator did not return JSON: ' + text.slice(0, 200));
  }
  const obj = JSON.parse(raw.slice(start, end + 1));

  for (const key of ['hook', 'script', 'title', 'caption']) {
    if (typeof obj[key] !== 'string' || !obj[key].trim()) {
      throw new Error(`Script JSON missing/empty string field: ${key}`);
    }
  }
  obj.hashtags = Array.isArray(obj.hashtags)
    ? obj.hashtags.map((h) => String(h).trim()).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`))
    : [];
  return obj;
}
