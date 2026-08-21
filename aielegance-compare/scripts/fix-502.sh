#!/usr/bin/env bash
# Recover aielegance.com 502: nginx is on :3001 but the compare process is down.
# Does not change Film Studio (PM2 aielegance / :3000 / aifilmstud.io).
set -euo pipefail
: "${VPS_HOST:=root@163.245.212.43}"
: "${VPS_PATH:=/var/www/aielegance-com}"
: "${DEPLOY_PM2_NAME:=aielegance-com}"
: "${APP_PORT:=3001}"

ssh "$VPS_HOST" bash -s <<REMOTE
set -euo pipefail
echo "=== listeners ==="
ss -tlnp | egrep ':3000|:3001' || true
echo
echo "=== pm2 ==="
pm2 list || true
echo
if ! ss -tlnp | grep -qE ':${APP_PORT}\\b'; then
  echo "Nothing on ${APP_PORT} — that is the 502."
  if [ ! -f ${VPS_PATH}/.output/server/index.mjs ]; then
    echo "ERROR: ${VPS_PATH}/.output is missing. From your Mac, in aielegance-compare: npm run deploy"
    exit 1
  fi
  if [ ! -f ${VPS_PATH}/start.mjs ]; then
    echo "ERROR: ${VPS_PATH}/start.mjs missing. From your Mac: npm run deploy"
    exit 1
  fi
  cd ${VPS_PATH}
  export HOST=127.0.0.1 PORT=${APP_PORT} NITRO_HOST=127.0.0.1 NITRO_PORT=${APP_PORT} NODE_ENV=production
  if pm2 describe ${DEPLOY_PM2_NAME} >/dev/null 2>&1; then
    pm2 delete ${DEPLOY_PM2_NAME} || true
  fi
  pm2 start ${VPS_PATH}/start.mjs --name ${DEPLOY_PM2_NAME} --cwd ${VPS_PATH} --update-env
  pm2 save
  sleep 1
fi
ss -tlnp | grep -E ':${APP_PORT}\\b'
curl -sS -o /dev/null -w "local_http=%{http_code}\\n" --max-time 5 http://127.0.0.1:${APP_PORT}/ || true
REMOTE
