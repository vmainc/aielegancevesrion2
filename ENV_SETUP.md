# Environment Variables Setup

## Local development — quick start

1. **Install:** `npm install`
2. **`.env`** in the project root (see [Required Environment Variables](#required-environment-variables)). For local PocketBase use `VITE_POCKETBASE_URL=http://127.0.0.1:8090` (no trailing slash).
3. **Start PocketBase + Nuxt in one terminal:**
   ```bash
   npm run dev:pb
   ```
   This runs PocketBase on **http://127.0.0.1:8090** and Nuxt on **http://127.0.0.1:3000** (admin UI: http://127.0.0.1:8090/_/ ).
4. **Or two terminals:** `npm run pb:serve` then `npm run dev`.
5. **First-time schema** (collections missing): with PocketBase running, `npm run setup-db` (uses `.env` for URL + superuser login).

If the app won’t start, styles look wrong, or ports are stuck: `npm run dev:fix` clears Nuxt/Vite caches and frees **3000** and **3001**, then starts Nuxt only — start PocketBase separately (`npm run pb:serve`) if you use it.

**Shell noise:** If your terminal prints `no such file or directory: /opt/homebrew/bin/brew`, fix or remove the `brew` line at the top of `~/.zshrc` (Homebrew path wrong or not installed).

---

To enable server-side operations that create or update PocketBase records (projects, assets, etc.), configure PocketBase admin credentials.

## Required Environment Variables

Create a `.env` file in the root of your project (or set these in your system environment):

```env
# PocketBase public API base URL (no trailing slash). Nuxt reads, in order:
# NUXT_PUBLIC_POCKETBASE_URL, VITE_POCKETBASE_URL, POCKETBASE_URL (default http://127.0.0.1:8090)
VITE_POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_EMAIL=your-admin-email@example.com
POCKETBASE_ADMIN_PASSWORD=your-admin-password

# OpenRouter API Key (required for querying AI models)
# Get your API key from https://openrouter.ai
OPENROUTER_API_KEY=your-openrouter-api-key
```

## Finding Your PocketBase Admin Credentials

1. When you first started PocketBase, you should have created an admin account
2. If you forgot, you can reset it or create a new admin via the PocketBase admin UI:
   - Go to `http://127.0.0.1:8090/_/`
   - Use the admin interface to manage admins

## Why This Is Needed

Server-side API endpoints need admin privileges to create records in PocketBase collections. Without admin authentication, you'll see errors like:

```
"Only superusers can perform this action."
```

## Alternative: Configure Access Rules

Instead of using admin authentication, you could configure PocketBase collection access rules to allow users to create records. However, admin auth is simpler for development.

## CLI scripts (`setup-collections`, `add-fields`)

From the **project root**, these load **`.env` automatically** (via `dotenv`). PocketBase URL comes from `POCKETBASE_URL`, `NUXT_PUBLIC_POCKETBASE_URL`, or `VITE_POCKETBASE_URL`. Admin login defaults from `POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD` (or `NUXT_POCKETBASE_ADMIN_*`).

```bash
node scripts/setup-collections.js
node scripts/add-fields-to-collections.js
```

Optional CLI overrides: `node scripts/setup-collections.js <email> <password> [pocketbaseUrl]`

For **production** PocketBase, pass the URL as the **fourth** argument (after email and password), or set `POCKETBASE_URL` for that shell only. Use the **same API base** the app uses (no trailing slash), e.g. `https://aielegance.com/pb` if PocketBase is served behind that path.

```bash
# Example: create missing collections on live PocketBase (run from project root)
export POCKETBASE_URL='https://YOUR_DOMAIN/pb'
export POCKETBASE_ADMIN_EMAIL='your-superuser@email'
export POCKETBASE_ADMIN_PASSWORD='your-superuser-password'
npm run setup-db
```

Or in one line:

```bash
POCKETBASE_URL='https://YOUR_DOMAIN/pb' POCKETBASE_ADMIN_EMAIL='...' POCKETBASE_ADMIN_PASSWORD='...' npm run setup-db
```

The script is idempotent: existing collections are skipped. It creates `creative_projects`, `creative_scenes`, `creative_characters` together, then ensures `creative_shots`, `project_assets`, and `creative_scripts` exist.

**VPS note:** If PocketBase only listens on `127.0.0.1:8090`, run the script **on the server** (SSH) with `POCKETBASE_URL=http://127.0.0.1:8090`, or tunnel that port to your laptop and point `POCKETBASE_URL` at the tunnel.

## Testing

After setting the environment variables, restart your Nuxt dev server:

```bash
npm run dev
```

You should no longer see superuser authentication errors from those API routes.

## Troubleshooting: `ENOENT` / `jiti` / `nuxt.config.*.mjs`

If dev fails trying to open a missing file under `node_modules/.cache/jiti/`, the compiled-config cache is stale. From the project root:

```bash
rm -rf node_modules/.cache/jiti node_modules/.vite .nuxt
npx nuxt prepare
npm run dev
```

Or run `npm run dev:fix` (clears caches and restarts dev).

## Troubleshooting: layout looks unstyled (CSS missing)

On some systems the dev server only listens on IPv6 (`localhost` → `::1`). Opening **`http://127.0.0.1:3000`** then fails to load the app or assets, so everything looks broken. The dev server is configured to bind **`0.0.0.0`** so **`http://127.0.0.1:3000`** and **`http://localhost:3000`** both work. Override with `NUXT_DEV_HOST` if needed (e.g. `127.0.0.1` only).

If styles still fail after a `nuxt build`, clear caches and run `npx nuxt prepare` as in the jiti section above, then restart `npm run dev`.

