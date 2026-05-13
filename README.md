# Faceless Finance App

A single-file web app that runs your UK tax-saving content channel end-to-end:
**idea → script → HeyGen render → approve → publish** for TikTok, Instagram Reels, YouTube Shorts and YouTube long-form.

No build step. No backend. Open `index.html` and it works.

---

## What it does

| Tab | What happens |
|---|---|
| **Pipeline** | Kanban view of every video by stage. |
| **New Video** | Wizard: pick tone (Mat-style / Rebecca-style / neutral) → generate 6 ideas with Claude → pick one → generate script → trigger HeyGen render. |
| **Approval** | Watch every render. Approve or send back. |
| **Publish** | Per-platform caption + hashtags + title (with character-count enforcement), MP4 download, deep-link to TikTok Studio / YT Studio / IG Composer / Buffer compose. |
| **Calendar** | Manual scheduling per platform. |
| **Settings** | API keys (HeyGen, Anthropic, Pexels, Buffer), niche, FCA disclaimer, brand voice. |

## What it deliberately does NOT do (yet)

- **Auto-post** to TikTok / YouTube / Instagram. That requires server-side OAuth. Phase 2 ships a Cloudflare Worker for full auto-publish; phase 1 gives you ready-to-upload bundles + deep-link buttons.
- **Render minutes accounting** — it just calls HeyGen; track your credits in HeyGen's dashboard.
- **Fake metrics** — no dashboard tiles with made-up subscriber counts.

---

## Setup (5 minutes)

### 1. Get your API keys

- **Anthropic** — [console.anthropic.com](https://console.anthropic.com) → API Keys. Add £5 credit to start.
- **HeyGen** — Settings → API → Create API Token. Requires a plan with API access (Creator API or Team).
- **Pexels** (free, optional) — [pexels.com/api](https://www.pexels.com/api/) → Get API Key. Used for B-roll search.
- **Buffer** (optional) — currently used only to open Buffer's compose page with prefilled text + media.

### 2. Find your HeyGen Avatar ID and Voice ID

In HeyGen:
- **Avatar ID**: Avatars tab → click your avatar → it appears in the URL or "Copy ID."
- **Voice ID**: Voices tab → your voice → copy the ID. Use your own cloned voice — the app keeps your voice but adapts the *script's tone and pacing* to feel like your reference creators.

### 3. Run the app

**Option A — GitHub Pages (recommended).** Once this is on `main`, GitHub Pages auto-deploys via `.github/workflows/pages.yml`. Settings → Pages → Source: GitHub Actions. Your app is at `https://<you>.github.io/<repo>/`.

**Option B — Local.** Just open `index.html` in any modern browser. Works from `file://`.

**Option C — Anywhere static.** Drag `index.html` into Netlify, Vercel, Cloudflare Pages, or any host.

### 4. First run

1. Open the app → **Settings** → paste all keys → save (auto-saved).
2. Go to **New Video** → pick tone → generate ideas → pick one → generate script → render.
3. Wait 1–4 minutes for HeyGen → video appears in **Approval** tab.
4. Approve → **Publish** tab → copy caption, download MP4, click "Open TikTok Studio" → upload.

---

## Tone presets

The script generator adapts to one of three voices. Your HeyGen voice never changes — only the script's words, sentence length, and pacing.

- **Mat-style (QuidSquid)** — punchy, sub-30s, 6–10 word sentences, hook-driven. HeyGen speed 1.05x.
- **Rebecca-style (chartered accountant)** — warm, defines technical terms, 60–90s, slower. HeyGen speed 0.95x.
- **Neutral** — clear, balanced, 45–60s.

You can edit the script before rendering.

---

## What happens to your data

- All state (videos, scripts, settings, API keys) is stored in your browser's `localStorage` only.
- **Nothing is sent to any server we control.** API calls go directly from your browser to Anthropic, HeyGen, Pexels.
- Anthropic API access from the browser uses the `anthropic-dangerous-direct-browser-access: true` header — fine for personal use, not for a multi-user app.
- Backup with **Settings → Export backup**. Restore with Import.

---

## Compliance

The app auto-appends an FCA-safe disclaimer to every caption:

> This is for educational purposes only and is not financial advice. I am not authorised by the Financial Conduct Authority. Always consult a qualified adviser before making financial decisions. Capital at risk.

The script prompt is hard-coded to:
- Use UK-only terminology (HMRC, FCA, ISA, SIPP, PAYE).
- Use 2025/26 UK tax thresholds.
- Never recommend specific products / brokers / funds.
- Frame everything as education, not advice.

You're still the one publishing it — review every script.

---

## Phase 2 roadmap

- Cloudflare Worker for OAuth: TikTok Content Posting API, YouTube Data API, Instagram Graph API
- Full Buffer API integration (queue / schedule directly)
- Render-credit tracking
- Multi-language captions (ar / es / hi)
