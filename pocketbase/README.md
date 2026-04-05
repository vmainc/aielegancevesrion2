# PocketBase directory

Place the PocketBase executable in this folder. Data lives under `pb_data/`.

- Admin UI: `http://127.0.0.1:8090/_/`
- API base (local): `http://127.0.0.1:8090`

## Collections and fields (required)

Create these **collection names and field names** exactly as below. The Nuxt server uses the **superuser** account (`POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD`) to create and read records; collection **API rules** still apply to direct browser access via the PocketBase JS client.

### `users` (built-in auth collection)

Usually created by PocketBase. The app uses email/password auth and optional `name`. Ensure **Email/password** auth is enabled. If sign-up fails, disable “Confirm email” in the collection settings or complete the verification flow.

### `questions`

| Field       | Type     | Required | Notes |
|------------|----------|----------|--------|
| `question` | **Text** | Yes      | The user’s prompt |
| `responses`| **JSON** | Yes      | Object keyed by model name, e.g. `{ "ChatGPT": { "answer": "...", "rating": null } }` |
| `user`     | **Relation** | Yes  | Single record → collection **users** |

Do not rename these fields; `POST /api/questions` sends exactly `question`, `responses`, and `user` (user id string).

### `ratings`

| Field      | Type        | Required | Notes |
|-----------|-------------|----------|--------|
| `question`| **Relation** | Yes     | → **questions** |
| `user`    | **Relation** | Yes     | → **users** |
| `model`   | **Text**     | Yes     | Same label as UI: `ChatGPT`, `Claude`, etc. |
| `rating`  | **Number**   | Yes     | 0 = unrated; filters use `rating > 0` |

### `user_points` (leaderboard)

| Field    | Type        | Required | Notes |
|----------|-------------|----------|--------|
| `user`   | **Relation** | Yes     | → **users**, **one row per user** |
| `points` | **Number**   | Yes     | Integer; API increments on save/rate/comment |

The app expects this collection to be named **`user_points`**, not `leaderboard`.

### `comments` (optional, for question comments)

| Field     | Type        | Required | Notes |
|----------|-------------|----------|--------|
| `question` | **Relation** | Yes   | → **questions** |
| `user`    | **Relation** | Yes     | → **users** |
| `comment` | **Text**     | Yes     | Body text |

## Server environment (VPS)

These are read by **Node** (Nuxt/Nitro), not the browser:

| Variable | Purpose |
|----------|---------|
| `POCKETBASE_ADMIN_EMAIL` | Superuser email for `_superusers` auth |
| `POCKETBASE_ADMIN_PASSWORD` | Superuser password |
| `NUXT_PUBLIC_POCKETBASE_URL` or `VITE_POCKETBASE_URL` | Public API URL (e.g. `https://your-domain/pb`) for the **browser** |
| `POCKETBASE_INTERNAL_URL` or `NUXT_POCKETBASE_INTERNAL_URL` | Optional. Direct URL for **server-only** calls (e.g. `http://127.0.0.1:8090`) when the public URL is reverse-proxied and not ideal from localhost |

**OpenRouter** (model answers) is separate from PocketBase: set `OPENROUTER_API_KEY` or `NUXT_OPENROUTER_API_KEY` on the same Node process. If those are missing, `POST /api/query/...` returns 500 with “OpenRouter API key not configured”.

Restart the Node process after changing env vars.

## Quick verification

1. Superuser login works in PocketBase admin (`/_/`)
2. From the server host: `curl -s http://127.0.0.1:8090/api/health` (or your internal URL) returns OK
3. Collections exist with the field names above
4. `POCKETBASE_ADMIN_*` are present in the environment of the running `node .output/server/index.mjs` (or your process manager)
