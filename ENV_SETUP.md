# Environment Variables Setup

To enable server-side operations (like saving questions), you need to configure PocketBase admin credentials.

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

## Testing

After setting the environment variables, restart your Nuxt dev server:

```bash
npm run dev
```

You should no longer see authentication errors when saving questions.

