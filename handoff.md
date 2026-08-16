# Handoff — Faceless Finance video pipeline (Higgsfield rendering)

_Last updated: 2026-05-25 · branch `claude/compassionate-babbage-PksdU` · PR #80_

## Goal
Stand up a **Managed Agent** that turns one UK personal-finance topic into a
production-ready **cinematic** short-form script + storyboard (the app's v2
Storyboard schema), and **render** those scenes into clips via the **Higgsfield**
video platform. Channel is cinematic b-roll + voiceover ONLY — never
talking-head/avatar. This session's focus: wire the video rendering.

## Current state of the code (all committed + pushed)
Recent commits (newest first):
- `aa0b673` Add `--render` flag to run-session for headless rendering
- `e15b5d2` Wire headless rendering to the real Higgsfield MCP server (OAuth)
- `da1b86f` (superseded) in-session skill approach
- `5f5ef0d` (superseded) generic MCP placeholder wiring
- `aa8dd08` Align agent output to the app's v2 Storyboard schema + tone presets
- `c07c3c8` Managed Agent scaffolding

Where things stand: the headless pipeline is **fully wired but UNTESTED** — this
cloud environment has no `ant` CLI, no `ANTHROPIC_API_KEY`, and no browser, so
none of the create/login steps can run here. The agent declares the real
Higgsfield MCP server with auto-approved tools; auth is OAuth and must be minted
on the user's machine.

### Key facts established this session
- The video tools are **Higgsfield**'s MCP. In a Claude Code session they're a
  live connector (account is **Ultra, ~3000 credits** — verified via `balance`).
- Public endpoint: **`https://mcp.higgsfield.ai/mcp`**.
- Auth is **OAuth 2.0** (authorization_code + PKCE, refresh tokens), Clerk-backed
  — NOT a static API key. Discovered via the 401 `www-authenticate` + the
  `.well-known/oauth-authorization-server` metadata:
  - authorization_endpoint `https://mcp.higgsfield.ai/oauth2/authorize`
  - token_endpoint `https://mcp.higgsfield.ai/oauth2/token`
  - registration_endpoint `https://mcp.higgsfield.ai/oauth2/register` (dynamic reg OK)
  - scopes `openid email offline_access` (offline_access ⇒ refresh token)
- Managed Agents vault credential types: `static_bearer` (one `token`) and
  `mcp_oauth` (`access_token` + `refresh.{token_endpoint, client_id,
  refresh_token, token_endpoint_auth}`). The `ant` CLI does **not** run the
  browser login — tokens must be obtained out-of-band.
- MCP toolsets default to `always_ask`; set
  `default_config.permission_policy.type: always_allow` for unattended runs.

## Files touched this session
- **`agent/faceless-finance-video.agent.yaml`** — declares `mcp_servers: higgsfield`
  (`https://mcp.higgsfield.ai/mcp`) + an `mcp_toolset` with
  `permission_policy: always_allow`; system prompt renders on explicit request
  (cost preflight → keyframe → image-to-video per scene → `renders.json`). Still
  produces `script.txt` + `storyboard.json` by default. Keeps host-side custom
  tools `pexels_search` + `elevenlabs_tts`.
- **`agent/run-session.ts`** — orchestrator. Attaches vault via
  `FF_VIDEO_VAULT_ID`; added `--render` (or `RENDER=1`) flag that switches the
  kickoff to ask for rendering. Custom tools (Pexels/ElevenLabs) run host-side.
- **`agent/higgsfield-oauth.mjs`** (NEW) — one-time login helper. Dynamic-registers
  a public PKCE client (or uses `HF_CLIENT_ID`/`HF_CLIENT_SECRET`), runs the
  authorization_code+PKCE flow on `127.0.0.1:8765`, exchanges the code, and prints
  the exact `ant beta:vaults:credentials create` command for the `mcp_oauth`
  credential. Node 18+, built-ins only.
- **`agent/setup.sh`** — creates agent + env; documents the `static_bearer`
  quick-test curl, the OAuth helper path, and attaching the vault.
- **`.claude/skills/render-storyboard/SKILL.md`** (NEW) — interactive alternative:
  render a storyboard from a Claude Code session via the Higgsfield connector
  (cost-controlled, no vault needed).

Demo artifacts (NOT in repo, in `/home/user/ff-demo/`): `keyframe.png`,
`clip.mp4` — proof the connector renders end-to-end (~9.5 credits spent).

## What was tried and didn't work (and why)
1. **Generic `mcp_servers` URL placeholder + vault scaffolding** (commit
   `5f5ef0d`). Wrong: there was no fillable URL — the video tools were a
   **session-scoped Claude Code connector** proxied through
   `api.anthropic.com/v2/ccr-sessions/cse_.../mcp`, which dies with the session.
   The placeholder URL would never resolve and could error a headless session.
2. **Discovering the connector's real URL from local config/transcripts** — not
   present; it's platform-injected, not in `~/.claude.json`.
3. **Rendering headlessly from *this* environment** — blocked: no `ant` CLI, no
   `ANTHROPIC_API_KEY`, no browser. Reverted to an in-session skill (commit
   `da1b86f`) until the user supplied the real public URL.
4. **Treating the user's "key and secret" as a static bearer** — probably wrong:
   the endpoint advertises only OAuth (no `client_credentials` grant). May still
   work as a raw bearer; that's exactly the untested quick-test in step 2 below.
5. **`higgsfield-oauth.mjs` end-to-end** — could not be run/verified here (no
   browser, no `ant`). It is written to standard OAuth2 + the discovered metadata
   but has never executed.

## The single next thing to try (and why)
**Run the `static_bearer` quick-test curl** from `agent/setup.sh` step (a) on a
real machine:
```
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://mcp.higgsfield.ai/mcp \
  -H "authorization: Bearer $HIGGSFIELD_KEY" \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}'
```
**Why:** it's a single command and the cheapest decision point. If it returns
anything but `401`, the whole OAuth helper is unnecessary — store the key as
`static_bearer` and the headless pipeline is done. If it returns `401` (expected),
proceed to `node higgsfield-oauth.mjs` for the one-time login. Either way it
validates the one piece that has never been exercised before any further build.

## After that
- If 401 → run `higgsfield-oauth.mjs`; if it errors, capture the message (the
  likely failure points are dynamic registration rejecting the localhost
  redirect, or the token exchange auth method).
- Optional: fold `setup.sh` + the vault step into one `setup-headless.sh`.
- If `ant beta:agents create` rejects the top-level `description` field, drop it
  from the agent YAML.
