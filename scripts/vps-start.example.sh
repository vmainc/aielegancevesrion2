#!/usr/bin/env bash
# Copy to your VPS (e.g. /var/www/aielegance/start.sh), chmod +x, and use a .env file
# with ASCII-only quotes. Do not use “smart quotes” from Word/Slack — use ' or ".

set -euo pipefail
APP_DIR="${1:-/var/www/aielegance}"
ENV_FILE="${APP_DIR}/.env"
cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — create it with nano (plain apostrophes only)."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"

exec node .output/server/index.mjs
