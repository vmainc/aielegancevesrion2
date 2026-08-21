#!/usr/bin/env bash
# Emergency: point aielegance.com back at Film Studio (:3000) so the 502 stops.
# Does not edit aifilmstud.io. Compare app on :3001 is left running if present.
set -euo pipefail
: "${VPS_HOST:=root@163.245.212.43}"

ssh "$VPS_HOST" bash -s <<'REMOTE'
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
echo "Patching $SITE"
cp -a "$SITE" "$SITE.bak.rollback-3000.$(date +%Y%m%d%H%M%S)"
python3 - "$SITE" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
old = "proxy_pass http://127.0.0.1:3001"
new = "proxy_pass http://127.0.0.1:3000"
if new in text and old not in text:
    print("Already proxying to 3000; no change.")
elif old not in text:
    raise SystemExit(f"Did not find {old} in {path} — aborting.")
else:
    path.write_text(text.replace(old, new))
    print("Updated proxy_pass 3001 → 3000 (aielegance.com → Film Studio)")
PY
nginx -t
systemctl reload nginx
echo "nginx reloaded. aifilmstud.io was not edited."
REMOTE
