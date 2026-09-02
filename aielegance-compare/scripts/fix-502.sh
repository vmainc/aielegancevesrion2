#!/usr/bin/env bash
# Recover aielegance.com 502: nginx is on :3001 but the compare process is down.
# Restarts PM2 aielegance-com, or runs a full deploy if files are missing.
# Does not change Film Studio (PM2 aielegance / :3000 / aifilmstud.io).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${VPS_HOST:=root@163.245.212.43}"
: "${VPS_PATH:=/var/www/aielegance-com}"
: "${DEPLOY_PM2_NAME:=aielegance-com}"
: "${APP_PORT:=3001}"

if ! ssh -o BatchMode=yes -o ConnectTimeout=8 "$VPS_HOST" "true"; then
  echo "ERROR: cannot SSH to $VPS_HOST (need the Film Studio deploy key)."
  exit 1
fi

HAS_FILES=0
if ssh "$VPS_HOST" "test -f '$VPS_PATH/.output/server/index.mjs' && test -f '$VPS_PATH/start.mjs'"; then
  HAS_FILES=1
fi

if [ "$HAS_FILES" != "1" ]; then
  echo "Compare app files missing on $VPS_PATH — running full deploy."
  exec "$ROOT/scripts/deploy-vps.sh"
fi

ssh "$VPS_HOST" bash -s <<REMOTE
set -euo pipefail
echo "=== listeners ==="
ss -tlnp | egrep ':3000|:3001' || true
echo
echo "=== pm2 ==="
pm2 list || true
echo
cd '$VPS_PATH'
export HOST=127.0.0.1 PORT='$APP_PORT' NITRO_HOST=127.0.0.1 NITRO_PORT='$APP_PORT' NODE_ENV=production
if pm2 describe '$DEPLOY_PM2_NAME' >/dev/null 2>&1; then
  pm2 delete '$DEPLOY_PM2_NAME' || true
fi
pm2 start '$VPS_PATH/start.mjs' --name '$DEPLOY_PM2_NAME' --cwd '$VPS_PATH' --update-env
pm2 save
sleep 1
ss -tlnp | grep -E ':${APP_PORT}\\b' || {
  echo "ERROR: nothing listening on $APP_PORT after start"
  pm2 logs '$DEPLOY_PM2_NAME' --lines 40 --nostream
  exit 1
}
curl -sS -o /dev/null -w "local_http=%{http_code}\\n" --max-time 5 http://127.0.0.1:${APP_PORT}/ || true
REMOTE

echo "==> Public checks (Film Studio must stay 200)"
curl -sS -o /dev/null -w "aielegance.com=%{http_code}\\n" --max-time 15 https://aielegance.com/ || true
curl -sS -o /dev/null -w "aifilmstud.io=%{http_code}\\n" --max-time 15 https://aifilmstud.io/ || true
