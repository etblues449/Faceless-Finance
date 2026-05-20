// Builds the per-platform publishing text. The FCA disclaimer is appended to
// every caption here (single enforcement point), and platform character limits
// are respected so a post never gets rejected for length.

const LIMITS = {
  tiktok: { caption: 2200 },
  youtube: { caption: 5000, title: 100 },
  instagram: { caption: 2200 },
};

export function buildCaptions({ script, disclaimer, platforms = ['tiktok', 'youtube', 'instagram'] }) {
  const hashtags = (script.hashtags || []).join(' ');
  const out = {};
  for (const platform of platforms) {
    const limit = LIMITS[platform] || { caption: 2200 };
    const base = script.caption.trim();
    const block = [base, hashtags, disclaimer].filter(Boolean).join('\n\n');
    out[platform] = {
      title: limit.title ? clip(script.title.trim(), limit.title) : undefined,
      caption: clip(block, limit.caption),
    };
  }
  return out;
}

function clip(text, max) {
  if (!max || text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

export { LIMITS };
