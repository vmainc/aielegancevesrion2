import { ApiErrorCode, isAbortLikeError, throwApiError } from '~/server/utils/api-error-envelope'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'
import { getConceptGeneratorModelById } from '~/lib/concept-generator-models'
import { loadProjectGuideContext } from '~/server/utils/project-guide-context'
import {
  buildProjectGuideSystemPrompt,
  parseProjectGuideResponse
} from '~/server/utils/project-guide-ai'

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4'
const MODEL_FALLBACKS = ['openai/gpt-4o', 'google/gemini-2.0-flash-001']

type ChatTurn = { role: 'user' | 'assistant'; content: string }

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Missing project id')
  }

  const { userId, pb } = await requireProjectOwner(event, projectId)
  checkRateLimit(rateLimitKey(userId, 'project-guide'), 30, 60_000)

  const body = await readBody<{ messages?: ChatTurn[] }>(event)
  const messages = Array.isArray(body?.messages) ? body.messages : []
  const trimmed = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, 12000) }))
    .filter(m => m.content)
    .slice(-24)

  const lastUser = [...trimmed].reverse().find(m => m.role === 'user')
  if (!lastUser) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'messages must include at least one user turn')
  }

  const ctx = await loadProjectGuideContext(pb, projectId, userId)

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throwApiError(
      500,
      ApiErrorCode.OPENROUTER_NOT_CONFIGURED,
      'OpenRouter API key not configured.'
    )
  }

  let model = DEFAULT_MODEL
  try {
    const project = await pb.collection('creative_projects').getOne(projectId)
    const preferred = String((project as { preferred_model_id?: unknown }).preferred_model_id || '').trim()
    const cfg = getConceptGeneratorModelById(preferred)
    if (cfg?.openrouterModelId) model = cfg.openrouterModelId
  } catch {
    /* default model */
  }

  const system = buildProjectGuideSystemPrompt(ctx)
  const openRouterMessages = [
    { role: 'system', content: system },
    ...trimmed.map(m => ({ role: m.role, content: m.content }))
  ]

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey.trim()}`
  }
  if (process.env.OPENROUTER_REFERER) headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  if (process.env.OPENROUTER_TITLE) headers['X-Title'] = process.env.OPENROUTER_TITLE

  const candidates = [model, ...MODEL_FALLBACKS]
    .map(m => m.trim())
    .filter(Boolean)
    .filter((m, i, arr) => arr.indexOf(m) === i)

  let lastMessage = ''
  let lastStatus = 502

  for (const candidate of candidates) {
    const requestBody = buildOpenRouterChatCompletionBody({
      model: candidate,
      messages: openRouterMessages,
      temperature: 0.55,
      max_tokens: 4096
    })

    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 120000)
    let response: Response
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })
    } catch (e: unknown) {
      clearTimeout(t)
      if (isAbortLikeError(e)) {
        lastMessage = 'Project Guide timed out (120s). Try a shorter message.'
        lastStatus = 504
        continue
      }
      lastMessage = e instanceof Error ? e.message : String(e)
      lastStatus = 502
      continue
    } finally {
      clearTimeout(t)
    }

    const rawText = await response.text()
    if (!response.ok) {
      let msg = `OpenRouter error (${response.status})`
      try {
        const j = JSON.parse(rawText) as { error?: { message?: string } }
        if (j?.error?.message) msg = j.error.message
      } catch {
        msg = rawText.slice(0, 300)
      }
      lastMessage = msg
      lastStatus = response.status === 401 ? 401 : 502
      if (response.status === 401) break
      continue
    }

    let data: { choices?: Array<{ message?: { content?: string } }> }
    try {
      data = JSON.parse(rawText) as { choices?: Array<{ message?: { content?: string } }> }
    } catch {
      lastMessage = 'Invalid JSON from OpenRouter'
      lastStatus = 502
      continue
    }

    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      lastMessage = 'Empty response from model'
      lastStatus = 502
      continue
    }

    return parseProjectGuideResponse(content, ctx)
  }

  throwApiError(
    lastStatus === 401 ? 401 : lastStatus,
    lastStatus === 401 ? ApiErrorCode.UNAUTHORIZED : ApiErrorCode.OPENROUTER_UPSTREAM,
    lastMessage || 'Project Guide failed across available models.'
  )
})
