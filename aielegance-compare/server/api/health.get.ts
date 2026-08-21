export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  return {
    ok: true,
    openrouterApiKeySet: Boolean(String(config.openrouterApiKey || process.env.OPENROUTER_API_KEY || '').trim())
  }
})
