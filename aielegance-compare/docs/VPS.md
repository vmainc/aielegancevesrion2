# Isolated VPS notes — AIElegance compare vs AI Film Studio

## Live HTTP (2026-08-21)

- `https://aifilmstud.io` → **200**, `x-powered-by: Nuxt`, Film Studio. Do not touch.
- `https://aielegance.com` → **502 Bad Gateway** `nginx/1.24.0 (Ubuntu)`.

Cause: the aielegance.com vhost `proxy_pass` was retargeted to `127.0.0.1:3001` before PM2 `aielegance-com` was listening. nginx’s default 502 page is what you get when that port is closed.

This cloud agent cannot SSH (`Permission denied (publickey,password)` to `root@163.245.212.43`). Recover from the Film Studio Mac deploy host.

## Recover (Mac with SSH)

```bash
cd aielegance-compare
npm run deploy          # intended: compare UI on aielegance.com
# or, to stop the 502 immediately by serving Film Studio on both domains:
npm run rollback-nginx
```

`scripts/apply-nginx.sh` now refuses to retarget unless `http://127.0.0.1:3001/` is healthy, so a bare nginx switch cannot recreate this 502.

## Expected on-box layout

| Role | Value | Do not reuse for the new app |
| --- | --- | --- |
| Film Studio directory | `/var/www/aielegance` | leave |
| Film Studio process | PM2 `aielegance` | leave |
| Film Studio port | `127.0.0.1:3000` | leave |
| PocketBase | `127.0.0.1:8090` via `/pb/` | Film Studio only |
| aifilmstud.io nginx | → `:3000` | do not edit |
| aielegance.com nginx | → `:3001` once the compare app is up | patch only this vhost |

Compare app:

- Directory: `/var/www/aielegance-com`
- Port: `3001` (forced in `start.mjs`)
- PM2 name: `aielegance-com`
- Env file: `/var/www/aielegance-com/.env` (`OPENROUTER_API_KEY` for compare API; homepage boots without it)
