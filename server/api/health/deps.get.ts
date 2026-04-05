import { resolveOpenRouterApiKey, resolvePocketBaseAdmin } from '~/server/utils/server-env'

/**
 * No secrets exposed — booleans only. Use after deploy to verify env reaches Node.
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const admin = resolvePocketBaseAdmin(config)
  const openrouter = resolveOpenRouterApiKey(config)

  return {
    openrouterApiKeySet: !!openrouter,
    pocketbaseAdminEmailSet: !!admin.email,
    pocketbaseAdminPasswordSet: !!admin.password,
    pocketbaseInternalUrlSet: !!admin.internalUrl,
    publicPocketbaseUrl: config.public?.pocketbaseUrl || ''
  }
})
