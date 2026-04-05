import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { OPENROUTER_TEXT_MODEL_MAP } from '~/server/utils/openrouter-text-models'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'

export default defineEventHandler(async (event) => {
  const model = getRouterParam(event, 'model')
  const body = await readBody(event)
  const { question } = body

  if (!question) {
    throw createError({
      statusCode: 400,
      message: 'Question is required'
    })
  }

  if (!model) {
    throw createError({
      statusCode: 400,
      message: 'Model is required'
    })
  }

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message:
        'OpenRouter API key not configured. Set OPENROUTER_API_KEY or NUXT_OPENROUTER_API_KEY for the Node server and restart.'
    })
  }

  // Debug: Log API key presence (but not the full key for security)
  console.log(`[${model}] OpenRouter API key configured:`, apiKey ? `${apiKey.substring(0, 15)}...` : 'MISSING')
  console.log(`[${model}] API key length:`, apiKey?.length || 0)
  console.log(`[${model}] API key starts with:`, apiKey?.substring(0, 7) || 'N/A')

  const openRouterModelId = OPENROUTER_TEXT_MODEL_MAP[model]
  if (!openRouterModelId) {
    throw createError({
      statusCode: 400,
      message: `Unknown model: ${model}`
    })
  }

  // OpenRouter uses OpenAI-compatible API format
  const endpoint = 'https://openrouter.ai/api/v1/chat/completions'
  
  const requestBody = buildOpenRouterChatCompletionBody({
    model: openRouterModelId,
    messages: [{ role: 'user', content: question }],
    temperature: 0.7,
    max_tokens: 1024
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey.trim()}`
  }
  
  // Optional headers for OpenRouter analytics
  if (process.env.OPENROUTER_REFERER) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  }
  if (process.env.OPENROUTER_TITLE) {
    headers['X-Title'] = process.env.OPENROUTER_TITLE
  }

  const openRouterTimeoutMs = 120000

  try {
    // Log request details for debugging (without exposing full API key)
    console.log(`[${model}] Making OpenRouter request to:`, endpoint)
    console.log(`[${model}] Model ID:`, openRouterModelId)
    console.log(`[${model}] Request headers:`, {
      ...headers,
      Authorization: headers.Authorization ? `${headers.Authorization.substring(0, 20)}...` : 'MISSING'
    })

    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), openRouterTimeoutMs)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    }).finally(() => clearTimeout(t))

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[${model}] OpenRouter API Error (${response.status}):`, errorText)
      
      let errorMessage = `API error (${response.status}): ${errorText}`
      
      // Provide helpful error messages for common issues
      try {
        const errorJson = JSON.parse(errorText)
        const em = errorJson.error?.message
        if (em) {
          errorMessage = `OpenRouter: ${em}`
        }
        if (response.status === 401 && em === 'User not found.') {
          const keyPrefix = apiKey.trim().substring(0, 10)
          errorMessage = `Invalid OpenRouter API key (starts with ${keyPrefix}…). Check OPENROUTER_API_KEY and restart the Node server.`
        }
      } catch {
        /* keep errorMessage from raw text */
      }
      
      throw new Error(errorMessage)
    }

    const data = await response.json()

    // OpenRouter uses OpenAI-compatible response format
    const answer = data.choices?.[0]?.message?.content || 'No response received'

    return { model, answer, rating: null }
  } catch (error: any) {
    const errorMessage =
      error?.name === 'AbortError'
        ? `OpenRouter request timed out after ${openRouterTimeoutMs / 1000}s for ${model}. Try again or pick a faster model.`
        : error?.message || String(error)
    console.error(`Error querying ${model}:`, errorMessage)
    throw createError({
      statusCode: error?.name === 'AbortError' ? 504 : 500,
      message: errorMessage
    })
  }
})
