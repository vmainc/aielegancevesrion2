# AI Film Studio

An **AI Film Operating System** — a persistent creative workspace where story, cast, shots, assets, and decisions live together. Built for feature-scale work (hundreds of shots, dozens of characters), not one-off clips.

Turn ideas or scripts into structured productions: import screenplay, build a director bible, manage cast, storyboard shots, and generate video — with AI that reads the whole film, not generic prompts.

**Stack:** Nuxt 3, Vue 3, Tailwind CSS, PocketBase, OpenRouter (chat, image, video models).

## What you can do

### Project workspace

Each project follows a guided workflow:

| Step | Purpose |
|------|---------|
| **Overview** | Dashboard, concept, treatment, script import |
| **Director** | Director bible presets and continuity notes |
| **Script** | Screenplay editing and import |
| **Characters** | Cast profiles — appearance, voice, portraits |
| **Scenes** | Structured scene list (heading, summary, body) |
| **Storyboard** | Shot boards and frame generation |
| **Video** | Clip generation from shots with start frames |
| **Guide** | Project Guide — context-aware AI copilot |
| **Bible** | Production bible — entities, facts, relationships |

Workflow paths adapt by mode: **import** (existing script), **idea** (concept-first), or **generate** (AI-assisted story).

### Standalone tools

- **Video generation** — OpenRouter video models
- **Music generation** — AI music via OpenRouter
- **Script Wizard** — treatment and breakdown from an idea
- **Storyboard builder** — quick scene/shot scaffolding
- **Character creator** — concept portraits

### Asset library

Per-project and global asset hubs for scripts, character refs, storyboards, video, and music (`project_assets` collection).

## Architecture (short)

```
Browser → Nuxt (:3000) → Nitro API routes → PocketBase + OpenRouter
```

- **Browser** talks to Nuxt. **Server routes** use a superuser PocketBase client for privileged reads/writes; collection rules enforce per-user ownership via `owned_by`.
- **Shared prompt logic** lives in `lib/` (`unified-shot-prompt`, continuity helpers, bible context) — one source of truth for AI generation across storyboard, video, and guide.
- **Long-running AI jobs** (script import, shot generation, video) use server-side job registries polled by the client.

See [docs/Vision.md](./docs/Vision.md) for product principles and [docs/Architecture.md](./docs/Architecture.md) for the full module map.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. PocketBase executable (local dev)

The file `pocketbase/pocketbase` is **not committed** (see `.gitignore`). You need the official binary in that folder.

- **macOS (Intel or Apple Silicon):** download the matching zip from [PocketBase releases](https://github.com/pocketbase/pocketbase/releases), unzip, and move the `pocketbase` binary into this project’s `pocketbase/` directory.
- Or from the repo root (adjust version / architecture: **Intel Mac** = `darwin_amd64`, **Apple Silicon** = `darwin_arm64`):

  ```bash
  cd pocketbase
  curl -fsSL -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v0.36.7/pocketbase_0.36.7_darwin_amd64.zip"
  unzip -o pb.zip && chmod +x pocketbase && rm -f pb.zip
  cd ..
  ```

### 3. Environment variables

Create a `.env` file in the root directory (see [.env.example](./.env.example)):

```bash
# PocketBase API base (no trailing slash). Production behind nginx /pb/:
# NUXT_PUBLIC_POCKETBASE_URL=https://aifilmstud.io/pb
VITE_POCKETBASE_URL=http://127.0.0.1:8090
# (Aliases: NUXT_PUBLIC_POCKETBASE_URL or POCKETBASE_URL)

# Same machine as dev: point Node at PocketBase directly (avoids /pb-only URLs for API routes)
NUXT_POCKETBASE_INTERNAL_URL=http://127.0.0.1:8090

POCKETBASE_ADMIN_EMAIL=your-admin-email@example.com
POCKETBASE_ADMIN_PASSWORD=your-admin-password

# Required: OpenRouter API key (script analysis, shot/storyboard/image/video generation)
# https://openrouter.ai/keys
OPENROUTER_API_KEY=your-openrouter-api-key

# Optional: Atlas Cloud API key for Seedance 2.5 video
# https://www.atlascloud.ai/console/api-keys
ATLASCLOUD_API_KEY=your-atlas-cloud-api-key
```

**Important:** PocketBase admin credentials are used by server routes that call PocketBase as superuser. Use the same email/password you used when setting up PocketBase.

See [ENV_SETUP.md](./ENV_SETUP.md) for detailed instructions.

### 4. Create PocketBase collections

**Option A: Automated setup (recommended)**

```bash
npm run setup-db
```

This prompts for PocketBase admin credentials and creates all collections.

**Option B: Manual setup**

See [COLLECTIONS_SETUP.md](./COLLECTIONS_SETUP.md). Collections include the creative workspace (`creative_projects`, scenes, characters, shots), **`project_assets`**, production bible tables, and **`users`** (built-in).

### 5. Run locally

The **browser** talks to Nuxt on `:3000`. **Server API routes** talk to PocketBase on **`http://127.0.0.1:8090`** — it must be running, or you will see errors like “Cannot reach PocketBase”.

**One terminal (recommended):**

```bash
npm run dev:pb
```

Starts PocketBase and Nuxt together.

**Two terminals:**

```bash
# Terminal A — PocketBase
npm run pb:serve
# Admin UI: http://127.0.0.1:8090/_/  ·  API: http://127.0.0.1:8090

# Terminal B — Nuxt
npm run dev
# App: http://localhost:3000
```

If your public PocketBase URL is proxied (e.g. `/pb` in production), still set **`NUXT_POCKETBASE_INTERNAL_URL=http://127.0.0.1:8090`** (or **`POCKETBASE_INTERNAL_URL`**) in `.env` so Nitro can reach PocketBase on the machine where Node runs.

**Troubleshooting:** `npm run dev:fix` clears Nuxt/Vite caches and frees ports 3000/3001, then starts Nuxt only — start PocketBase separately if needed.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Nuxt dev server |
| `npm run dev:pb` | PocketBase + Nuxt in one terminal |
| `npm run pb:serve` | PocketBase only |
| `npm run build` | Production build (includes asset sync + verification) |
| `npm run start` | Run production server from `.output` |
| `npm run setup-db` | Create PocketBase collections |
| `npm run deploy` | VPS deploy script |

## Production

Use `npm run build` (not `nuxt build` alone). The build copies client assets into `.output/server/chunks/public` so the Node server can serve `/_nuxt/*`.

### Deploy — VPS (Node + nginx + PocketBase)

Hosting is a **Linux VPS**: Nuxt runs as **Node** (`node .output/server/index.mjs`), **nginx** serves the site and proxies **`/pb` → PocketBase** on loopback. Deploy the full `.output` folder (not a static file host) so `/_nuxt/*` hashes stay in sync with the HTML.

1. **Production build** with the **public** PocketBase URL baked in (not `127.0.0.1`):

   ```bash
   export NUXT_PUBLIC_POCKETBASE_URL=https://aifilmstud.io/pb
   npm run build
   ```

   Use your real domain; must match how users load the site (HTTPS if the site is HTTPS).

2. **Upload the whole `.output` folder:**

   ```bash
   rsync -avz --delete .output/ root@YOUR_SERVER:/var/www/aielegance/.output/
   ```

   Do **not** rsync only `server/` — you need the same build’s HTML + hashed JS/CSS together.

3. On the server, **VPS `.env`** should include `POCKETBASE_INTERNAL_URL=http://127.0.0.1:8090` and your admin/OpenRouter keys; then `source .env` and restart `node .output/server/index.mjs`.

4. After each deploy, hard-refresh or use a private window so the browser does not keep old chunk filenames.

See `deploy/` for nginx config, systemd unit example, and env template.

If logs show missing files under `.output/server/chunks/public/_nuxt/`, the sync step did not run or that directory was not deployed.

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/Vision.md](./docs/Vision.md) | Product north star and architectural principles |
| [docs/Architecture.md](./docs/Architecture.md) | System layers, domain model, generation pipeline |
| [docs/Database.md](./docs/Database.md) | PocketBase schema and relationships |
| [docs/Roadmap.md](./docs/Roadmap.md) | Phased evolution toward full Film OS |
| [docs/AIWorkflows.md](./docs/AIWorkflows.md) | AI touchpoints across the pipeline |
| [docs/ContinuityEngine.md](./docs/ContinuityEngine.md) | Consistency subsystem |
| [ENV_SETUP.md](./ENV_SETUP.md) | Environment variables |
| [COLLECTIONS_SETUP.md](./COLLECTIONS_SETUP.md) | Manual PocketBase schema setup |

After pulling updates, run `npm run setup-db` (or `npm run add-fields`) to provision **`guide_messages`**, **`creative_decisions`**, and **`project_assets`** scene/shot/character relations on existing installs.

## Project layout

```
pages/          # Routes — project workspace, tools, assets, auth
components/     # Vue UI components
composables/    # Client state and hydration
lib/            # Shared TS — prompts, continuity, generation, bible
server/api/     # Nitro API routes
server/utils/   # PocketBase, AI orchestration, mappers
types/          # TypeScript contracts
scripts/        # Setup, deploy, and verification scripts
docs/           # Architecture and product documentation
```
