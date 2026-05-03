# FinCast Worker — Phase 2 Auto-Publish

A Cloudflare Worker that handles OAuth and direct publishing to TikTok, YouTube, and Instagram for the FinCast Studio app. Replaces the manual upload step with one-tap publish.

> **Status: scaffolded.** Code is ready. Each platform requires a one-time developer-app registration before it's usable. Reviews take 1–4 weeks per platform, so do this in the background while you ship videos manually.

## What it does

| Endpoint | Purpose |
|---|---|
| `GET /health` | status check |
| `GET /oauth/:platform/init?user_id=X` | returns OAuth URL for user to visit |
| `GET /oauth/:platform/callback?code=X&state=Y` | exchanges auth code, stores encrypted tokens, redirects back to FinCast |
| `GET /auth/:platform/status?user_id=X` | returns whether `:platform` is connected |
| `POST /auth/:platform/disconnect` | wipes stored tokens |
| `POST /publish/:platform` | publishes a video using stored tokens |

`platform` ∈ `tiktok` / `youtube` / `instagram`

## Architecture

- **Cloudflare Workers** runtime (~$0/month for personal use, free tier)
- **KV namespace** stores access + refresh tokens (encrypted at rest by Cloudflare, plus an extra AES-GCM layer keyed by your `ENCRYPTION_KEY` secret — so even Cloudflare staff can't read tokens)
- **CORS** restricted to your FinCast Pages origin
- **No database, no servers, no scaling concerns**

## Setup — 30 minutes after platform reviews approve

### 1. Install Wrangler + log in

```bash
cd worker
npm install
npx wrangler login
```

### 2. Create the KV namespace

```bash
npx wrangler kv namespace create fincast_tokens
```

Copy the `id` it prints into `wrangler.toml` (replace `REPLACE_WITH_YOUR_KV_ID`).

### 3. Set secrets

```bash
# Generate a random 32+ character string (mac/linux: openssl rand -hex 32)
npx wrangler secret put ENCRYPTION_KEY

# TikTok (after registering — see Section 4)
npx wrangler secret put TIKTOK_CLIENT_KEY
npx wrangler secret put TIKTOK_CLIENT_SECRET

# YouTube
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# Instagram (Meta)
npx wrangler secret put META_APP_ID
npx wrangler secret put META_APP_SECRET
```

### 4. Deploy

```bash
npx wrangler deploy
```

You'll get a URL like `https://fincast-worker.<your-account>.workers.dev`. **Copy it.**

### 5. Add to FinCast Settings

Open the FinCast app → Settings → "Phase 2 Auto-publish" → paste the worker URL → Save.

The Settings page now shows a "Connect" button per platform.

---

## Platform-specific setup (the slow part)

Each platform requires you to register a developer app and get reviewed. Reviews take 1–4 weeks each. Start them in parallel.

### TikTok Content Posting API

1. Go to **[developers.tiktok.com](https://developers.tiktok.com)** → Manage apps → Create app.
2. App type: **App** (not website).
3. Add product: **Login Kit** + **Content Posting API**.
4. Scopes: `user.info.basic`, `video.upload`, `video.publish`.
5. Redirect URL: `https://fincast-worker.<your-account>.workers.dev/oauth/tiktok/callback`
6. Apply for **production access** (sandbox lets you test only with your own account; production requires app review, typically 1–4 weeks).
7. Copy Client Key + Client Secret → `wrangler secret put TIKTOK_CLIENT_KEY` etc.

### YouTube Data API

1. **[console.cloud.google.com](https://console.cloud.google.com)** → Create project → Enable **YouTube Data API v3**.
2. **OAuth consent screen** → External → fill required fields.
3. Add scope: `https://www.googleapis.com/auth/youtube.upload`.
4. **Credentials → Create OAuth Client ID → Web application**.
5. Authorised redirect URI: `https://fincast-worker.<your-account>.workers.dev/oauth/youtube/callback`
6. **Stay in "Testing" mode** — adds yourself as a test user. **No app review needed** if you're the only user (saves 4–6 weeks).
7. Copy Client ID + Secret → `wrangler secret put GOOGLE_CLIENT_ID` etc.

### Instagram Graph API

**Prerequisites:**
- Your Instagram account must be **Business** or **Creator** (convert in IG settings).
- You must have a **Facebook Page** linked to that Instagram account.

1. **[developers.facebook.com](https://developers.facebook.com)** → Create app → type **Business**.
2. Add product: **Instagram Graph API** + **Facebook Login**.
3. Permissions needed: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.
4. **App Review** required for `instagram_content_publish` (1–4 weeks). Submit a screencast showing your app using the permission.
5. Valid OAuth Redirect URI: `https://fincast-worker.<your-account>.workers.dev/oauth/instagram/callback`
6. Copy App ID + Secret → `wrangler secret put META_APP_ID` etc.

---

## Cost

- Cloudflare Workers free tier: 100,000 requests/day. Even at 10 videos/day across 3 platforms with polling, you'll use <100 requests/day. **Free.**
- Cloudflare KV free tier: 100,000 reads/day, 1,000 writes/day. **Free.**

No card on file required for personal use.

---

## Testing locally

```bash
cd worker
npx wrangler dev
```

Worker runs at `http://localhost:8787`. Set FinCast Settings → Worker URL to that for local testing.

---

## Limits and caveats

- **TikTok Direct Post** publishes immediately — no scheduling via API. Use the Calendar tab + manual upload for scheduled posts, or use Buffer.
- **YouTube** supports scheduling via `publishAt` in the upload metadata.
- **Instagram Graph API** does not support scheduling for Reels — posts immediately. Use Buffer for scheduled IG posts.
- **Video must be hosted at a public URL** (HeyGen CDN URLs work fine — they're public).
- **Worker has 30s wall-clock limit per request** on free tier. If a HeyGen MP4 is huge (>50MB) the YouTube upload may time out. Short-form videos are usually <10MB so this is fine.
- **Instagram requires the Facebook Page** linked to your IG Business account. Painful but unavoidable.

---

## File map

```
worker/
├── wrangler.toml          deploy config
├── package.json           wrangler dependency
├── README.md              this file
└── src/
    ├── index.js           main router
    ├── cors.js            CORS helpers
    ├── storage.js         KV + AES-GCM encryption for tokens
    ├── oauth/
    │   ├── tiktok.js
    │   ├── youtube.js
    │   └── instagram.js
    └── publish/
        ├── tiktok.js
        ├── youtube.js
        └── instagram.js
```

## Updating the worker

```bash
cd worker
npx wrangler deploy
```

That's it. No build step.
