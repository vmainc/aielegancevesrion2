# AIElegance

Ask one question. Compare answers from several AI models, side by side.

This is a **standalone** app for **aielegance.com**. It is not AI Film Studio (`aifilmstud.io`). Do not deploy it over `/var/www/aielegance` or restart PM2 process `aielegance`.

## Local

```bash
cp .env.example .env   # set OPENROUTER_API_KEY
npm install
npm run dev            # http://127.0.0.1:3001
```

Models are configured with `AIELEGANCE_MODELS` (JSON). No code change needed to add/remove/rename.

## Production (same VPS as Film Studio)

1. `./scripts/inspect-vps.sh` — confirm Film Studio is `/var/www/aielegance`, PM2 `aielegance`, port 3000, and that `aielegance.com` currently proxies to 3000.
2. Create `/var/www/aielegance-com/.env` from `deploy/vps.env.example`.
3. `npm run deploy` — rsyncs `.output/` to `/var/www/aielegance-com`, PM2 `aielegance-com` on **3001**.
4. `./scripts/apply-nginx.sh` — patches **only** the aielegance.com site `proxy_pass` 3000 → 3001, then `nginx -t` and reload.
5. Check:
   - https://aifilmstud.io → Film Studio
   - https://aielegance.com → AIElegance compare

## Isolated identities

| | Film Studio | This app |
| --- | --- | --- |
| Domain | aifilmstud.io | aielegance.com |
| Directory | `/var/www/aielegance` | `/var/www/aielegance-com` |
| PM2 | `aielegance` | `aielegance-com` |
| Port | 3000 | 3001 |

VPS notes: [docs/VPS.md](./docs/VPS.md)
