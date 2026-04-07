# AI Elegance

A minimal, high-performance AI comparison web application built with Nuxt 3, Vue 3, TailwindCSS, and PocketBase.
<!-- Force rebuild -->

## Setup

1. Install dependencies:
```bash
npm install
```

2. **PocketBase executable (local dev)**  
   The file `pocketbase/pocketbase` is **not committed** (see `.gitignore`). You need the official binary in that folder.

   - **macOS (Intel or Apple Silicon):** download the matching zip from [PocketBase releases](https://github.com/pocketbase/pocketbase/releases), unzip, and move the `pocketbase` binary into this project’s `pocketbase/` directory.  
   - Or from the repo root (adjust version / architecture: **Intel Mac** = `darwin_amd64`, **Apple Silicon** = `darwin_arm64`):
     ```bash
     cd pocketbase
     curl -fsSL -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v0.36.7/pocketbase_0.36.7_darwin_amd64.zip"
     unzip -o pb.zip && chmod +x pocketbase && rm -f pb.zip
     cd ..
     ```

3. **Run two processes (required for local dev)**  
   The **browser** talks to Nuxt on `:3000`. **Server API routes** talk to PocketBase on **`http://127.0.0.1:8090`** — that must be running, or you will see errors like “Cannot reach PocketBase”.

   - **Terminal A — PocketBase**
     ```bash
     npm run pb:serve
     ```
     Admin UI: [http://127.0.0.1:8090/_/](http://127.0.0.1:8090/_/) · API: [http://127.0.0.1:8090](http://127.0.0.1:8090)

   - **Terminal B — Nuxt**
     ```bash
     npm run dev
     ```
     App: [http://localhost:3000](http://localhost:3000)

   If your public PocketBase URL is proxied (e.g. `/pb` in production), still set **`NUXT_POCKETBASE_INTERNAL_URL=http://127.0.0.1:8090`** (or **`POCKETBASE_INTERNAL_URL`**) in `.env` so Nitro can reach PocketBase directly on the machine where Node runs.

4. Create PocketBase collections:

   **Option A: Automated Setup (Recommended)**
   ```bash
   npm run setup-db
   ```
   This will prompt you for your PocketBase admin credentials and create all collections automatically.

   **Option B: Manual Setup**
   See [COLLECTIONS_SETUP.md](./COLLECTIONS_SETUP.md) for detailed manual setup instructions.

   The collections needed include the creative workspace (`creative_projects`, scenes, characters, shots), **`project_assets`**, and **`users`** (built-in). See [COLLECTIONS_SETUP.md](./COLLECTIONS_SETUP.md).

5. Set environment variables:
   
   Create a `.env` file in the root directory:
   ```bash
   # PocketBase API base (no trailing slash). Production behind nginx /pb/:
   # Production (HTTPS): VITE_POCKETBASE_URL=https://aielegance.com/pb
   VITE_POCKETBASE_URL=http://127.0.0.1:8090
   # (Aliases: NUXT_PUBLIC_POCKETBASE_URL or POCKETBASE_URL)
   # Same machine as dev: point Node at PocketBase directly (avoids /pb-only URLs for API routes)
   NUXT_POCKETBASE_INTERNAL_URL=http://127.0.0.1:8090
   POCKETBASE_ADMIN_EMAIL=your-admin-email@example.com
   POCKETBASE_ADMIN_PASSWORD=your-admin-password
   
   # Required: OpenRouter API Key (for querying AI models)
   # Get your API key from https://openrouter.ai
   OPENROUTER_API_KEY=your-openrouter-api-key
   ```
   
   **Important:** PocketBase admin credentials are used by server routes that call PocketBase as superuser. Use the same email/password you used when setting up PocketBase.
   
   See [ENV_SETUP.md](./ENV_SETUP.md) for detailed instructions.

6. Run development server (if not already running from step 3):
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

