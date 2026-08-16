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

# --- Rendering: Higgsfield MCP (OAuth) -------------------------------------
# The agent declares the Higgsfield MCP server (https://mcp.higgsfield.ai/mcp).
# Its auth is OAuth 2.0; supply it at session time via a vault, matched by URL.
#
# (a) Quick test — does your Higgsfield key work as a plain bearer? If this prints
#     anything other than 401, skip OAuth and use static_bearer:
#       curl -s -o /dev/null -w '%{http_code}\n' -X POST https://mcp.higgsfield.ai/mcp \
#         -H "authorization: Bearer $HIGGSFIELD_KEY" \
#         -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
#         -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}'
#     If it works:
#       VAULT_ID=$(ant beta:vaults create --display-name faceless-finance --transform id --raw-output)
#       ant beta:vaults:credentials create --vault-id "$VAULT_ID" <<EOF
#       auth:
#         type: static_bearer
#         mcp_server_url: https://mcp.higgsfield.ai/mcp
#         token: $HIGGSFIELD_KEY
#       EOF
#
# (b) Otherwise (it returned 401, which is expected) — do the one-time OAuth login.
#     This prints the exact vault-credential command to run:
#       node higgsfield-oauth.mjs        # or: HF_CLIENT_ID=.. HF_CLIENT_SECRET=.. node higgsfield-oauth.mjs
#
# Then attach the vault at session time:
#   export FF_VIDEO_VAULT_ID="$VAULT_ID"  # run-session.ts reads this
#
# You can also render interactively (no vault) with the render-storyboard skill
# in a Claude Code session. Optional VO preview needs ELEVENLABS_KEY +
# ELEVENLABS_VOICE_ID on the orchestrator.

# --- CI sync (after editing the YAML) -------------------------------------
# Agents/environments are versioned; update in place instead of re-creating:
#   ant beta:agents update       --agent-id "$FF_AGENT_ID"       --version N < faceless-finance-video.agent.yaml
#   ant beta:environments update --environment-id "$FF_ENVIRONMENT_ID"        < faceless-finance.environment.yaml
