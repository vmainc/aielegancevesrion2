#!/usr/bin/env bash
# Build this app, rsync to /var/www/aielegance-com, start PM2 aielegance-com on :3001.
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

echo "==> Ensure $VPS_PATH exists (does not touch /var/www/aielegance)"
$SSH_CMD "$VPS_HOST" "mkdir -p '$VPS_PATH/.output'"

echo "==> Rsync .output/ + start.mjs + ecosystem"
rsync -avz --delete -e "$RSYNC_SSH" "$ROOT/.output/" "$VPS_HOST:$VPS_PATH/.output/"
rsync -avz -e "$RSYNC_SSH" "$ROOT/start.mjs" "$ROOT/deploy/ecosystem.config.cjs" "$VPS_HOST:$VPS_PATH/"

echo "==> Start/restart PM2 $DEPLOY_PM2_NAME on 127.0.0.1:$APP_PORT"
$SSH_CMD "$VPS_HOST" bash -s <<EOS
set -euo pipefail
cd '$VPS_PATH'
if [ ! -f .output/server/index.mjs ]; then
  echo "ERROR: $VPS_PATH/.output/server/index.mjs missing after rsync"
  exit 1
fi
if [ ! -f .env ]; then
  echo "WARN: $VPS_PATH/.env missing — app will listen on $APP_PORT but compare calls need OPENROUTER_API_KEY."
  echo "      Copy deploy/vps.env.example to $VPS_PATH/.env on the server."
fi
if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 is not installed"
  exit 1
fi
export HOST=127.0.0.1
export PORT='$APP_PORT'
export NITRO_HOST=127.0.0.1
export NITRO_PORT='$APP_PORT'
export NODE_ENV=production
if pm2 describe '$DEPLOY_PM2_NAME' >/dev/null 2>&1; then
  pm2 delete '$DEPLOY_PM2_NAME' || true
fi
pm2 start '$VPS_PATH/start.mjs' \\
  --name '$DEPLOY_PM2_NAME' \\
  --cwd '$VPS_PATH' \\
  --update-env
pm2 save
sleep 1
ss -tlnp | grep -E ':${APP_PORT}\\b' || {
  echo "ERROR: nothing listening on $APP_PORT after start"
  pm2 logs '$DEPLOY_PM2_NAME' --lines 40 --nostream
  exit 1
}
echo "OK: $DEPLOY_PM2_NAME listening on $APP_PORT"
curl -sS -o /dev/null -w "local_http=%{http_code}\\n" --max-time 5 "http://127.0.0.1:${APP_PORT}/" || true
EOS

echo "==> Done. Film Studio PM2 'aielegance' was not restarted."
