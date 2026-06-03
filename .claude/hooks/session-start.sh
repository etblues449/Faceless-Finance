#!/bin/bash
set -euo pipefail

# Session start hook for Faceless-Finance.
# Installs dependencies so the Cloudflare Worker and the Python pipeline can be
# validated/run in Claude Code on the web sessions.
#   - worker/  : Cloudflare Worker (wrangler) -> npm install
#   - pipeline/: zero-config Python service that only needs `requests`
#                (see .github/workflows/faceless.yml: `pip install requests`).

# Only run in Claude Code on the web (remote) environments.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Run asynchronously so the session starts without waiting for the install
# (ffmpeg in particular can take a while to fetch).
echo '{"async": true, "asyncTimeout": 600000}'

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Cloudflare Worker dependencies.
if [ -f worker/package.json ]; then
  (cd worker && npm install)
fi

# Python pipeline dependency (single third-party package).
python3 -m pip install --quiet --disable-pip-version-check requests

# ffmpeg: required by the pipeline's render/stitch step.
if ! command -v ffmpeg >/dev/null 2>&1; then
  SUDO=""
  [ "$(id -u)" -ne 0 ] && SUDO="sudo"
  $SUDO apt-get update -qq && $SUDO apt-get install -y -qq ffmpeg
fi
