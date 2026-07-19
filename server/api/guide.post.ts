import { ApiErrorCode, isAbortLikeError, throwApiError } from '~/server/utils/api-error-envelope'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'
import { listSharedProjectIdsForUser } from '~/server/utils/project-access'
import { isCloudProjectId, type StudioGuideProjectSummary } from '~/lib/studio-guide'
import {
  buildStudioGuideSystemPrompt,
  parseStudioGuideResponse
} from '~/server/utils/studio-guide-ai'

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4'
const MODEL_FALLBACKS = ['openai/gpt-4o', 'google/gemini-2.0-flash-001']

type ChatTurn = { role: 'user' | 'assistant'; content: string }

async function loadAccessibleProjects (userId: string): Promise<StudioGuideProjectSummary[]> {
  const pb = await getAuthenticatedPocketBase()
  const out: StudioGuideProjectSummary[] = []
  const seen = new Set<string>()

  const push = (row: Record<string, unknown>) => {
    const id = String(row.id || '')
    if (!isCloudProjectId(id) || seen.has(id)) return
    seen.add(id)
    out.push({
      id,
      name: String(row.name || 'Untitled').slice(0, 200)
    })
  }

  try {
    const owned = await pb.collection('creative_projects').getFullList({
      filter: `owned_by = "${userId}"`,
      sort: '-updated',
      batch: 50
    })
    for (const row of owned as Array<Record<string, unknown>>) push(row)
  } catch {
    /* collection may be missing */
  }

  try {
    const sharedIds = await listSharedProjectIdsForUser(pb, userId)
    for (const id of sharedIds.slice(0, 20)) {
      if (seen.has(id)) continue
      try {
        const rec = await pb.collection('creative_projects').getOne(id)
        push(rec as Record<string, unknown>)
      } catch {
        /* skip missing */
      }
    }
  } catch {
    /* shared list optional */
  }

  return out.slice(0, 24)
}

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  checkRateLimit(rateLimitKey(userId, 'studio-guide'), 30, 60_000)

  const body = await readBody<{ messages?: ChatTurn[] }>(event)
  const messages = Array.isArray(body?.messages) ? body.messages : []
  const trimmed = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, 8000) }))
    .filter(m => m.content)
    .slice(-24)

  const lastUser = [...trimmed].reverse().find(m => m.role === 'user')
  if (!lastUser) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'messages must include at least one user turn')
  }

  const projects = await loadAccessibleProjects(userId)
  const allowedProjectIds = new Set(projects.map(p => p.id))

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throwApiError(
      500,
      ApiErrorCode.OPENROUTER_NOT_CONFIGURED,
      'OpenRouter API key not configured.'
    )
  }

  const system = buildStudioGuideSystemPrompt(projects)
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

  const candidates = [DEFAULT_MODEL, ...MODEL_FALLBACKS]
    .map(m => m.trim())
    .filter(Boolean)
    .filter((m, i, arr) => arr.indexOf(m) === i)

  let lastMessage = ''
  let lastStatus = 502

  for (const candidate of candidates) {
    const requestBody = buildOpenRouterChatCompletionBody({
      model: candidate,
      messages: openRouterMessages,
      temperature: 0.5,
      max_tokens: 2048
    })

    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 90000)
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
        lastMessage = 'Studio Guide timed out. Try a shorter message.'
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

    return parseStudioGuideResponse(content, allowedProjectIds)
  }

  throwApiError(
    lastStatus === 401 ? 401 : lastStatus,
    lastStatus === 401 ? ApiErrorCode.UNAUTHORIZED : ApiErrorCode.OPENROUTER_UPSTREAM,
    lastMessage || 'Studio Guide failed across available models.'
  )
})
