/**
 * Merge Nitro runtimeConfig with process.env.
 * Production Node often has OPENROUTER_* / POCKETBASE_* in the environment, but private
 * runtimeConfig can be empty if the build had no secrets — env still applies at runtime.
 */

export function resolveOpenRouterApiKey(config: { openrouterApiKey?: string }): string | undefined {
  const v =
    (config.openrouterApiKey && String(config.openrouterApiKey).trim()) ||
    process.env.NUXT_OPENROUTER_API_KEY ||
    process.env.OPENROUTER_API_KEY
  const s = v ? String(v).trim() : ''
  return s || undefined
}

export function resolvePocketBaseAdmin(config: {
  pocketbaseAdminEmail?: string
  pocketbaseAdminPassword?: string
  pocketbaseInternalUrl?: string
}): {
  email?: string
  password?: string
  internalUrl?: string
} {
  const email = (
    config.pocketbaseAdminEmail ||
    process.env.NUXT_POCKETBASE_ADMIN_EMAIL ||
    process.env.POCKETBASE_ADMIN_EMAIL ||
    ''
  )
    .toString()
    .trim()
  const password = (
    config.pocketbaseAdminPassword ||
    process.env.NUXT_POCKETBASE_ADMIN_PASSWORD ||
    process.env.POCKETBASE_ADMIN_PASSWORD ||
    ''
  )
    .toString()
    .trim()
  const internalRaw = (
    config.pocketbaseInternalUrl ||
    process.env.NUXT_POCKETBASE_INTERNAL_URL ||
    process.env.POCKETBASE_INTERNAL_URL ||
    ''
  )
    .toString()
    .trim()
    .replace(/\/+$/, '')
  return {
    email: email || undefined,
    password: password || undefined,
    internalUrl: internalRaw || undefined
  }
}
