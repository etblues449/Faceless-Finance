#!/usr/bin/env bash
# ONE-TIME SETUP — create the agent + environment, then save the IDs.
# Run again with `update` (see bottom) when you change the YAML; do NOT
# re-create on every run.
#
# Requires the Anthropic CLI (`ant`) and ANTHROPIC_API_KEY in your env.
#   brew install anthropics/tap/ant   # or see platform.claude.com/docs/en/api/sdks/cli
set -euo pipefail
cd "$(dirname "$0")"

AGENT_ID=$(ant beta:agents create < faceless-finance-video.agent.yaml --transform id -r)
ENV_ID=$(ant beta:environments create < faceless-finance.environment.yaml --transform id -r)

echo "AGENT_ID=$AGENT_ID"
echo "ENV_ID=$ENV_ID"
echo
echo "Save these as Wrangler/CI secrets (used by run-session.ts):"
echo "  FF_AGENT_ID=$AGENT_ID"
echo "  FF_ENVIRONMENT_ID=$ENV_ID"

# --- Vault for the video_studio MCP server (needed only for rendering) -----
# The agent declares the MCP server URL but no auth. Credentials live in a vault
# attached to the session via vault_ids. Anthropic matches the credential to the
# server by URL and auto-refreshes the OAuth token.
#
# 1. Set the real MCP endpoint in faceless-finance-video.agent.yaml
#    (mcp_servers[0].url) — the same video-platform connector you use in Claude
#    Code. Re-run the agent update after editing.
# 2. Obtain an OAuth access+refresh token for that MCP server (via the provider's
#    auth flow), then create the vault + credential:
#
#   VAULT_ID=$(ant beta:vaults create --name faceless-finance-video --transform id -r)
#   ant beta:vaults:credentials create --vault-id "$VAULT_ID" --auth '{
#     type: mcp_oauth,
#     mcp_server_url: "https://mcp.your-video-provider.example/mcp",
#     access_token: "<access-token>",
#     expires_at: "<iso8601>",
#     refresh: {
#       refresh_token: "<refresh-token>",
#       client_id: "<oauth-client-id>",
#       token_endpoint: "https://<provider>/oauth/token",
#       token_endpoint_auth: { type: none }
#     }
#   }'
#   echo "FF_VIDEO_VAULT_ID=$VAULT_ID"
#
# Rendering also needs ELEVENLABS_KEY + ELEVENLABS_VOICE_ID on the orchestrator
# (voiceover is host-side; the MCP server has no TTS tool).

# --- CI sync (after editing the YAML) -------------------------------------
# Agents/environments are versioned; update in place instead of re-creating:
#   ant beta:agents update       --agent-id "$FF_AGENT_ID"       --version N < faceless-finance-video.agent.yaml
#   ant beta:environments update --environment-id "$FF_ENVIRONMENT_ID"        < faceless-finance.environment.yaml
