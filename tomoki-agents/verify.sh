#!/usr/bin/env bash
set -euo pipefail
python -m py_compile tomoki-agents/slack_post.py tomoki-agents/policy_gate.py

if git diff --name-only | grep -q '^sales-command-30/'; then
  pushd sales-command-30 >/dev/null
  if [[ -f package-lock.json ]]; then
    npm ci --ignore-scripts
  else
    npm install --ignore-scripts --package-lock=false
  fi
  npm run build
  popd >/dev/null
fi

echo 'VERIFY_PASS'
