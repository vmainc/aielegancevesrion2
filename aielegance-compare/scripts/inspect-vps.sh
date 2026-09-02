#!/usr/bin/env bash
# Read-only VPS inspection. Does not change nginx, PM2, or files.
#   ./scripts/inspect-vps.sh
set -euo pipefail
: "${VPS_HOST:=root@163.245.212.43}"

ssh "$VPS_HOST" bash -s <<'EOS'
set -euo pipefail
echo "=== HOST ==="
hostname
echo
echo "=== PM2 ==="
command -v pm2 >/dev/null && pm2 list || echo "pm2 not found"
echo
if command -v pm2 >/dev/null; then
  echo "=== PM2 SHOW aielegance ==="
  pm2 show aielegance 2>/dev/null || echo "no process named aielegance"
fi
echo
echo "=== LISTEN ==="
ss -tlnp | egrep ':80|:443|:3000|:3001|:8090' || true
echo
echo "=== /var/www ==="
ls -la /var/www || true
echo
echo "=== systemd (aielegance/pm2/pocketbase/nuxt) ==="
systemctl list-units --type=service --all | egrep -i 'aielegance|pm2|pocketbase|nuxt|node' || true
echo
echo "=== nginx sites-enabled ==="
ls -la /etc/nginx/sites-enabled /etc/nginx/sites-available || true
echo
echo "=== server_name ==="
grep -R "server_name" /etc/nginx/sites-enabled /etc/nginx/sites-available 2>/dev/null || true
echo
echo "=== certs ==="
ls -ld /etc/letsencrypt/live/aielegance.com /etc/letsencrypt/live/aifilmstud.io 2>/dev/null || true
echo
echo "=== aielegance site file ==="
for f in /etc/nginx/sites-available/aielegance /etc/nginx/sites-enabled/aielegance; do
  if [ -f "$f" ] || [ -L "$f" ]; then
    echo "----- $f -----"
    sed -n '1,160p' "$f"
  fi
done
echo
echo "=== aifilmstud.io site file (first 80 lines) ==="
sed -n '1,80p' /etc/nginx/sites-available/aifilmstud.io 2>/dev/null || true
EOS
