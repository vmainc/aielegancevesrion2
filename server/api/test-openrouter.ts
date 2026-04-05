import { resolveOpenRouterApiKey } from '~/server/utils/server-env'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)

  return {
    hasApiKey: !!apiKey,
    keyLength: apiKey?.length || 0,
    keyPrefix: apiKey ? `${apiKey.substring(0, 15)}...` : 'MISSING',
    keyStartsWith: apiKey?.substring(0, 7) || 'N/A',
    envVarPresent: !!process.env.OPENROUTER_API_KEY,
    envVarLength: process.env.OPENROUTER_API_KEY?.length || 0
  }
})

