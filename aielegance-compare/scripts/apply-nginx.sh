#!/usr/bin/env bash
# Retarget ONLY the aielegance.com nginx site → 127.0.0.1:$APP_PORT.
# Does not edit aifilmstud.io site files.
set -euo pipefail
: "${VPS_HOST:=root@163.245.212.43}"
: "${APP_PORT:=3001}"

ssh "$VPS_HOST" "APP_PORT='$APP_PORT' bash -s" <<'REMOTE'
set -euo pipefail
SITE=""
for f in /etc/nginx/sites-available/aielegance /etc/nginx/sites-enabled/aielegance; do
  if [ -e "$f" ]; then
    SITE=$(readlink -f "$f" 2>/dev/null || realpath "$f")
    break
  fi
done
if [ -z "${SITE:-}" ] || [ ! -f "$SITE" ]; then
  echo "Could not find a dedicated aielegance site file. Matching server_name:"
  grep -Rln "server_name.*aielegance.com" /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null || true
  exit 1
fi
if ! curl -sf --max-time 5 "http://127.0.0.1:${APP_PORT}/" >/dev/null; then
  echo "ERROR: 127.0.0.1:${APP_PORT} is not healthy (this is the aielegance.com 502)."
  echo "Start the compare app first from aielegance-compare: npm run deploy"
  echo "Emergency restore Film Studio on aielegance.com: ./scripts/rollback-nginx.sh"
  ss -tlnp | egrep ':3000|:3001' || true
  exit 1
fi
echo "Patching $SITE"
cp -a "$SITE" "$SITE.bak.aielegance-com.$(date +%Y%m%d%H%M%S)"
python3 - "$SITE" "$APP_PORT" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
port = sys.argv[2]
text = path.read_text()
old = "proxy_pass http://127.0.0.1:3000"
new = f"proxy_pass http://127.0.0.1:{port}"
if new in text and old not in text:
    print(f"Already proxying to {port}; no change.")
elif old not in text:
    raise SystemExit(f"Did not find {old} in {path} — aborting.")
else:
    path.write_text(text.replace(old, new))
    print(f"Updated proxy_pass 3000 → {port}")
PY
nginx -t
systemctl reload nginx
echo "nginx reloaded. aifilmstud.io was not edited."
REMOTE
