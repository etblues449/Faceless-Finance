// Token storage in Cloudflare KV. Encrypted at rest by Cloudflare. Additional layer:
// we encrypt the access_token / refresh_token client-side with a worker-secret key
// before storing, so even if KV is compromised the tokens are still useless without
// the ENCRYPTION_KEY env secret.

const ALG = { name: 'AES-GCM', length: 256 };

async function getKey(secret) {
  const enc = new TextEncoder();
  const raw = enc.encode(secret.padEnd(32).slice(0, 32));
  return crypto.subtle.importKey('raw', raw, ALG, false, ['encrypt', 'decrypt']);
}

export async function encrypt(secret, plaintext) {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0); out.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decrypt(secret, b64) {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv = bin.slice(0, 12); const ct = bin.slice(12);
  const key = await getKey(secret);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

const tokenKey = (platform, userId) => `tokens:${platform}:${userId}`;
const stateKey = (state) => `state:${state}`;

export async function saveTokens(env, platform, userId, tokenObj) {
  const ciphertext = await encrypt(env.ENCRYPTION_KEY, JSON.stringify(tokenObj));
  await env.TOKENS.put(tokenKey(platform, userId), ciphertext, {
    metadata: { saved_at: Date.now(), expires_at: tokenObj.expires_at || null },
  });
}

export async function loadTokens(env, platform, userId) {
  const ciphertext = await env.TOKENS.get(tokenKey(platform, userId));
  if (!ciphertext) return null;
  try { return JSON.parse(await decrypt(env.ENCRYPTION_KEY, ciphertext)); }
  catch { return null; }
}

export async function deleteTokens(env, platform, userId) {
  await env.TOKENS.delete(tokenKey(platform, userId));
}

// State token for OAuth (CSRF protection). 5-minute TTL.
export async function saveState(env, state, payload) {
  await env.TOKENS.put(stateKey(state), JSON.stringify(payload), { expirationTtl: 300 });
}
export async function loadState(env, state) {
  const v = await env.TOKENS.get(stateKey(state));
  if (!v) return null;
  await env.TOKENS.delete(stateKey(state));
  return JSON.parse(v);
}

export function newState() {
  return crypto.randomUUID();
}
