// FinCast Cloudflare Worker — auto-publish OAuth + publishing for TikTok, YouTube, Instagram
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

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return preflight(env, request);

    const url = new URL(request.url);
    const parts = url.pathname.replace(/^\/|\/$/g, '').split('/');

    try {
      // GET / → status
      if (parts[0] === '' || parts[0] === 'health') {
        return jsonResponse(env, request, { ok: true, version: '0.1.0', allowed_origin: env.ALLOWED_ORIGIN });
      }

      // GET /oauth/:platform/init?user_id=...&redirect_to=...
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

      // GET /oauth/:platform/callback?code=...&state=...
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

      // GET /auth/:platform/status?user_id=...
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

      // POST /auth/:platform/disconnect
      if (parts[0] === 'auth' && parts[2] === 'disconnect' && request.method === 'POST') {
        const platform = parts[1];
        const body = await request.json().catch(() => ({}));
        const userId = body.user_id;
        if (!userId) return error(env, request, 'user_id required', 400);
        await deleteTokens(env, platform, userId);
        return jsonResponse(env, request, { disconnected: true });
      }

      // POST /publish/:platform
      if (parts[0] === 'publish' && parts[1] && request.method === 'POST') {
        const platform = parts[1];
        const publisher = PUBLISHERS[platform];
        if (!publisher) return error(env, request, `Unknown platform: ${platform}`, 400);
        const body = await request.json();
        const { user_id, video_url, caption, title, schedule_at } = body || {};
        if (!user_id || !video_url) return error(env, request, 'user_id and video_url required', 400);
        const tokens = await loadTokens(env, platform, user_id);
        if (!tokens) return error(env, request, `${platform} not connected`, 401);
        // Refresh tokens if needed
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
