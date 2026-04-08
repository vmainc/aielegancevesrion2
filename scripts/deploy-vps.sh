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
#
# PocketBase parity with local: on the VPS, /var/www/aielegance/.env must define
# NUXT_PUBLIC_POCKETBASE_URL, POCKETBASE_INTERNAL_URL, POCKETBASE_ADMIN_* (and OPENROUTER_*).
# Template: deploy/vps.env.example — run setup-db against prod PB when collections change:
#   POCKETBASE_URL=https://aielegance.com/pb node scripts/setup-collections.js 'email' 'pass'

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
  # Always clean full Nuxt/Nitro artifacts before production build.
  # Partial cleanup can leave a stale SSR server entry and cause runtime 500:
  # "TypeError: _createApp is not a function".
  # chmod first: Docker/sudo builds sometimes leave root-owned files and `rm` fails with Permission denied.
  _me="$(id -un)"
  for _d in .nuxt .output; do
    if [ -d "$_d" ] && { [ ! -O "$_d" ] || find "$_d" -not -user "$_me" -print -quit 2>/dev/null | grep -q .; }; then
      echo "WARN: $_d is not fully owned by $_me (often from sudo npm run build or Docker)."
      echo "      Fix from the project root, then rerun deploy:"
      echo "        sudo chown -R \"$_me\" .nuxt .output && rm -rf .nuxt .output"
      exit 1
    fi
  done
  for _d in .nuxt .output; do
    [ -d "$_d" ] && chmod -R u+w "$_d" 2>/dev/null || true
  done
  if ! rm -rf .nuxt .output; then
    echo "ERROR: Could not remove .nuxt or .output (permission denied)."
    echo "Fix ownership on your Mac from the project root, then rerun deploy:"
    echo "  sudo chown -R \"\$(whoami)\" .nuxt .output && rm -rf .nuxt .output"
    exit 1
  fi
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

echo ""
echo "==> Reminder: VPS .env should mirror deploy/vps.env.example (PB URL, INTERNAL_URL, admin, OpenRouter)."
echo "    PocketBase admin UI allowed origins: include https://aielegance.com (see pocketbase/README.md)."
