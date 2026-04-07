#!/usr/bin/env bash
# Start PocketBase (if not already on :8090), then Nuxt dev on :3000.
# Usage: npm run dev:pb
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PB_BIN="$ROOT/pocketbase/pocketbase"
if [ ! -x "$PB_BIN" ]; then
  echo "ERROR: PocketBase binary not found or not executable: $PB_BIN"
  echo "Download from https://github.com/pocketbase/pocketbase/releases and place it in pocketbase/"
  exit 1
fi

PB_PID=""
if lsof -nP -iTCP:8090 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "==> PocketBase already listening on http://127.0.0.1:8090 (skipping start)"
else
  echo "==> Starting PocketBase on http://127.0.0.1:8090 (admin UI: http://127.0.0.1:8090/_/)"
  ( cd "$ROOT/pocketbase" && exec ./pocketbase serve --http=127.0.0.1:8090 ) &
  PB_PID=$!
  sleep 2
  cleanup () { [ -n "$PB_PID" ] && kill "$PB_PID" 2>/dev/null || true; }
  trap cleanup EXIT INT TERM
fi

echo "==> Starting Nuxt on http://localhost:3000"
# Do not use exec so EXIT trap can stop PocketBase when we started it
npx nuxt dev --port 3000
