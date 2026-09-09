# PocketBase setup — AI Elegance

PocketBase is the user/database layer for AI Film Studio. This document covers collections added for authentication and conversation history, plus how to run them locally and in production.

The Nuxt app already talks to PocketBase for projects, assets, and the rest of the Film OS. This phase adds:

- Public email/password registration on the built-in `users` collection
- `conversations` and `messages` for signed-in Studio Guide (Home) history

Existing creative collections (`creative_projects`, scenes, characters, shots, assets, bible, guide_messages, …) are unchanged.

---

## Environment variables

Never hardcode production URLs. Copy `.env.example` to `.env`.

| Variable | Where it is used | Purpose |
|----------|------------------|---------|
| `NUXT_PUBLIC_POCKETBASE_URL` | Browser + SSR | Public API base, **no trailing slash**. Local: `http://127.0.0.1:8090`. Production behind nginx: `https://YOUR_DOMAIN/pb` |
| `VITE_POCKETBASE_URL` | Alias | Same as above |
| `POCKETBASE_URL` | Alias (scripts + Nuxt) | Same as above |
| `NUXT_POCKETBASE_INTERNAL_URL` / `POCKETBASE_INTERNAL_URL` | **Server only** | Direct URL Node uses (usually `http://127.0.0.1:8090`) when the public URL is a `/pb` reverse proxy |
| `POCKETBASE_ADMIN_EMAIL` | **Server only** | Superuser for Nitro routes that mutate creative collections |
| `POCKETBASE_ADMIN_PASSWORD` | **Server only** | Superuser password. Never put this in client code. |
| `OPENROUTER_API_KEY` | **Server only** | AI models. Never shipped to the browser. |

Admin credentials and AI keys stay in Nitro `runtimeConfig` (private). The browser only receives `public.pocketbaseUrl`.

---

## Required collections

### `users` (built-in Auth collection)

PocketBase creates this automatically. Email/password auth is enabled.

| Field | Type | Notes |
|-------|------|--------|
| `id` | text | System |
| `email` | email | Login identity |
| `name` | text | Display name (registration + account page) |
| `avatar` | file | Optional profile photo |
| `created` | date | Member since |
| `updated` | date | System |

**API rules (enforced by `npm run setup-db`):**

| Rule | Value |
|------|--------|
| List / View / Update / Delete | `id = @request.auth.id` |
| Create | `""` (empty = guests may register) |

Turn **off** “Require email verification” / “Only verified users can log in” unless you have SMTP and a verification flow. The app signs users in immediately after register.

**Mail:** Forgot / reset password uses PocketBase SMTP (Admin → Settings → Mail). Until that is configured, the UI still shows a success message and does not reveal whether the email exists.

---

### `conversations`

Saved threads for a signed-in user (Studio Guide / Home).

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `user` | relation → `users` | yes | Owner. Cascade delete if the user is deleted. `maxSelect: 1` |
| `title` | text | yes | First ~50–70 characters of the first question |
| `created` | date | system | |
| `updated` | date | system | |

**API rules:**

| Rule | Value |
|------|--------|
| List / View / Update / Delete | `@request.auth.id != "" && user = @request.auth.id` |
| Create | `@request.auth.id != "" && user = @request.auth.id` |

Users cannot list or open another account’s conversations by guessing IDs (PocketBase returns 404).

---

### `messages`

Turns inside a conversation.

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `conversation` | relation → `conversations` | yes | Cascade delete when the conversation is deleted |
| `user` | relation → `users` | yes | Owner (must match conversation owner) |
| `role` | select | yes | `user`, `assistant`, `system` |
| `content` | text | yes | Message body |
| `model` | text | no | Model id used for assistant replies |
| `created` | date | system | |

**API rules (all of list / view / create / update / delete):**

```
@request.auth.id != "" && user = @request.auth.id && conversation.user = @request.auth.id
```

Frontend filtering is not the security boundary. These rules are.

Do **not** expand these rules to `listRule = ""` or any public read.

---

## Local development

1. Place the PocketBase binary in `pocketbase/pocketbase` (see root README).
2. `.env` in the repo root:

   ```env
   NUXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
   POCKETBASE_INTERNAL_URL=http://127.0.0.1:8090
   POCKETBASE_ADMIN_EMAIL=your-admin@example.com
   POCKETBASE_ADMIN_PASSWORD=your-admin-password
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

3. Start PocketBase + Nuxt:

   ```bash
   npm run dev:pb
   ```

   Or two terminals: `npm run pb:serve` then `npm run dev`.

4. First-time admin: open `http://127.0.0.1:8090/_/` and create the superuser (same email/password as `.env`).

5. Create / update collections:

   ```bash
   npm run setup-db
   ```

   If you start PocketBase from `pocketbase/`, JS migrations in `pocketbase/pb_migrations/` also apply automatically.

6. App: `http://127.0.0.1:3000`  
   Admin UI: `http://127.0.0.1:8090/_/`

---

## Production

1. Build with the **public** PocketBase URL (not localhost):

   ```bash
   export NUXT_PUBLIC_POCKETBASE_URL=https://YOUR_DOMAIN/pb
   npm run build
   ```

2. On the VPS, `.env` next to the Node process must include:

   - `NUXT_PUBLIC_POCKETBASE_URL=https://YOUR_DOMAIN/pb`
   - `POCKETBASE_INTERNAL_URL=http://127.0.0.1:8090`
   - `POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD`
   - `OPENROUTER_API_KEY`

3. Deploy `.output/` as today (`npm run deploy` / rsync). Do not remove existing deploy scripts.

4. Apply schema on the **live** PocketBase (idempotent):

   ```bash
   POCKETBASE_URL=http://127.0.0.1:8090 \
   POCKETBASE_ADMIN_EMAIL='...' \
   POCKETBASE_ADMIN_PASSWORD='...' \
   npm run setup-db
   ```

   Run this on the VPS (PocketBase on loopback) or against `https://YOUR_DOMAIN/pb` from a machine that can reach it.

5. Restart the Node process after env or schema changes.

6. PocketBase Settings → **Allowed origins**: add `https://YOUR_DOMAIN` (and `http://127.0.0.1:3000` for local).

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Nuxt only (`:3000`) |
| `npm run pb:serve` | PocketBase only (`:8090`) |
| `npm run dev:pb` | Both |
| `npm run setup-db` | Create missing collections + users registration rules |
| `npm run add-fields` | Add missing fields on existing creative collections |
| `npm run build` | Production build + asset verify |
| `npm run start` | Run `.output` with `dotenv` |
| `npm run deploy` | Existing VPS deploy script |
| `npm test` | Unit tests |

---

## Security checklist

- [ ] Superuser credentials only on the server
- [ ] OpenRouter / Atlas / Luma keys only on the server
- [ ] `conversations` and `messages` are not world-readable
- [ ] `/account` and `/history` redirect guests to `/login?redirect=…`
- [ ] Home (`/guide`) still works without an account; history is saved only when signed in
- [ ] Deleting a conversation cascade-deletes its messages

Later fields (plan, credits, billing, teams) can be added to `users` or new collections without changing this ownership model.
