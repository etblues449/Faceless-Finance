// FinCast Cloudflare Worker
//
// Two responsibilities:
//   1. /proxy/<host>/<path...> — generic CORS-busting passthrough for browser→API calls
//      that providers (Hedra, ElevenLabs, HeyGen, future) don't allow direct from browsers.
//      This is the foundation of the multi-provider architecture: every provider call from
//      FinCast goes through here. Solves CORS allowlists + multipart upload corruption.
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
  'api.anthropic.com',
  'api.pexels.com',
  // S3 presigned download URLs returned by Hedra
  's3.us-east-1.amazonaws.com', 's3.us-west-2.amazonaws.com',
  // OpenAI / Google / Runway when those land
  'api.openai.com',
  'aiplatform.googleapis.com',
  'api.runwayml.com',
]);

async function handleProxy(request, env, parts) {
  // Path shape: /proxy/<host>/<...rest> → upstream URL https://<host>/<rest>
  // Also supports query string passthrough.
  if (parts.length < 2) return error(env, request, 'proxy requires /proxy/<host>/<path>', 400);
  const targetHost = parts[1];
  if (!ALLOWED_HOSTS.has(targetHost)) {
    return error(env, request, `proxy: host '${targetHost}' not in allowlist`, 403);
  }
  const targetPath = parts.slice(2).join('/');
  const incoming = new URL(request.url);
  const targetUrl = `https://${targetHost}/${targetPath}${incoming.search}`;

  // Build outgoing headers — only forward whitelisted header names.
  const outgoingHeaders = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const v = request.headers.get(name);
    if (v) outgoingHeaders.set(name, v);
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

  const upstream = await fetch(targetUrl, init);

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
          version: '1.0.0',
          allowed_origin: env.ALLOWED_ORIGIN,
          proxy_hosts: Array.from(ALLOWED_HOSTS),
          features: {
            proxy: true,
            oauth: !!env.TOKENS,
            publish: !!env.TOKENS,
          },
        });
      }

      // /proxy/<host>/<path> — generic CORS-busting passthrough (no auth needed; client passes their key)
      if (parts[0] === 'proxy') {
        return handleProxy(request, env, parts);
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
