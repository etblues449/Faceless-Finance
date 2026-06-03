// Faceless Finance Worker
//
// Two responsibilities:
//   1. /proxy/<host>/<path...> — generic CORS-busting passthrough for browser→API calls
//      that providers (Hedra, ElevenLabs, HeyGen, future) don't allow direct from browsers.
//      This is the foundation of the multi-provider architecture: every provider call from
//      Faceless Finance App goes through here. Solves CORS allowlists + multipart upload corruption.
//   2. /oauth/* + /auth/* + /publish/* — Phase 2 social-media auto-publishing (TikTok/YT/IG).
//      Optional. Requires KV namespace + provider secrets if user wants to use them.
//
// One-click deploy: deploy.workers.cloudflare.com/?url=<repo-tree-url-to-worker>
import { corsHeaders, preflight, jsonResponse, redirect, error } from './cors.js';
import { saveTokens, loadTokens, deleteTokens, saveState, loadState, newState } from './storage.js';
import * as tiktok from './oauth/tiktok.js';
import * as youtube from './oauth/youtube.js';
import * as instagram from './oauth/instagram.js';
import { publishTikTok } from './publish/tiktok.js';
import { publishYouTube } from './publish/youtube.js';
import { publishInstagram } from './publish/instagram.js';

const PROVIDERS = { tiktok, youtube, instagram };
const PUBLISHERS = { tiktok: publishTikTok, youtube: publishYouTube, instagram: publishInstagram };

// Header names the worker forwards from client → upstream and upstream → client.
// This is the union of every auth/identifier header any provider expects.
//
// IMPORTANT: do NOT forward 'accept-encoding' (request) or 'content-encoding' /
// 'content-length' (response). Cloudflare's fetch() auto-decompresses gzipped
// upstream responses; if we forwarded the original content-encoding/length,
// the browser would try to decompress already-decompressed content and fail
// with "Failed to fetch". Let CF + the browser negotiate encoding/length on
// the wire between worker and client.
const FORWARD_REQUEST_HEADERS = [
  'authorization', 'x-api-key', 'xi-api-key', 'x-hedra-key', 'x-anthropic-key',
  'anthropic-version', 'anthropic-dangerous-direct-browser-access',
  'content-type', 'accept', 'user-agent',
  'openai-organization', 'openai-project',
];
const FORWARD_RESPONSE_HEADERS = [
  'content-type', 'content-disposition',
  'cache-control', 'etag', 'last-modified', 'location',
];

// Hosts the proxy is allowed to forward to. Lockdown to prevent abuse.
const ALLOWED_HOSTS = new Set([
  'api.hedra.com',
  'api.elevenlabs.io',
  'api.heygen.com',
  'upload.heygen.com',         // HeyGen audio/image asset upload endpoint
  'api.anthropic.com',
  'api.pexels.com',
  // Higgsfield AI (Seedance v1 Pro — image-to-video)
  'platform.higgsfield.ai',
  // Higgsfield official REST API (Soul image gen + Wan 2.7 lip-sync via /v1/generations)
  'api.higgsfield.ai',
  // Fal.ai (Seedance 2.0 text-to-video via queue)
  'fal.run',
  'queue.fal.run',
  'rest.alpha.fal.ai',           // Fal legacy REST endpoint
  // S3 presigned download URLs returned by Hedra
  's3.us-east-1.amazonaws.com', 's3.us-west-2.amazonaws.com',
  // OpenAI / Google / Runway
  'api.openai.com',
  'aiplatform.googleapis.com',
  'generativelanguage.googleapis.com',  // Google AI Studio (Veo 3 via Gemini API)
  'api.runwayml.com',
  'api.dev.runwayml.com',              // Runway Developer API (Gen-4 Turbo image-to-video)
]);

// ── Design A: server-side key injection ──────────────────────────────────────
// Generation keys live ONLY as Worker secrets (`wrangler secret put`). For these
// hosts the Worker injects the real credential and DROPS whatever the browser
// sent, so a provider secret never has to exist in the client. A host whose
// secret isn't set returns null here and falls through to plain passthrough,
// so nothing hard-breaks.
const SECRET_INJECTION = {
  'api.anthropic.com':                 (env) => env.ANTHROPIC_KEY   && { headers: { 'x-api-key': env.ANTHROPIC_KEY } },
  'generativelanguage.googleapis.com': (env) => env.GOOGLE_AI_KEY   && { query:   { key: env.GOOGLE_AI_KEY } }, // Veo 3
  'api.dev.runwayml.com':              (env) => env.RUNWAY_KEY      && { headers: { authorization: `Bearer ${env.RUNWAY_KEY}` } },
  'api.runwayml.com':                  (env) => env.RUNWAY_KEY      && { headers: { authorization: `Bearer ${env.RUNWAY_KEY}` } },
  'api.elevenlabs.io':                 (env) => env.ELEVENLABS_KEY  && { headers: { 'xi-api-key': env.ELEVENLABS_KEY } },
  'api.pexels.com':                    (env) => env.PEXELS_KEY      && { headers: { authorization: env.PEXELS_KEY } },
  // Dormant providers — only injected if you choose to set their secret.
  'api.hedra.com':                     (env) => env.HEDRA_KEY       && { headers: { 'x-api-key': env.HEDRA_KEY } },
  'api.heygen.com':                    (env) => env.HEYGEN_KEY      && { headers: { 'x-api-key': env.HEYGEN_KEY } },
  'upload.heygen.com':                 (env) => env.HEYGEN_KEY      && { headers: { 'x-api-key': env.HEYGEN_KEY } },
  'platform.higgsfield.ai':            (env) => env.HIGGSFIELD_KEY && env.HIGGSFIELD_SECRET && { headers: { authorization: `Key ${env.HIGGSFIELD_KEY}:${env.HIGGSFIELD_SECRET}` } },
  // The official REST endpoint uses a single Bearer token (HIGGSFIELD_TOKEN
  // from cloud.higgsfield.ai → API). Confirmed by pipeline/render/higgsfield.py.
  'api.higgsfield.ai':                 (env) => env.HIGGSFIELD_TOKEN && { headers: { authorization: `Bearer ${env.HIGGSFIELD_TOKEN}` } },
  'fal.run':                           (env) => env.FAL_KEY         && { headers: { authorization: `Key ${env.FAL_KEY}` } },
  'queue.fal.run':                     (env) => env.FAL_KEY         && { headers: { authorization: `Key ${env.FAL_KEY}` } },
  'rest.alpha.fal.ai':                 (env) => env.FAL_KEY         && { headers: { authorization: `Key ${env.FAL_KEY}` } },
};

// Auth headers the client might send; dropped before injecting so a stale or
// placeholder browser key never reaches upstream on a Worker-managed host.
const CLIENT_AUTH_HEADERS = ['authorization', 'x-api-key', 'xi-api-key', 'x-hedra-key', 'x-anthropic-key'];

async function handleProxy(request, env, parts) {
  // Path shape: /proxy/<host>/<...rest> → upstream URL https://<host>/<rest>
  // Also supports query string passthrough.
  if (parts.length < 2) return error(env, request, 'proxy requires /proxy/<host>/<path>', 400);
  const targetHost = parts[1];
  if (!ALLOWED_HOSTS.has(targetHost)) {
    return error(env, request, `proxy: host '${targetHost}' not in allowlist`, 403);
  }
  // Require the shared proxy token (when configured) so the injected keys can't
  // be used by anyone who merely knows the Worker URL. Accept it from a header
  // OR a `__pt` query param (the latter so <video>/<img> src loads work).
  if (env.PROXY_TOKEN) {
    const provided =
      request.headers.get('x-proxy-token') ||
      new URL(request.url).searchParams.get('__pt') ||
      '';
    if (provided !== env.PROXY_TOKEN) {
      return error(env, request, 'proxy: missing or invalid proxy token', 401);
    }
  }

  const targetPath = parts.slice(2).join('/');
  const incoming = new URL(request.url);
  incoming.searchParams.delete('__pt'); // never forward the proxy token upstream
  const targetUrl = `https://${targetHost}/${targetPath}${incoming.search}`;

  // Build outgoing headers — only forward whitelisted header names.
  const outgoingHeaders = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const v = request.headers.get(name);
    if (v) outgoingHeaders.set(name, v);
  }

  // Provider-specific header injection.
  // Runway's developer API requires x-runway-version. Injecting here avoids
  // needing to add the header to the CORS allow-list (which would break
  // preflights for clients that don't know to send it).
  if (targetHost === 'api.dev.runwayml.com' || targetHost === 'api.runwayml.com') {
    outgoingHeaders.set('x-runway-version', '2024-11-06');
  }

  // Design A: inject the server-side secret for Worker-managed hosts and drop
  // whatever auth the client sent, so a real provider key never has to live in
  // the browser. Hosts with no secret set fall through to plain passthrough.
  let finalUrl = targetUrl;
  const injector = SECRET_INJECTION[targetHost];
  const injection = injector ? injector(env) : null;
  if (injection) {
    for (const h of CLIENT_AUTH_HEADERS) outgoingHeaders.delete(h);
    for (const [k, v] of Object.entries(injection.headers || {})) outgoingHeaders.set(k, v);
    if (injection.query) {
      const injected = new URL(targetUrl);
      for (const [k, v] of Object.entries(injection.query)) injected.searchParams.set(k, v);
      finalUrl = injected.toString();
    }
  }

  // Forward the request. For non-GET/HEAD, stream the body as-is — preserves
  // multipart boundaries (which is the whole point of having a backend proxy).
  const init = {
    method: request.method,
    headers: outgoingHeaders,
    redirect: 'follow',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // Use the raw stream so multipart bodies pass byte-perfect.
    init.body = request.body;
    // Cloudflare requires this when sending a stream body.
    init.duplex = 'half';
  }

  const upstream = await fetch(finalUrl, init);

  // Build response. Forward whitelisted upstream headers + add CORS.
  const respHeaders = new Headers(corsHeaders(env, request));
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const v = upstream.headers.get(name);
    if (v) respHeaders.set(name, v);
  }
  respHeaders.set('X-Proxied-By', 'fincast-worker');
  respHeaders.set('X-Upstream-Status', String(upstream.status));

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

// ── App control API ──────────────────────────────────────────────────────────
// Lets the mobile app trigger the proven GitHub Actions render pipeline and review
// the result, all without a GitHub token in the browser. KV (TOKENS) stores the
// latest render so the app can play + approve it; publishing reuses /publish/*.
async function ghFetch(env, path, init = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'fincast-worker',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
}

async function handleApi(request, env, parts, url) {
  const sub = parts[1];

  // POST /api/render {topic?} → dispatch the GitHub Actions workflow (test render, no publish)
  if (sub === 'render' && request.method === 'POST') {
    if (env.PROXY_TOKEN) {
      const t = request.headers.get('x-proxy-token') || url.searchParams.get('__pt') || '';
      if (t !== env.PROXY_TOKEN) return error(env, request, 'invalid token', 401);
    }
    if (!env.GH_TOKEN || !env.GH_OWNER || !env.GH_REPO)
      return error(env, request, 'render not configured: set GH_TOKEN, GH_OWNER, GH_REPO', 503);
    const body = await request.json().catch(() => ({}));
    const wf = env.GH_WORKFLOW || 'faceless.yml';
    const ref = env.GH_REF || 'main';
    const inputs = {};
    if (body.topic) inputs.topic = String(body.topic);
    const r = await ghFetch(env, `/repos/${env.GH_OWNER}/${env.GH_REPO}/actions/workflows/${wf}/dispatches`, {
      method: 'POST', body: JSON.stringify({ ref, inputs }),
    });
    if (r.status !== 204) return error(env, request, `dispatch failed: ${r.status} ${await r.text()}`, 502);
    return jsonResponse(env, request, { dispatched: true, workflow: wf, ref });
  }

  // GET /api/runs → recent workflow runs (status for the app)
  if (sub === 'runs' && request.method === 'GET') {
    if (!env.GH_TOKEN || !env.GH_OWNER || !env.GH_REPO)
      return error(env, request, 'runs not configured', 503);
    const wf = env.GH_WORKFLOW || 'faceless.yml';
    const r = await ghFetch(env, `/repos/${env.GH_OWNER}/${env.GH_REPO}/actions/workflows/${wf}/runs?per_page=5`);
    if (!r.ok) return error(env, request, `runs failed: ${r.status}`, 502);
    const j = await r.json();
    const runs = (j.workflow_runs || []).map((x) => ({
      id: x.id, status: x.status, conclusion: x.conclusion, created_at: x.created_at, html_url: x.html_url,
    }));
    return jsonResponse(env, request, { runs });
  }

  // The rest need KV.
  if (!env.TOKENS) return error(env, request, 'this endpoint needs KV namespace TOKENS', 503);

  // POST /api/ingest {video_url,title,caption} — the pipeline reports a finished video
  if (sub === 'ingest' && request.method === 'POST') {
    if (!env.INGEST_SECRET || request.headers.get('x-ingest-secret') !== env.INGEST_SECRET)
      return error(env, request, 'invalid ingest secret', 401);
    const b = await request.json().catch(() => ({}));
    if (!b.video_url) return error(env, request, 'video_url required', 400);
    const item = { video_url: b.video_url, title: b.title || '', caption: b.caption || '', ts: Date.now(), status: 'review' };
    await env.TOKENS.put('render:latest', JSON.stringify(item));
    const hist = JSON.parse((await env.TOKENS.get('render:history')) || '[]');
    hist.unshift(item);
    await env.TOKENS.put('render:history', JSON.stringify(hist.slice(0, 20)));
    return jsonResponse(env, request, { ok: true });
  }

  // GET /api/latest — newest render awaiting review
  if (sub === 'latest' && request.method === 'GET') {
    const v = await env.TOKENS.get('render:latest');
    return jsonResponse(env, request, v ? JSON.parse(v) : { empty: true });
  }

  // GET /api/history — recent renders
  if (sub === 'history' && request.method === 'GET') {
    return jsonResponse(env, request, { items: JSON.parse((await env.TOKENS.get('render:history')) || '[]') });
  }

  return error(env, request, 'unknown /api route', 404);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return preflight(env, request);

    const url = new URL(request.url);
    const parts = url.pathname.replace(/^\/|\/$/g, '').split('/');

    try {
      // GET / → status
      if (parts[0] === '' || parts[0] === 'health') {
        return jsonResponse(env, request, {
          ok: true,
          version: '1.5.0',
          allowed_origin: env.ALLOWED_ORIGIN,
          proxy_hosts: Array.from(ALLOWED_HOSTS),
          features: {
            proxy: true,
            key_injection: true,
            proxy_token_required: !!env.PROXY_TOKEN,
            oauth: !!env.TOKENS,
            publish: !!env.TOKENS,
            app_render: !!(env.GH_TOKEN && env.GH_OWNER && env.GH_REPO),
            app_review: !!env.TOKENS,
          },
          // Hosts whose generation secret is currently set — for verifying
          // `wrangler secret put` worked. Names only, never the key values.
          managed_hosts: Object.keys(SECRET_INJECTION).filter((h) => SECRET_INJECTION[h](env)),
        });
      }

      // /proxy/<host>/<path> — generic CORS-busting passthrough (no auth needed; client passes their key)
      if (parts[0] === 'proxy') {
        return handleProxy(request, env, parts);
      }

      // /api/* — app control plane (render trigger, review, history)
      if (parts[0] === 'api') {
        return handleApi(request, env, parts, url);
      }

      // Below endpoints require KV (TOKENS namespace). Return clear error if not configured.
      if ((parts[0] === 'oauth' || parts[0] === 'auth' || parts[0] === 'publish') && !env.TOKENS) {
        return error(env, request, 'OAuth/publishing requires KV namespace TOKENS to be configured. See worker/README.md', 503);
      }

      if (parts[0] === 'oauth' && parts[2] === 'init') {
        const platform = parts[1];
        const provider = PROVIDERS[platform];
        if (!provider) return error(env, request, `Unknown platform: ${platform}`, 400);
        const userId = url.searchParams.get('user_id');
        const redirectTo = url.searchParams.get('redirect_to') || `${env.ALLOWED_ORIGIN}${env.APP_ROOT_PATH || ''}/`;
        if (!userId) return error(env, request, 'user_id required', 400);
        const state = newState();
        await saveState(env, state, { user_id: userId, redirect_to: redirectTo, platform });
        const authUrl = provider.buildAuthUrl(env, state, request);
        return jsonResponse(env, request, { authUrl, state });
      }

      if (parts[0] === 'oauth' && parts[2] === 'callback') {
        const platform = parts[1];
        const provider = PROVIDERS[platform];
        if (!provider) return error(env, request, `Unknown platform: ${platform}`, 400);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || !state) return error(env, request, 'code and state required', 400);
        const stateObj = await loadState(env, state);
        if (!stateObj || stateObj.platform !== platform) return error(env, request, 'invalid or expired state', 400);
        const tokens = await provider.exchangeCode(env, code, request);
        await saveTokens(env, platform, stateObj.user_id, tokens);
        const dest = new URL(stateObj.redirect_to);
        dest.searchParams.set('connected', platform);
        return redirect(dest.toString());
      }

      if (parts[0] === 'auth' && parts[2] === 'status') {
        const platform = parts[1];
        const userId = url.searchParams.get('user_id');
        if (!userId) return error(env, request, 'user_id required', 400);
        const tokens = await loadTokens(env, platform, userId);
        if (!tokens) return jsonResponse(env, request, { connected: false });
        return jsonResponse(env, request, {
          connected: true,
          expires_at: tokens.expires_at || null,
          scope: tokens.scope || null,
          handle: tokens.handle || null,
        });
      }

      if (parts[0] === 'auth' && parts[2] === 'disconnect' && request.method === 'POST') {
        const platform = parts[1];
        const body = await request.json().catch(() => ({}));
        const userId = body.user_id;
        if (!userId) return error(env, request, 'user_id required', 400);
        await deleteTokens(env, platform, userId);
        return jsonResponse(env, request, { disconnected: true });
      }

      if (parts[0] === 'publish' && parts[1] && request.method === 'POST') {
        const platform = parts[1];
        const publisher = PUBLISHERS[platform];
        if (!publisher) return error(env, request, `Unknown platform: ${platform}`, 400);
        const body = await request.json();
        const { user_id, video_url, caption, title, schedule_at } = body || {};
        if (!user_id || !video_url) return error(env, request, 'user_id and video_url required', 400);
        const tokens = await loadTokens(env, platform, user_id);
        if (!tokens) return error(env, request, `${platform} not connected`, 401);
        const provider = PROVIDERS[platform];
        const fresh = (provider.refreshIfNeeded ? await provider.refreshIfNeeded(env, tokens) : tokens);
        if (fresh !== tokens) await saveTokens(env, platform, user_id, fresh);
        const result = await publisher(env, fresh, { video_url, caption, title, schedule_at });
        return jsonResponse(env, request, result);
      }

      return error(env, request, 'Not found', 404);
    } catch (e) {
      console.error(e);
      return error(env, request, `Worker error: ${e.message}`, 500);
    }
  },
};
