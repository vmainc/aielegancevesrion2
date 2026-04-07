# Environment Variables Setup

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

For **production** PocketBase, pass the URL as the third argument or set `POCKETBASE_URL` in `.env` for that run.

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

