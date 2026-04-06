# PocketBase Collections Setup Guide

This guide will help you set up the required PocketBase collections for the AI Elegance application.

## VPS: only `.output` deployed (no `package.json`)

If the server has `/var/www/aielegance` with **only** the Nuxt build (`.output/`) and **no** `scripts/` folder, the setup script is not on the machine. Do one of the following:

**A — Clone the full repo on the VPS** (any path, e.g. `/var/www/aielegance-src`), then:

```bash
cd /var/www
git clone <YOUR_REPO_URL> aielegance-src
cd aielegance-src
npm install --omit=dev
# PocketBase on the same VPS — use localhost for the Admin API:
POCKETBASE_URL=http://127.0.0.1:8090 node scripts/setup-collections.js 'YOUR_SUPERUSER_EMAIL' 'YOUR_SUPERUSER_PASSWORD'
```

**B — Run the script from your laptop** against the public PocketBase URL:

```bash
cd /path/to/aielegance-main
npm install
POCKETBASE_URL=http://YOUR_SERVER_IP/pb node scripts/setup-collections.js 'YOUR_SUPERUSER_EMAIL' 'YOUR_SUPERUSER_PASSWORD'
```

**Shell tip:** Use a normal ASCII apostrophe `'` (U+0027) around passwords. Curly quotes `'` `'` from email or docs break `nohup env ...` and split the password (you may see `='V'...` in the process list).

---

## Quick Setup (Automated)

From the **project root** (with `pocketbase` JS SDK available — use `npm install` if needed), run:

```bash
# Uses NUXT_PUBLIC_POCKETBASE_URL, VITE_POCKETBASE_URL, or POCKETBASE_URL, else http://127.0.0.1:8090
# Optional 4th arg: PocketBase base URL (no trailing slash), e.g. https://aielegance.com/pb
node scripts/setup-collections.js

# Or non-interactive (VPS / CI):
# node scripts/setup-collections.js 'admin@you.com' 'your-superuser-password' 'http://127.0.0.1:8090'
```

The script authenticates as **superuser** (`_superusers`) and ensures:

- **`creative_projects`**, **`creative_scenes`**, **`creative_characters`** — script import workspace (if missing)
- **`creative_shots`** — storyboard shots per scene (if parents exist)
- **`project_assets`** — per-project assets (scripts, characters, storyboards, video, optional files)

**`users`** is provided by PocketBase for authentication.

The app no longer uses **`questions`**, **`ratings`**, **`comments`**, or **`user_points`**. Those collections are not created by this script. If they exist on an old database, you can delete them in the admin UI when you no longer need the data.

Field-level details: [pocketbase/README.md](./pocketbase/README.md) and `scripts/setup-collections.js`.

## Users collection: signup without email verification

The app sign-up page only sends **email**, **password**, and **passwordConfirm**. For that to work end-to-end:

1. Open PocketBase Admin → **Collections** → **`users`** (the Auth collection).
2. **Collection settings** (gear icon) → find authentication / email options (wording varies by PocketBase version) and **turn off** anything like **“Require email verification”** or **“Only verified users can log in”**, so new users can sign in immediately after register.
3. **API rules** for **`users`**:
   - **Create**: allow guests to register, e.g. `@request.auth.id = ""` (only unauthenticated requests can create their own account). Adjust if your version uses a different rule template for “public sign-up”.
   - Ensure **Update** / **Delete** rules still protect other users’ records as you intend.

Also add your Nuxt origin to **Settings → allowed API origins** (e.g. `https://aielegance.com`) so the browser can call PocketBase from the app.

## Manual Setup

If you prefer to mirror the script by hand, use the same collection and field names as in `scripts/setup-collections.js`. The [pocketbase/README.md](./pocketbase/README.md) file summarizes **`project_assets`** and points at the creative workspace collections.

## Troubleshooting

### Collection Already Exists

If you get an error that a collection already exists, you can either skip it or adjust fields in the admin UI to match the script.

### Cannot Find Users Collection

The `users` collection is automatically created by PocketBase. If you don't see it:

1. Make sure you've completed the initial PocketBase admin setup
2. Check that you're logged in as an admin user
3. The collection should appear in your collections list

### Relation Field Issues

When creating relation fields:

- Make sure the target collection (e.g. `users`, `creative_projects`) exists first
- Select the correct collection from the dropdown
- Ensure the relation field name matches what's in `scripts/setup-collections.js`

## Next Steps

After setting up the collections:

1. Run the app and exercise project import, storyboard, and assets APIs as needed
2. Configure access rules for production (the setup script sets rules on new creative/project_assets collections)
3. Consider removing legacy **`questions`** / **`user_points`** / **`ratings`** / **`comments`** collections from old databases if unused
