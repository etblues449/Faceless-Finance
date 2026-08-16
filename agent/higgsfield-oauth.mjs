#!/usr/bin/env node
/**
 * ONE-TIME — obtain a Higgsfield MCP OAuth token for a Managed Agents vault.
 *
 * mcp.higgsfield.ai uses OAuth 2.0 (authorization_code + PKCE, refresh tokens),
 * and the `ant` CLI does NOT run the browser login for you — so this script does
 * it once and prints the exact `ant beta:vaults:credentials create` command to
 * store the result in a vault.
 *
 * RUN THIS ON YOUR OWN MACHINE (it opens a localhost callback your browser hits):
 *   node agent/higgsfield-oauth.mjs
 *
 * It registers a public PKCE client dynamically by default. If you already have a
 * Higgsfield OAuth client, pass it instead:
 *   HF_CLIENT_ID=... [HF_CLIENT_SECRET=...] node agent/higgsfield-oauth.mjs
 *
 * Requires Node 18+ (global fetch). No npm install needed.
 * Nothing is written to disk; tokens print to YOUR terminal only.
 */
import http from "node:http";
import crypto from "node:crypto";

const MCP_URL = "https://mcp.higgsfield.ai/mcp";
const AS_METADATA = "https://mcp.higgsfield.ai/.well-known/oauth-authorization-server";
const PORT = Number(process.env.PORT ?? 8765);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = "openid email offline_access"; // offline_access => refresh token
const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function main() {
  const meta = await (await fetch(AS_METADATA)).json();
  const { authorization_endpoint, token_endpoint, registration_endpoint } = meta;
  if (!authorization_endpoint || !token_endpoint) {
    throw new Error("Could not read authorization/token endpoints from metadata");
  }

  // --- Client: reuse env-provided, else dynamic-register a public PKCE client ---
  let clientId = process.env.HF_CLIENT_ID;
  let clientSecret = process.env.HF_CLIENT_SECRET; // optional
  if (!clientId) {
    if (!registration_endpoint) throw new Error("No registration_endpoint; set HF_CLIENT_ID");
    const reg = await fetch(registration_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "faceless-finance-headless",
        redirect_uris: [REDIRECT_URI],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        scope: SCOPE,
      }),
    });
    if (!reg.ok) throw new Error(`Dynamic registration failed ${reg.status}: ${await reg.text()}`);
    const c = await reg.json();
    clientId = c.client_id;
    clientSecret = c.client_secret; // usually absent for public clients
    console.log(`Registered client_id: ${clientId}`);
  }

  // --- PKCE + state ---
  const verifier = b64url(crypto.randomBytes(64));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  const authUrl = new URL(authorization_endpoint);
  authUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  console.log("\n1) Open this URL in your browser and authorize Higgsfield:\n");
  console.log(authUrl.toString() + "\n");

  // --- Wait for the redirect ---
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT_URI);
      if (u.pathname !== "/callback") { res.writeHead(404).end(); return; }
      const err = u.searchParams.get("error");
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<h2>Done — you can close this tab and return to the terminal.</h2>");
      server.close();
      if (err) return reject(new Error(`Authorization error: ${err} ${u.searchParams.get("error_description") ?? ""}`));
      if (u.searchParams.get("state") !== state) return reject(new Error("state mismatch (possible CSRF)"));
      const c = u.searchParams.get("code");
      if (!c) return reject(new Error("no authorization code in callback"));
      resolve(c);
    });
    server.listen(PORT, "127.0.0.1", () => console.log(`Waiting for callback on ${REDIRECT_URI} ...`));
  });

  // --- Exchange code for tokens ---
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: verifier,
  });
  if (clientSecret) body.set("client_secret", clientSecret); // client_secret_post
  const tok = await fetch(token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tok.ok) throw new Error(`Token exchange failed ${tok.status}: ${await tok.text()}`);
  const t = await tok.json();
  if (!t.refresh_token) {
    console.warn("\nWARNING: no refresh_token returned. The vault won't be able to auto-refresh.\n" +
      "Make sure the 'offline_access' scope was granted.\n");
  }
  const expiresAt = new Date(Date.now() + (Number(t.expires_in ?? 3600) * 1000)).toISOString();
  const authBlock = clientSecret
    ? `      type: client_secret_post\n      client_secret: ${clientSecret}`
    : `      type: none`;

  // --- Print the ready-to-run vault credential command ---
  console.log("\n2) Create the vault (once) and store this credential:\n");
  console.log(`VAULT_ID=$(ant beta:vaults create --display-name faceless-finance --transform id --raw-output)`);
  console.log(`ant beta:vaults:credentials create --vault-id "$VAULT_ID" <<'EOF'`);
  console.log(`display_name: Higgsfield (faceless-finance)`);
  console.log(`auth:`);
  console.log(`  type: mcp_oauth`);
  console.log(`  mcp_server_url: ${MCP_URL}`);
  console.log(`  access_token: ${t.access_token}`);
  console.log(`  expires_at: "${expiresAt}"`);
  console.log(`  refresh:`);
  console.log(`    token_endpoint: ${token_endpoint}`);
  console.log(`    client_id: ${clientId}`);
  console.log(`    scope: ${SCOPE}`);
  console.log(`    refresh_token: ${t.refresh_token ?? "<none-returned>"}`);
  console.log(`    token_endpoint_auth:`);
  console.log(authBlock);
  console.log(`EOF`);
  console.log(`\n3) Then set FF_VIDEO_VAULT_ID=$VAULT_ID for run-session.ts.\n`);
}

main().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
