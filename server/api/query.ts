import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { OPENROUTER_TEXT_MODEL_MAP } from '~/server/utils/openrouter-text-models'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'

const MODELS = [
  'ChatGPT',
  'Claude',
  'Gemini',
  'Mistral',
  'DeepSeek',
  'LLaMA',
  'Grok',
  'Perplexity'
]

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { question } = body

  if (!question) {
    throw createError({
      statusCode: 400,
      message: 'Question is required'
    })
  }

  const config = useRuntimeConfig()
  
  // Use Promise.allSettled to run all queries in parallel
  // This allows responses to complete independently
  const promises = MODELS.map(async (model) => {
    try {
      const answer = await queryModel(model, question, config)
      return { model, success: true, answer, rating: null }
    } catch (error: any) {
      const errorMessage = error?.message || String(error)
      console.error(`Error querying ${model}:`, errorMessage)
      return { model, success: false, answer: `Error: ${errorMessage}`, rating: null }
    }
  })

  const results = await Promise.allSettled(promises)
  
  const responses: Record<string, { answer: string; rating: null }> = {}
  
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      responses[result.value.model] = { 
        answer: result.value.answer, 
        rating: null 
      }
    }
  })

  return responses
})

export async function queryModel(model: string, question: string, config: any): Promise<string> {
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured')
  }

  const openRouterModelId = OPENROUTER_TEXT_MODEL_MAP[model]
  if (!openRouterModelId) {
    throw new Error(`Unknown model: ${model}`)
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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `API error (${response.status}): ${errorText}`
    
    // Try to parse JSON error for better error messages
    try {
      const errorJson = JSON.parse(errorText)
      if (errorJson.error?.message) {
        errorMessage = `API error (${response.status}): ${errorJson.error.message}`
        
        // Provide helpful error messages for common issues
        if (response.status === 401 && errorJson.error.message === 'User not found.') {
          errorMessage = 'Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY in the .env file and ensure it\'s valid. Get a key from https://openrouter.ai'
        }
      }
    } catch {
      // If not JSON, use the raw error text
    }
    
    console.error(`[${model}] OpenRouter API Error:`, errorMessage)
    throw new Error(errorMessage)
  }

  const data = await response.json()

  // OpenRouter uses OpenAI-compatible response format
  return data.choices?.[0]?.message?.content || 'No response received'
}
