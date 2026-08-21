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

## 502 on aielegance.com

nginx is already sending `aielegance.com` to **port 3001**. A 502 means nothing is listening there. Film Studio on 3000 / `aifilmstud.io` is unrelated — leave it alone.

From a Mac that can SSH as `root@163.245.212.43`:

```bash
cd aielegance-compare
npm run deploy          # rsync + start PM2 aielegance-com on :3001
# if files are already on the server and the process just died:
npm run fix-502
```

Emergency restore (aielegance.com shows Film Studio again, 502 gone):

```bash
npm run rollback-nginx
```

Confirm: `curl -sI https://aielegance.com | head` is `200` with title AIElegance, and `https://aifilmstud.io` is still Film Studio.

## Isolated identities

| | Film Studio | This app |
| --- | --- | --- |
| Domain | aifilmstud.io | aielegance.com |
| Directory | `/var/www/aielegance` | `/var/www/aielegance-com` |
| PM2 | `aielegance` | `aielegance-com` |
| Port | 3000 | 3001 |

VPS notes: [docs/VPS.md](./docs/VPS.md)
