# Isolated VPS notes — AIElegance compare vs AI Film Studio

## Live HTTP (2026-08-21)

- `https://aifilmstud.io` → **200**, Film Studio on `:3000` (PM2 `aielegance`). Do not touch.
- `https://aielegance.com` → **200**, AIElegance compare on `:3001` (PM2 `aielegance-com`).

A 502 on aielegance.com means nginx is proxying to `:3001` but that process is down. `npm run deploy` from a host that can SSH starts it. The cloud image has no `rsync`; deploy falls back to `tar` over ssh.

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
