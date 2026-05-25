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

# --- CI sync (after editing the YAML) -------------------------------------
# Agents/environments are versioned; update in place instead of re-creating:
#   ant beta:agents update       --agent-id "$FF_AGENT_ID"       --version N < faceless-finance-video.agent.yaml
#   ant beta:environments update --environment-id "$FF_ENVIRONMENT_ID"        < faceless-finance.environment.yaml
