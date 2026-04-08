#!/usr/bin/env bash
# Create missing PocketBase collections (creative_projects, scenes, assets, etc.)
# against a remote instance — run from your Mac, repo root.
#
#   POCKETBASE_URL=https://aielegance.com/pb \
#   POCKETBASE_ADMIN_EMAIL='you@example.com' \
#   POCKETBASE_ADMIN_PASSWORD='...' \
#   npm run setup-db
#
# Or pass only the URL; admin is read from env / .env or prompted:
#   ./scripts/setup-pocketbase-remote.sh https://aielegance.com/pb
#   npm run setup-db:remote -- https://aielegance.com/pb

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PB_URL="${1:-${POCKETBASE_URL:-}}"
if [ -z "$PB_URL" ]; then
  echo "PocketBase collection setup — API base URL required (no trailing slash)."
  echo ""
  echo "Example (live site):"
  echo "  POCKETBASE_URL=https://aielegance.com/pb \\"
  echo "  POCKETBASE_ADMIN_EMAIL='your@email' \\"
  echo "  POCKETBASE_ADMIN_PASSWORD='your-password' \\"
  echo "  npm run setup-db"
  echo ""
  echo "Or:"
  echo "  npm run setup-db:remote -- https://aielegance.com/pb"
  exit 1
fi

export POCKETBASE_URL="${PB_URL}"
echo "==> Running setup-collections against ${POCKETBASE_URL}"
exec npm run setup-db
