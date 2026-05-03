// YouTube Data API v3 OAuth via Google Identity
// Docs: https://developers.google.com/identity/protocols/oauth2/web-server

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'].join(' ');

export function buildAuthUrl(env, state, request) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/oauth/youtube/callback`;
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', SCOPES);
  auth.searchParams.set('access_type', 'offline');
  auth.searchParams.set('prompt', 'consent');
  auth.searchParams.set('state', state);
  auth.searchParams.set('include_granted_scopes', 'true');
  return auth.toString();
}

export async function exchangeCode(env, code, request) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/oauth/youtube/callback`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  if (!r.ok) throw new Error(`YouTube token exchange ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  if (data.error) throw new Error(`YouTube ${data.error}: ${data.error_description}`);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000),
    scope: data.scope,
    token_type: data.token_type,
  };
}

export async function refreshIfNeeded(env, tokens) {
  if (tokens.expires_at && tokens.expires_at - Date.now() > 5 * 60 * 1000) return tokens;
  if (!tokens.refresh_token) return tokens;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) throw new Error(`YouTube refresh ${r.status}`);
  const data = await r.json();
  return {
    ...tokens,
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000),
  };
}
