// Generates a batch of video topic ideas for the channel. Useful for feeding a
// scheduler: generate ideas weekly, then run the pipeline per idea.

export function createIdeaGenerator({ config, http }) {
  return {
    async generate({ count = 6, theme } = {}) {
      const system = `You generate video TOPIC IDEAS for a UK personal-finance / tax-saving short-form channel.
Each idea must be a specific, hooky angle a 15-35s video could cover, grounded in
real 2025/26 UK tax/finance (ISA, SIPP, PAYE, HMRC, allowances, etc.). Education
only — never product recommendations. Return STRICT JSON: an array of ${count}
short strings, nothing else.`;
      const user = theme ? `Theme to focus on: ${theme}` : 'General UK tax-saving angles.';
      const data = await http.postJson(
        `${config.anthropic.baseUrl}/v1/messages`,
        {
          model: config.anthropic.model,
          max_tokens: 1024,
          system,
          messages: [{ role: 'user', content: user }],
        },
        { headers: { 'x-api-key': config.anthropic.apiKey(), 'anthropic-version': '2023-06-01' } }
      );
      const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      return parseIdeas(text);
    },
  };
}

export function parseIdeas(text) {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('Idea generator did not return a JSON array');
  const arr = JSON.parse(raw.slice(start, end + 1));
  return arr.map((s) => String(s).trim()).filter(Boolean);
}
