/**
 * PocketBase API base URL (no trailing slash). Used by nuxt.config and mirrors script env resolution.
 */
export function resolvePocketBaseUrlFromEnv(): string {
  const raw =
    process.env.NUXT_PUBLIC_POCKETBASE_URL ||
    process.env.VITE_POCKETBASE_URL ||
    process.env.POCKETBASE_URL ||
    'http://127.0.0.1:8090'
  return raw.replace(/\/+$/, '')
}
