# Isolated VPS notes — AIElegance compare vs AI Film Studio

Inspected **2026-08-21** from this cloud agent.

## Live HTTP (verified)

Both hostnames currently serve the **same** Film Studio Nuxt app:

- `https://aielegance.com` → `200`, `Server: nginx/1.24.0 (Ubuntu)`, `x-powered-by: Nuxt`, title **AI Film Studio — Make the movie.**
- `https://aifilmstud.io` → same headers and title

That is the coupling: nginx for `aielegance.com` still proxies to Film Studio.

## SSH from this environment (blocked)

`ssh -o BatchMode=yes root@163.245.212.43` → `Permission denied (publickey,password)`.

Live PM2 / `/var/www` / site files were **not** readable from here. Apply isolation from a machine that can SSH (the Film Studio Mac deploy host).

## Expected on-box layout (must confirm with `scripts/inspect-vps.sh`)

From Film Studio deploy files and prior production work:

| Role | Expected value | Do not reuse for the new app |
| --- | --- | --- |
| Film Studio directory | `/var/www/aielegance` | leave |
| Film Studio process | PM2 `aielegance` | leave |
| Film Studio port | `127.0.0.1:3000` | leave |
| PocketBase | `127.0.0.1:8090` via `/pb/` | Film Studio only |
| aifilmstud.io nginx | `/etc/nginx/sites-available/aifilmstud.io` → `:3000` | do not edit |
| aielegance.com nginx | `/etc/nginx/sites-available/aielegance` → currently `:3000` | **retarget `/` to `:3001` only** |

## Proposed new app (after inspect, if 3001 is free)

- Directory: `/var/www/aielegance-com`
- Port: `3001`
- PM2 name: `aielegance-com`
- Env file: `/var/www/aielegance-com/.env`
- Logs: PM2 `aielegance-com` (`pm2 logs aielegance-com`)

Do **not** name the new process `aielegance` and do **not** deploy into `/var/www/aielegance`.
