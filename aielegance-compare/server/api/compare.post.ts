import { createEventStream, createError, getRequestIP, readBody } from 'h3'
import { clampPrompt, parseModelsConfig, resolveMessages } from '../../lib/compare'
import { completeChat } from '../utils/openrouter-chat'
import { allowRequest, clientKey } from '../utils/compare-rate-limit'

const SYSTEM_PROMPT =
  'Answer clearly and directly. Be accurate. If you are uncertain, say so. Prefer concise structure over filler.'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = String(config.openrouterApiKey || process.env.OPENROUTER_API_KEY || '').trim()
  if (!apiKey) {
    throw createError({ statusCode: 500, message: 'This service is not configured yet.' })
  }

  const maxPrompt = Number(config.maxPromptChars) || 4000
  const maxTokens = Number(config.maxOutputTokens) || 1200
  const timeoutMs = Number(config.timeoutMs) || 45_000
  const rateMax = Number(config.rateLimit) || 8
  const rateWindow = Number(config.rateWindowMs) || 60_000

  const ip = getRequestIP(event, { xForwardedFor: true }) || clientKey(event)
  if (!allowRequest(ip, rateMax, rateWindow)) {
    throw createError({ statusCode: 429, message: 'Too many questions. Please wait a moment.' })
  }

  const body = await readBody(event).catch(() => ({})) as {
    prompt?: string
    conversationId?: string
    messages?: Array<{ role?: string; content?: string }>
  }
  const prompt = clampPrompt(String(body?.prompt || ''), maxPrompt)
  const messages = resolveMessages({
    prompt,
    conversationId: typeof body?.conversationId === 'string' ? body.conversationId : undefined,
    messages: Array.isArray(body?.messages)
      ? body.messages.map(m => ({
          role: (m.role === 'assistant' || m.role === 'system' ? m.role : 'user') as 'user' | 'assistant' | 'system',
          content: String(m.content || '')
        }))
      : undefined
  }).map(m => ({
    ...m,
    content: clampPrompt(m.content, maxPrompt)
  }))

  if (!messages.length) {
    throw createError({ statusCode: 400, message: 'Please enter a question.' })
  }

  const models = parseModelsConfig(String(config.modelsJson || process.env.AIELEGANCE_MODELS || ''))
  if (!models.length) {
    throw createError({ statusCode: 500, message: 'No models are configured.' })
  }

  const stream = createEventStream(event)
  const baseUrl = String(config.openrouterBaseUrl || 'https://openrouter.ai/api/v1')
  const referer = String(config.openrouterReferer || 'https://aielegance.com')
  const title = String(config.openrouterTitle || 'AIElegance')

  void (async () => {
    try {
      await Promise.all(
        models.map(async (model) => {
          const result = await completeChat({
            model,
            messages,
            systemPrompt: SYSTEM_PROMPT,
            apiKey,
            baseUrl,
            referer,
            title,
            maxOutputTokens: maxTokens,
            timeoutMs
          })
          await stream.push(JSON.stringify({ type: 'result', ...result }))
        })
      )
      await stream.push(JSON.stringify({ type: 'done' }))
    } catch {
      await stream.push(JSON.stringify({ type: 'done' }))
    } finally {
      await stream.close()
    }
  })()

  return stream.send()
})
