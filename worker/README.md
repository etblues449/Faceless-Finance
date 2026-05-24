# Faceless Finance Worker

A Cloudflare Worker that does two things:

1. **`/proxy/<host>/<path>`** — CORS-busting passthrough for any provider Faceless Finance App calls (Claude, Veo 3, Runway, ElevenLabs, Pexels + dormant Hedra/HeyGen/Higgsfield/fal). It also **injects the provider key server-side from a Worker secret** (Design A), so the browser never holds a real generation key. Solves CORS allowlists + multipart upload corruption that public proxies introduce.
2. **`/oauth/*` + `/auth/*` + `/publish/*`** — Phase 2 social-media auto-publishing (TikTok / YouTube / Instagram). Optional. Requires KV namespace + provider secrets if you want it.

## One-click deploy

Tap this button, sign into Cloudflare with email (free, no card needed):

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/etblues449/Faceless-Finance/tree/Faceless-Finance-App/worker)

Cloudflare clones this folder, deploys it, gives you a URL like:

```
https://fincast-worker.<your-account>.workers.dev
```

Paste that URL into Faceless Finance App → Settings → Phase 3 → **Faceless Finance Worker URL** field. Done.

The worker is **stateless and free** for personal use. Cloudflare's free tier gives 100,000 requests/day — well above what a 4-videos-per-week channel will use.

## Set your generation keys (Design A)

The proxy injects provider keys server-side, so paste your keys ONCE as Worker
secrets — the browser never holds a real key. Set the 5 core providers:

```bash
wrangler secret put ANTHROPIC_KEY     # Claude — script
wrangler secret put GOOGLE_AI_KEY     # Google AI Studio — Veo 3
wrangler secret put RUNWAY_KEY        # Runway Gen-4
wrangler secret put ELEVENLABS_KEY    # voice
wrangler secret put PEXELS_KEY        # B-roll
```

Dormant providers (HeyGen, Hedra, Higgsfield, fal) inject only if you also set
their secret. A host with no secret falls back to passthrough, so nothing
hard-breaks. Confirm what's set with `GET /` → `managed_hosts`.

Then in the app → Settings paste the Worker URL; the key fields lock and show
"managed by Worker". Full walkthrough in the repo root `SETUP.md`.

## What needs extra setup (Phase 2 — auto-publishing)

Only if you want one-tap publishing to TikTok / YT / IG instead of manual upload:

1. Create a KV namespace:
   ```bash
   npx wrangler kv namespace create fincast_tokens
   ```
2. Uncomment the `[[kv_namespaces]]` block in `wrangler.toml`, paste the returned ID.
3. Set OAuth secrets via `npx wrangler secret put TIKTOK_CLIENT_KEY` etc. (full list in `wrangler.toml`).
4. Re-deploy: `npx wrangler deploy`.

Phase 2 is gated behind shipping 30 videos manually first (per the project plan). Don't worry about it until then.

## Local dev

```bash
cd worker
npm install
npx wrangler dev
```

Worker runs at `http://localhost:8787`. Set Faceless Finance Worker URL to that for local testing.

## Re-deploy after changes

```bash
cd worker
npx wrangler deploy
```

## Architecture

```
Browser (Faceless Finance App)
    │
    ▼
proxiedUrl() → workerUrl + /proxy/{host}/{path}
    │
    ▼
Cloudflare Worker (this repo)
    │
    ├── /proxy/* → inject key from Worker secret, fetch upstream(host), return with CORS headers
    │
    ├── /oauth/{platform}/init → return auth URL
    ├── /oauth/{platform}/callback → exchange code, store encrypted tokens in KV
    ├── /auth/{platform}/status → check connection
    └── /publish/{platform} → use stored tokens to post video
```

Tokens stored in KV are encrypted at rest by Cloudflare PLUS by an additional AES-GCM layer keyed by `ENCRYPTION_KEY` secret — so even Cloudflare staff can't read them.

## Security notes

- The proxy host allowlist (`ALLOWED_HOSTS` in `src/index.js`) prevents abuse — only specific provider domains can be proxied.
- **Generation keys live as Worker secrets and are injected server-side (Design A).** The browser never holds a real key; for a managed host the Worker drops any client-sent auth header and substitutes the secret. Keys are never logged and never returned to the client.
- For OAuth tokens (Phase 2 only), the encryption layer prevents leakage if KV is compromised.
- Set `ALLOWED_ORIGIN` in `wrangler.toml` to lock proxy access to your own GitHub Pages URL only. Default empty = any origin (fine for personal use).

## Cost

- Cloudflare Workers free tier: 100,000 requests/day
- Cloudflare KV free tier (Phase 2 only): 100,000 reads/day, 1,000 writes/day
- **Total: £0/month for personal use**

No card on file required.
