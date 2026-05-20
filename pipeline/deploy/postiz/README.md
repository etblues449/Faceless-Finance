# Postiz — self-hosted auto-poster

Postiz is the open-source publishing engine. It direct-publishes to TikTok,
YouTube and Instagram using each platform's official API, and exposes a small
REST API the pipeline calls. Running it yourself keeps it free and keeps your
OAuth tokens on your own server.

## Deploy

```bash
cd pipeline/deploy/postiz
cp .env.example .env
# edit .env: set POSTIZ_DOMAIN and generate the two secrets:
#   openssl rand -hex 32   (JWT_SECRET)
#   openssl rand -hex 32   (POSTGRES_PASSWORD)
docker compose up -d
```

Put a reverse proxy (Caddy/Nginx/Cloudflare Tunnel) in front so `POSTIZ_DOMAIN`
serves over HTTPS — the social platforms require https OAuth redirect URLs.

## Connect your channels

1. Open `POSTIZ_DOMAIN`, create your account.
2. For each platform, create a developer app and paste its client id/secret into
   `.env` (and uncomment the matching lines in `docker-compose.yml`), then
   restart:
   - **TikTok** — https://developers.tiktok.com (Content Posting API)
   - **YouTube** — https://console.cloud.google.com (YouTube Data API v3 OAuth)
   - **Instagram** — https://developers.facebook.com (Instagram Graph API; needs a
     Professional/Business IG account linked to a Facebook Page)
3. In Postiz → **Channels**, connect each account via OAuth.

## Wire it to the pipeline

1. Postiz → **Settings → API** → generate an API key → set `POSTIZ_API_KEY` in
   the pipeline's `.env`.
2. Get each connected channel's **integration id** (visible in the channel
   settings / the create-post API response) and set `POSTIZ_INTEGRATION_IDS`,
   appending the platform, e.g. `7a1...:tiktok,9c2...:youtube,4f8...:instagram`.

That's it — `fincast run` will now upload the rendered MP4 and publish it.

## Notes

- Free of charge on your own hardware; the only cost is your server.
- TikTok's posting API may publish to drafts/inbox first depending on your app's
  review status — check your TikTok app permissions if posts land as drafts.
- The exact field names of Postiz's public API can shift between releases; the
  pipeline isolates all Postiz calls in `src/postiz.js`, so if a future Postiz
  version renames a field you only touch that one file.
