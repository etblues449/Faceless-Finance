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

# --- Rendering -------------------------------------------------------------
# This agent produces script.txt + storyboard.json only. The video platform
# (Higgsfield) is exposed as a Claude Code connector, not a standalone server
# with a reusable URL/credential, so the Managed Agent cannot render headlessly.
# To render the storyboard into cinematic clips, run the render-storyboard skill
# in a Claude Code session (where the Higgsfield connector is live):
#   .claude/skills/render-storyboard/SKILL.md
# Optional VO preview needs ELEVENLABS_KEY + ELEVENLABS_VOICE_ID on the orchestrator.

# --- CI sync (after editing the YAML) -------------------------------------
# Agents/environments are versioned; update in place instead of re-creating:
#   ant beta:agents update       --agent-id "$FF_AGENT_ID"       --version N < faceless-finance-video.agent.yaml
#   ant beta:environments update --environment-id "$FF_ENVIRONMENT_ID"        < faceless-finance.environment.yaml
