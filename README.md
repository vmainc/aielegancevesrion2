# AI Elegance

A minimal, high-performance AI comparison web application built with Nuxt 3, Vue 3, TailwindCSS, and PocketBase.
<!-- Force rebuild -->

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start PocketBase server (default: http://127.0.0.1:8090)
   ```bash
   ./pocketbase/pocketbase serve
   ```

3. Create PocketBase collections:

   **Option A: Automated Setup (Recommended)**
   ```bash
   npm run setup-db
   ```
   This will prompt you for your PocketBase admin credentials and create all collections automatically.

   **Option B: Manual Setup**
   See [COLLECTIONS_SETUP.md](./COLLECTIONS_SETUP.md) for detailed manual setup instructions.

   The collections needed include the creative workspace (`creative_projects`, scenes, characters, shots), **`project_assets`**, and **`users`** (built-in). See [COLLECTIONS_SETUP.md](./COLLECTIONS_SETUP.md).

4. Set environment variables:
   
   Create a `.env` file in the root directory:
   ```bash
   # PocketBase API base (no trailing slash). Production behind nginx /pb/:
   # Production (HTTPS): VITE_POCKETBASE_URL=https://aielegance.com/pb
   VITE_POCKETBASE_URL=http://127.0.0.1:8090
   # (Aliases: NUXT_PUBLIC_POCKETBASE_URL or POCKETBASE_URL)
   POCKETBASE_ADMIN_EMAIL=your-admin-email@example.com
   POCKETBASE_ADMIN_PASSWORD=your-admin-password
   
   # Required: OpenRouter API Key (for querying AI models)
   # Get your API key from https://openrouter.ai
   OPENROUTER_API_KEY=your-openrouter-api-key
   ```
   
   **Important:** PocketBase admin credentials are used by server routes that call PocketBase as superuser. Use the same email/password you used when setting up PocketBase.
   
   See [ENV_SETUP.md](./ENV_SETUP.md) for detailed instructions.

5. Run development server:
```bash
npm run dev
```

**Production:** Use `npm run build` (not `nuxt build` alone). The build copies client assets into `.output/server/chunks/public` so the Node server can serve `/_nuxt/*`.

### VPS deploy (avoid `ENOENT` on `/_nuxt/*`)

1. **Production build on your Mac** with the **public** PocketBase URL baked in (not `127.0.0.1`):
   ```bash
   export NUXT_PUBLIC_POCKETBASE_URL=https://aielegance.com/pb
   npm run build
   ```
   (Use your real domain if it differs; must match how users load the site — HTTPS if the site is HTTPS.)
2. **Upload the whole `.output` folder** (includes `server/chunks/public/_nuxt/…`):
   ```bash
   rsync -avz --delete .output/ root@YOUR_SERVER:/var/www/aielegance/.output/
   ```
   Do **not** rsync only `server/` or only from the VPS to itself — you need the **same** build’s HTML + hashed JS/CSS/SVG together.
3. On the server, **VPS `.env`** should include `POCKETBASE_INTERNAL_URL=http://127.0.0.1:8090` (Node → PocketBase) and your admin/OpenRouter keys; then `source .env` and restart `node .output/server/index.mjs`.
4. After each deploy, use a **hard refresh** or a private window so the browser does not keep an old HTML that references **previous** chunk filenames.

If logs show missing files under `.output/server/chunks/public/_nuxt/`, the sync step did not run (`npm run build` handles it) or that directory was not deployed.

## Features

- Import scripts and manage creative projects (scenes, characters, storyboard shots)
- Tools for character concepts and video generation (OpenRouter)
- Per-project asset library (`project_assets`) for scripts, character refs, storyboards, and video

