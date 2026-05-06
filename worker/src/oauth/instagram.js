// Instagram Graph API OAuth via Facebook Login
// Docs: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/get-started
//
// Note: This requires the Instagram account to be a Business or Creator account
// linked to a Facebook Page. Personal accounts are NOT supported by this API.

const SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
].join(',');

export function buildAuthUrl(env, state, request) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/oauth/instagram/callback`;
  const auth = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  auth.searchParams.set('client_id', env.META_APP_ID);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('scope', SCOPES);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('state', state);
  return auth.toString();
}

export async function exchangeCode(env, code, request) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/oauth/instagram/callback`;

  // Step 1: short-lived user access token
  const short = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?` + new URLSearchParams({
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  }));
  if (!short.ok) throw new Error(`IG short token ${short.status}: ${(await short.text()).slice(0, 300)}`);
  const shortData = await short.json();

  // Step 2: exchange for long-lived (~60 days) token
  const long = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?` + new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    fb_exchange_token: shortData.access_token,
  }));
  if (!long.ok) throw new Error(`IG long token ${long.status}: ${(await long.text()).slice(0, 300)}`);
  const longData = await long.json();

  // Step 3: find the user's IG Business account ID via their FB pages
  const pagesResp = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${longData.access_token}`);
  const pagesData = await pagesResp.json();
  const page = pagesData.data?.[0];
  if (!page) throw new Error('No Facebook Page found. IG account must be linked to a Page.');
  const igResp = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
  const igData = await igResp.json();
  const igUserId = igData.instagram_business_account?.id;
  if (!igUserId) throw new Error('No Instagram Business account linked to this Facebook Page.');

  return {
    access_token: longData.access_token,
    page_access_token: page.access_token,
    page_id: page.id,
    ig_user_id: igUserId,
    expires_at: Date.now() + ((longData.expires_in || 60 * 86400) * 1000),
    handle: page.name,
  };
}

export async function refreshIfNeeded(env, tokens) {
  // Long-lived IG tokens are 60 days. Refresh when <7 days remaining.
  if (tokens.expires_at && tokens.expires_at - Date.now() > 7 * 86400 * 1000) return tokens;
  const r = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?` + new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    fb_exchange_token: tokens.access_token,
  }));
  if (!r.ok) return tokens;
  const data = await r.json();
  return {
    ...tokens,
    access_token: data.access_token,
    expires_at: Date.now() + ((data.expires_in || 60 * 86400) * 1000),
  };
}
