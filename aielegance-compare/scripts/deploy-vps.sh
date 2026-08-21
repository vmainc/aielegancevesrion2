#!/usr/bin/env bash
# Build this app, rsync to /var/www/aielegance-com, restart PM2 aielegance-com.
# Does not touch /var/www/aielegance or PM2 process "aielegance".
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${VPS_HOST:=root@163.245.212.43}"
: "${VPS_PATH:=/var/www/aielegance-com}"
: "${DEPLOY_PM2_NAME:=aielegance-com}"
: "${APP_PORT:=3001}"

SSH_BASE_OPTS="-o ServerAliveInterval=30 -o ServerAliveCountMax=6"
if [ "${DEPLOY_SSH_DISABLE_MUX:-0}" = "1" ]; then
  SSH_CMD="ssh $SSH_BASE_OPTS"
  RSYNC_SSH="ssh $SSH_BASE_OPTS"
else
  SSH_CONTROL_PATH="/tmp/aielegance-com-deploy-ctrl-%r@%h:%p"
  SSH_MUX_OPTS="-o ControlMaster=auto -o ControlPersist=10m -o ControlPath=$SSH_CONTROL_PATH"
  SSH_CMD="ssh $SSH_BASE_OPTS $SSH_MUX_OPTS"
  RSYNC_SSH="ssh $SSH_BASE_OPTS $SSH_MUX_OPTS"
fi

if [ "${DEPLOY_SKIP_BUILD:-0}" != "1" ]; then
  echo "==> Building AIElegance compare"
  npm run build
fi

echo "==> Ensure $VPS_PATH exists on server (does not touch /var/www/aielegance)"
$SSH_CMD "$VPS_HOST" "mkdir -p '$VPS_PATH/.output'"

echo "==> Rsync .output/ → $VPS_HOST:$VPS_PATH/.output/"
rsync -avz --delete -e "$RSYNC_SSH" "$ROOT/.output/" "$VPS_HOST:$VPS_PATH/.output/"

echo "==> Sync ecosystem file"
rsync -avz -e "$RSYNC_SSH" "$ROOT/deploy/ecosystem.config.cjs" "$VPS_HOST:$VPS_PATH/ecosystem.config.cjs"

echo "==> Restart PM2 $DEPLOY_PM2_NAME on port $APP_PORT"
$SSH_CMD "$VPS_HOST" bash -s <<EOS
set -euo pipefail
cd '$VPS_PATH'
if [ ! -f .env ]; then
  echo "ERROR: $VPS_PATH/.env is missing. Copy from the app .env.example and set OPENROUTER_API_KEY."
  exit 1
fi
export HOST=127.0.0.1
export PORT='$APP_PORT'
if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 is not installed"
  exit 1
fi
if pm2 describe '$DEPLOY_PM2_NAME' >/dev/null 2>&1; then
  pm2 restart '$DEPLOY_PM2_NAME' --update-env
else
  HOST=127.0.0.1 PORT='$APP_PORT' pm2 start '$VPS_PATH/.output/server/index.mjs' --name '$DEPLOY_PM2_NAME' --cwd '$VPS_PATH'
fi
pm2 save
EOS

echo "==> Done. Film Studio PM2 'aielegance' was not restarted."
echo "    Apply nginx last: ./scripts/apply-nginx.sh"
