#!/usr/bin/env bash
# Push local → live (same every time). From your Mac, project root:
#   ./scripts/deploy-vps.sh
#   npm run deploy
# Builds production Nuxt, rsyncs .output/ to the VPS, then restarts PM2 (default: aielegance).
#
# Overrides:
#   VPS_HOST=... VPS_PATH=... NUXT_PUBLIC_POCKETBASE_URL=...
#   DEPLOY_PM2_NAME=myapp          (default: aielegance)
#   DEPLOY_SKIP_RESTART=1          (only rsync, no restart)
#   DEPLOY_SKIP_BUILD=1            (skip npm run build — use after a fresh local `NUXT_PUBLIC_POCKETBASE_URL=... npm run build`)
#   DEPLOY_SYSTEMD_UNIT=foo        (use systemd instead of pm2)
#   DEPLOY_SSH_CMD='ssh ...'       (custom command after rsync)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${VPS_HOST:=root@163.245.212.43}"
: "${VPS_PATH:=/var/www/aielegance}"
: "${DEPLOY_PM2_NAME:=aielegance}"
# Browser-facing PocketBase (HTTPS on live site — avoids mixed-content on https://aielegance.com/)
: "${NUXT_PUBLIC_POCKETBASE_URL:=https://aielegance.com/pb}"

if [ "${DEPLOY_SKIP_BUILD:-0}" = "1" ]; then
  echo "==> Skipping build (DEPLOY_SKIP_BUILD=1). Using existing .output/"
else
  echo "==> Building with NUXT_PUBLIC_POCKETBASE_URL=$NUXT_PUBLIC_POCKETBASE_URL"
  # Drop dev client output only (avoids stale chunks). Stop `npm run dev` first — parallel dev + this rm can race Nuxt’s mkdir.
  rm -rf .nuxt/dist
  export NUXT_PUBLIC_POCKETBASE_URL
  npm run build
fi

echo "==> Rsync .output/ → $VPS_HOST:$VPS_PATH/.output/"
rsync -avz --delete -e ssh "$ROOT/.output/" "$VPS_HOST:$VPS_PATH/.output/"

# Nitro keeps the old _nuxt manifest in memory until the Node process restarts.
if [ "${DEPLOY_SKIP_RESTART:-0}" = "1" ]; then
  echo "==> Skipping restart (DEPLOY_SKIP_RESTART=1). Run on VPS: pm2 restart $DEPLOY_PM2_NAME"
elif [ -n "${DEPLOY_SYSTEMD_UNIT:-}" ]; then
  echo "==> Restarting systemd: $DEPLOY_SYSTEMD_UNIT"
  ssh "$VPS_HOST" "sudo systemctl restart $DEPLOY_SYSTEMD_UNIT"
elif [ -n "${DEPLOY_SSH_CMD:-}" ]; then
  echo "==> Running: $DEPLOY_SSH_CMD"
  eval "$DEPLOY_SSH_CMD"
else
  echo "==> Restarting PM2 on server: $DEPLOY_PM2_NAME"
  if ssh "$VPS_HOST" "command -v pm2 >/dev/null 2>&1 && pm2 restart $DEPLOY_PM2_NAME" \
    || ssh "$VPS_HOST" "bash -lc 'pm2 restart $DEPLOY_PM2_NAME'"; then
    echo "==> PM2 restart OK — hard-refresh https://aielegance.com (private window if needed)."
  else
    echo "WARN: Could not pm2 restart over SSH. On the VPS run:"
    echo "      pm2 restart $DEPLOY_PM2_NAME"
    echo "    Only one process should listen on 3000:  ss -tlnp | grep 3000"
  fi
fi
