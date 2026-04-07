# PocketBase directory

Place the **PocketBase executable** (`pocketbase`) in this folder — it is **not stored in git** (see root `.gitignore`). Download a release from [pocketbase/pocketbase releases](https://github.com/pocketbase/pocketbase/releases) for your OS/arch, unzip, and put the binary here. From the repo root you can run `npm run pb:serve` once the binary exists.

Data lives under `pb_data/` (also gitignored).

- Admin UI: `http://127.0.0.1:8090/_/`
- API base (local): `http://127.0.0.1:8090`

## Collections and fields (required)

Create these **collection names and field names** exactly as below. The Nuxt server uses the **superuser** account (`POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD`) to create and read records; collection **API rules** still apply to direct browser access via the PocketBase JS client.

### `users` (built-in auth collection)

Usually created by PocketBase. The app uses email/password auth and optional `name`. Ensure **Email/password** auth is enabled. If sign-up fails, disable “Confirm email” in the collection settings or complete the verification flow.

### Creative workspace

The setup script creates **`creative_projects`**, **`creative_scenes`**, **`creative_characters`**, and **`creative_shots`** with the fields used by script import, overview, storyboard, and related APIs. See `scripts/setup-collections.js` for the full schema.

Each of these collections has an **`owned_by`** relation to **`users`**. The setup script applies API rules in a second request so PocketBase can resolve the field (rules are validated after the schema exists).

### `project_assets`

Per-project library rows for **scripts**, **character** references, **storyboard** exports, **video** outputs, and **other** files or metadata. Tied to `creative_projects` and `users`; deleting a project cascades to its assets.

| Field        | Type        | Required | Notes |
|-------------|-------------|----------|--------|
| `project`   | **Relation** | Yes     | → **creative_projects**, cascade delete |
| `owned_by`  | **Relation** | Yes     | → **users** (owner) |
| `kind`      | **Select**   | Yes     | `script`, `character`, `storyboard`, `video`, `other` |
| `title`     | **Text**     | Yes     | Short label |
| `notes`     | **Text**     | No      | Longer description |
| `metadata`  | **JSON**     | No      | Extra fields (URLs, model ids, dimensions, etc.) |
| `sort_order`| **Number**   | No      | Integer ≥ 0 for sorting within a project |
| `file`      | **File**     | No      | Optional attachment (max 1, 50MB default in setup script) |

API (Bearer user token): `GET /api/assets/my`, `GET /api/projects/:id/assets`, `POST /api/projects/:id/assets`, `PATCH /api/projects/:id/assets/:assetId`, `DELETE ...`.

### Legacy Q&A collections (removed from the app)

Older installs may still have **`questions`**, **`ratings`**, **`comments`**, or **`user_points`**. They are no longer created by `setup-collections.js` and are not used by the Nuxt app. You can delete those collections in the PocketBase admin when you no longer need the data.

## Server environment (VPS)

These are read by **Node** (Nuxt/Nitro), not the browser:

| Variable | Purpose |
|----------|---------|
| `POCKETBASE_ADMIN_EMAIL` | Superuser email for `_superusers` auth |
| `POCKETBASE_ADMIN_PASSWORD` | Superuser password |
| `NUXT_PUBLIC_POCKETBASE_URL` or `VITE_POCKETBASE_URL` | Public API URL (e.g. `https://your-domain/pb`) for the **browser** |
| `POCKETBASE_INTERNAL_URL` or `NUXT_POCKETBASE_INTERNAL_URL` | Optional. Direct URL for **server-only** calls (e.g. `http://127.0.0.1:8090`) when the public URL is reverse-proxied and not ideal from localhost |

**OpenRouter** (model calls) is separate from PocketBase: set `OPENROUTER_API_KEY` or `NUXT_OPENROUTER_API_KEY` on the same Node process.

Restart the Node process after changing env vars.

## Quick verification

1. Superuser login works in PocketBase admin (`/_/`)
2. From the server host: `curl -s http://127.0.0.1:8090/api/health` (or your internal URL) returns OK
3. Collections exist with the field names above
4. `POCKETBASE_ADMIN_*` are present in the environment of the running `node .output/server/index.mjs` (or your process manager)
