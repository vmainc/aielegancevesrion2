#!/usr/bin/env bash
# Deploy the compare app to :3001, then retarget only aielegance.com nginx.
# Aborts if :3001 is not healthy (will not leave aielegance.com on a 502).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/deploy-vps.sh"
"$ROOT/scripts/apply-nginx.sh"
echo "==> Public checks"
curl -sS -o /dev/null -w "aielegance.com=%{http_code}\\n" --max-time 15 https://aielegance.com/ || true
curl -sS -o /dev/null -w "aifilmstud.io=%{http_code}\\n" --max-time 15 https://aifilmstud.io/ || true
