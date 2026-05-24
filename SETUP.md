# Setup — deploy the Worker, set secrets, test one video

The front-end (`index.html`) auto-deploys to GitHub Pages on every push to
`main` (see `.github/workflows/pages.yml`). The two things you do by hand are:
deploy the Worker and give it your generation keys as secrets.

## 1. Deploy the Worker

```bash
cd worker
npm install
npx wrangler deploy
```

This prints your Worker URL, e.g. `https://fincast-worker.<account>.workers.dev`.

## 2. Set the generation secrets (Design A)

Keys live ONLY as Worker secrets — the browser never holds a real key. Set the
5 core providers (the consolidated stack):

```bash
npx wrangler secret put ANTHROPIC_KEY     # Claude — script
npx wrangler secret put GOOGLE_AI_KEY     # Google AI Studio — Veo 3
npx wrangler secret put RUNWAY_KEY        # Runway Gen-4
npx wrangler secret put ELEVENLABS_KEY    # voice
npx wrangler secret put PEXELS_KEY        # B-roll
```

Dormant providers (only if you turn them on): `HEYGEN_KEY`, `HEDRA_KEY`,
`HIGGSFIELD_KEY` + `HIGGSFIELD_SECRET`, `FAL_KEY`.

Verify what's set:

```bash
curl https://fincast-worker.<account>.workers.dev/ | jq .managed_hosts
```

You should see the hosts whose secret you set (e.g. `api.anthropic.com`,
`generativelanguage.googleapis.com`, …). Key **values** are never returned.

> Secrets only take effect after a deploy. If you set a secret after deploying,
> run `npx wrangler deploy` again.

## 3. Point the app at the Worker

Open the app → **Settings**. Paste the Worker URL into the **Worker URL** field
(Phase 3 card). The key fields lock and show a green "managed by Worker" note —
that's expected. You do **not** paste any generation key into the browser.

## 4. Test ONE video end to end

This is the real test — especially the **stitch** step, which is the highest-risk
unknown (it needs cross-origin isolation via the COI service worker):

1. Generate a script/storyboard.
2. Render the scenes.
3. **Stitch** (watch this closely).
4. Approve.
5. Publish (or download).

If anything errors, capture:
- the **browser console** (F12 → Console), and
- the **`npx wrangler deploy`** / `npx wrangler tail` output.

Those two are what's needed to debug further.

### Notes on stitch

- Stitch uses `ffmpeg.wasm`, which needs `SharedArrayBuffer` → needs the page to
  be cross-origin isolated. GitHub Pages can't send COOP/COEP headers, so
  `coi-serviceworker.js` supplies them. The first load registers the service
  worker and **reloads once** — that's normal.
- Works on Chromium / desktop. iOS Safari lacks credentialless COEP, so stitch
  degrades there while everything else still works.

## 5. Lock the proxy (after it works)

Set `ALLOWED_ORIGIN = "https://etblues449.github.io"` in `worker/wrangler.toml`
and redeploy, so only your own site can use the proxy:

```bash
npx wrangler deploy
```

## Optional — Phase 2 auto-publishing (TikTok / YT / IG)

Requires a KV namespace + OAuth secrets. See `worker/README.md`. Not needed for
generation; set it up later if you want one-tap publishing.
