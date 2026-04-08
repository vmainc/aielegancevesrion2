#!/usr/bin/env bash
# Re-runs dev-with-pb.sh whenever Nuxt or the script exits (crash, OOM, killed tab, etc.).
# PocketBase + Nuxt: same as npm run dev:pb, but auto-restarts.
#
# Usage: npm run dev:pb:watch
# Env:
#   DEV_WATCH_RESTART_SEC  seconds between restarts (default 3)
# Stop: Ctrl+C — if the stack just died, press Ctrl+C again during the countdown to exit the watcher.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

quit () {
  echo ""
  echo "==> dev-watch: stopped."
  exit 0
}
trap quit INT TERM

DELAY="${DEV_WATCH_RESTART_SEC:-3}"

while true; do
  echo ""
  echo "==> dev-watch: starting stack ($(date '+%H:%M:%S'))"
  bash "$ROOT/scripts/dev-with-pb.sh"
  ec=$?
  echo ""
  echo "==> dev-watch: stack exited (code $ec). Restarting in ${DELAY}s — Ctrl+C to stop watching."
  sleep "$DELAY" || quit
done
