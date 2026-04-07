#!/usr/bin/env bash
# One-shot: fix broken .nuxt permissions, reset cache, free common dev ports, start Nuxt.
# Usage from project root:  npm run dev:fix
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> dev-fix: repairing local Nuxt dev environment"

if [ -e .nuxt ] && [ ! -w .nuxt ]; then
  echo "    .nuxt is not writable (often root-owned after sudo build)."
  echo "    Running: sudo chown -R \"\$(whoami)\" .nuxt .output"
  sudo chown -R "$(whoami)" .nuxt .output
fi
chmod -R u+w .nuxt .output node_modules/.cache 2>/dev/null || true
rm -rf .nuxt node_modules/.cache/jiti node_modules/.vite 2>/dev/null || true

node scripts/ensure-nuxt-build-dir.mjs
npx nuxt prepare

if command -v lsof >/dev/null 2>&1; then
  for port in 3000 3001; do
    pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
    if [ -n "${pids:-}" ]; then
      echo "==> Freeing port $port (stopping PID(s): $pids)"
      kill $pids 2>/dev/null || true
      sleep 0.5
      pids2=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
      if [ -n "${pids2:-}" ]; then
        kill -9 $pids2 2>/dev/null || true
      fi
    fi
  done
fi

echo "==> Starting Nuxt on http://localhost:3000"
exec npx nuxt dev --port 3000
