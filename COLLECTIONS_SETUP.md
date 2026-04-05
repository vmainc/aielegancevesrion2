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

The script authenticates as **superuser** (`_superusers`) and creates **`questions`**, **`user_points`**, **`ratings`**, and **`comments`** with the fields the app expects (plus **`users`**, which PocketBase already provides).

## Users collection: signup without email verification

The app sign-up page only sends **email**, **password**, and **passwordConfirm**. For that to work end-to-end:

1. Open PocketBase Admin → **Collections** → **`users`** (the Auth collection).
2. **Collection settings** (gear icon) → find authentication / email options (wording varies by PocketBase version) and **turn off** anything like **“Require email verification”** or **“Only verified users can log in”**, so new users can sign in immediately after register.
3. **API rules** for **`users`**:
   - **Create**: allow guests to register, e.g. `@request.auth.id = ""` (only unauthenticated requests can create their own account). Adjust if your version uses a different rule template for “public sign-up”.
   - Ensure **Update** / **Delete** rules still protect other users’ records as you intend.

Also add your Nuxt origin to **Settings → allowed API origins** (e.g. `https://aielegance.com`) so the browser can call PocketBase from the app.

## Manual Setup

If you prefer to set up collections manually or the script doesn't work, follow these steps:

### 1. Access PocketBase Admin UI

1. Open your browser and navigate to: `http://127.0.0.1:8090/_/`
2. Log in with your admin credentials (created during initial PocketBase setup)

### 2. Create "questions" Collection

1. Click **"New Collection"** in the sidebar
2. Enter collection name: `questions`
3. Click **"Create"**

#### Add Fields:

1. **question** (Text)
   - Type: Text
   - Required: ✅ Yes
   - Options:
     - Min length: 1
     - Max length: 5000

2. **responses** (JSON)
   - Type: JSON
   - Required: ❌ No

3. **user** (Relation)
   - Type: Relation
   - Required: ✅ Yes
   - Collection: `users` (the built-in users collection)
   - Options:
     - Max select: 1
     - Display fields: `email`
     - Cascade delete: ❌ No

4. **created** (Auto Date)
   - This field is automatically added by PocketBase, so you don't need to create it manually

#### Set Rules (Optional - for now, leave as default/admin only):

For development, you can leave the access rules as default. For production, you'll want to configure proper access rules.

### 3. Create "user_points" Collection

1. Click **"New Collection"** in the sidebar
2. Enter collection name: `user_points`
3. Click **"Create"**

#### Add Fields:

1. **user** (Relation)
   - Type: Relation
   - Required: ✅ Yes
   - Unique: ✅ Yes
   - Collection: `users` (the built-in users collection)
   - Options:
     - Max select: 1
     - Display fields: `email`
     - Cascade delete: ✅ Yes

2. **points** (Number)
   - Type: Number
   - Required: ✅ Yes
   - Options:
     - Min: 0

3. **updated** (Auto Date)
   - This field is automatically added by PocketBase when you enable "Auto update on change"

#### Set Rules (Optional - for now, leave as default/admin only):

For development, you can leave the access rules as default. For production, you'll want to configure proper access rules.

### 4. Create "ratings" Collection

1. **New Collection** → name: `ratings`

#### Fields

1. **question** (Relation) → collection **questions**, max select **1**, required, cascade delete **on** (optional; keeps DB tidy when a question is removed).
2. **user** (Relation) → **users**, max select **1**, required, cascade delete **off**.
3. **model** (Text) → required, min 1, max ~200 (stores UI model name, e.g. `ChatGPT`).
4. **rating** (Number) → required, min **0**, integers only (`noDecimal` / no decimals).

### 5. Create "comments" Collection

1. **New Collection** → name: `comments`

#### Fields

1. **question** (Relation) → **questions**, max select **1**, required.
2. **user** (Relation) → **users**, max select **1**, required.
3. **comment** (Text) → required, min 1, max ~10000.

### 6. Verify Collections

After creating collections, verify they exist:

- ✅ `questions` - for storing questions and AI responses
- ✅ `user_points` - for tracking user points/leaderboard
- ✅ `ratings` - per-user, per-model ratings
- ✅ `comments` - comments on questions
- ✅ `users` - automatically created by PocketBase (for authentication)

## Collection Schemas Summary

### questions
```
- id (auto)
- question (text, required)
- responses (json, optional)
- user (relation to users, required)
- created (auto timestamp)
- updated (auto timestamp)
```

### user_points
```
- id (auto)
- user (relation to users, required, unique)
- points (number, required, min: 0)
- created (auto timestamp)
- updated (auto timestamp)
```

### ratings
```
- id (auto)
- question (relation → questions, required)
- user (relation → users, required)
- model (text, required)
- rating (number, required, min: 0, integer)
- created / updated (auto)
```

### comments
```
- id (auto)
- question (relation → questions, required)
- user (relation → users, required)
- comment (text, required)
- created / updated (auto)
```

## Troubleshooting

### Collection Already Exists
If you get an error that a collection already exists, you can either:
1. Delete the existing collection and recreate it
2. Skip it and continue with other collections

### Cannot Find Users Collection
The `users` collection is automatically created by PocketBase. If you don't see it:
1. Make sure you've completed the initial PocketBase admin setup
2. Check that you're logged in as an admin user
3. The collection should appear in your collections list

### Relation Field Issues
When creating relation fields:
- Make sure the target collection (users) exists first
- Select the correct collection from the dropdown
- Ensure the relation field name matches what's in your code

## Next Steps

After setting up the collections:

1. Test the API endpoints to ensure they work correctly
2. Configure access rules if you need authentication
3. Consider adding indexes for better query performance (handled automatically by PocketBase)

## Access Rules (Future Configuration)

For production, you'll want to set up proper access rules. Here's an example:

**questions collection:**
- List: `@request.auth.id != ""` (authenticated users can list)
- View: `@request.auth.id != ""` (authenticated users can view)
- Create: `@request.auth.id != ""` (authenticated users can create)
- Update: `user = @request.auth.id` (users can only update their own questions)
- Delete: `user = @request.auth.id` (users can only delete their own questions)

**user_points collection:**
- List: `@request.auth.id != ""` (authenticated users can list)
- View: `@request.auth.id != ""` (authenticated users can view)
- Create: `user = @request.auth.id` (users can create their own points record)
- Update: `user = @request.auth.id` (users can only update their own points)
- Delete: `user = @request.auth.id` (users can only delete their own points)

