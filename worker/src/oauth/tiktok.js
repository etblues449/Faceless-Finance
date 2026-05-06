// TikTok Login Kit + Content Posting API OAuth
// Docs: https://developers.tiktok.com/doc/login-kit-web

const SCOPES = ['user.info.basic', 'video.upload', 'video.publish'].join(',');

export function buildAuthUrl(env, state, request) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/oauth/tiktok/callback`;
  const auth = new URL('https://www.tiktok.com/v2/auth/authorize/');
  auth.searchParams.set('client_key', env.TIKTOK_CLIENT_KEY);
  auth.searchParams.set('scope', SCOPES);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('state', state);
  return auth.toString();
}

export async function exchangeCode(env, code, request) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/oauth/tiktok/callback`;
  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  if (!r.ok) throw new Error(`TikTok token exchange ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  if (data.error) throw new Error(`TikTok ${data.error}: ${data.error_description}`);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000),
    refresh_expires_at: Date.now() + (data.refresh_expires_in * 1000),
    scope: data.scope,
    open_id: data.open_id,
  };
}

export async function refreshIfNeeded(env, tokens) {
  // Refresh if access token expires in <5 minutes
  if (tokens.expires_at && tokens.expires_at - Date.now() > 5 * 60 * 1000) return tokens;
  if (!tokens.refresh_token) return tokens;
  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  });
  if (!r.ok) throw new Error(`TikTok refresh ${r.status}`);
  const data = await r.json();
  if (data.error) throw new Error(`TikTok refresh ${data.error}: ${data.error_description}`);
  return {
    ...tokens,
    access_token: data.access_token,
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000),
    refresh_expires_at: Date.now() + (data.refresh_expires_in * 1000),
  };
}
