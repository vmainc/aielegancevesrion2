import { ApiErrorCode, isAbortLikeError, throwApiError } from '~/server/utils/api-error-envelope'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { resolveProjectAccess } from '~/server/utils/project-access'
import { getConceptGeneratorModelById } from '~/lib/concept-generator-models'

/** Fallback model when project preference is unavailable. */
const ENHANCE_MODEL = 'anthropic/claude-sonnet-4'
const ENHANCE_MODEL_FALLBACKS = ['openai/gpt-4o', 'google/gemini-2.0-flash-001']

const CONTEXT_HINTS: Record<string, string> = {
  character:
    'Character reference plate: appearance, species/breed, face, body, wardrobe, and materials only. Exactly one subject. Isolated on a solid chroma-key green (#00FF00) or solid black background. No story action, no other characters, no environment or set.',
  video:
    'AI video generation: motion, camera, lighting, time, mood. Be specific and film-literate. Never add background music, score, or soundtrack. Diegetic ambient sound or dialogue only if the user asks.',
  image:
    'Text-to-image prompt: composition, style, lighting, subject detail.',
  concept:
    'Film or story concept: pitch clarity, tone, stakes, audience.',
  director:
    'Director bible field: cinematic vocabulary, concise and actionable.',
  continuity:
    'Continuity memory: keep facts explicit, consistent, and scannable.',
  story:
    'Cinematic shot description for storyboard / shot list.',
  shot_image:
    'Single-frame image prompt for a storyboard shot.',
  shot_video:
    'Motion/video prompt for a storyboard shot. No background music or score unless the user explicitly requests it.',
  soundscape:
    'Diegetic ambient / SFX soundscape for AI video audio. Environment and in-scene sounds only — never music, score, or soundtrack.',
  lyrics:
    'Original song lyrics for AI music generation: clear structure, singable lines, emotional fit to mood.',
  question:
    'Question to AI models: clear, specific, one main ask.',
  comment:
    'Short comment: clear and polite.',
  general: 'General creative or technical prompt.'
}

function stripCodeFences (text: string): string {
  const t = text.trim()
  if (!t.startsWith('```')) return t
  const lines = t.split('\n')
  if (lines.length < 2) return t
  lines.shift()
  if (lines.length && lines[lines.length - 1].trim() === '```') {
    lines.pop()
  } else if (lines.length && lines[lines.length - 1].trim().endsWith('```')) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/```\s*$/, '').trimEnd()
  }
  return lines.join('\n').trim()
}

function buildEnhanceSystemPrompt (ctxKey: string): string {
  if (ctxKey === 'soundscape') {
    return `You write diegetic ambient soundscape / SFX descriptions for AI video models (ChatGPT-style clarity).

Given a video or scene prompt, invent a matching soundscape the viewer would hear in that place and moment.

Rules:
- Output ONLY the soundscape text. No title, no quotes, no markdown fences, no preamble.
- Diegetic in-scene sounds only: weather, room tone, nature, traffic, footsteps, machinery, distant crowd murmur, etc.
- Never include background music, score, soundtrack, songs, or musical beds.
- Do not invent spoken dialogue lines; brief unintelligible ambience is OK if the scene implies a crowd.
- Match location, time of day, weather, materials, and mood implied by the scene.
- Prefer 1–4 dense sentences or a vivid comma-separated list of layered sounds.
- Preserve the same language as the input.

${CONTEXT_HINTS.soundscape}`
  }

  if (ctxKey === 'lyrics') {
    return `You write original song lyrics for AI music models (e.g. Lyria).

Given a brief describing purpose, mood, and style, invent lyrics that fit.

Rules:
- Output ONLY the lyrics. No title unless it is part of the lyric text, no quotes, no markdown fences, no preamble.
- Use clear section labels like [Verse], [Chorus], [Bridge] when helpful.
- Keep lines singable and concise; avoid stage directions or production notes.
- Match the emotional tone and language of the brief.
- Do not copy existing copyrighted songs.

${CONTEXT_HINTS.lyrics}`
  }

  return `You are an expert prompt engineer. Improve the user's prompt for clarity, specificity, and results—without changing their intent or language.

Rules:
- Output ONLY the improved prompt text. No title, no quotes, no markdown fences, no preamble.
- Preserve the same language as the input (e.g. English stays English).
- Do not add meta-commentary like "Here is" or "Improved prompt:".
- Keep proper nouns and numbers unless clearly wrong.

${CONTEXT_HINTS[ctxKey]}`
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    prompt?: string
    context?: string
    fieldHint?: string
    projectId?: string
  }>(event)

  const raw = typeof body?.prompt === 'string' ? body.prompt : ''
  const prompt = raw.trim()
  if (!prompt) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'prompt is required')
  }
  if (prompt.length > 20000) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'prompt is too long')
  }

  const ctxKey = typeof body?.context === 'string' && CONTEXT_HINTS[body.context] ? body.context : 'general'
  const fieldHint = typeof body?.fieldHint === 'string' ? body.fieldHint.trim().slice(0, 120) : ''

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throwApiError(
      500,
      ApiErrorCode.OPENROUTER_NOT_CONFIGURED,
      'OpenRouter API key not configured. Set OPENROUTER_API_KEY or NUXT_OPENROUTER_API_KEY.'
    )
  }

  const system = buildEnhanceSystemPrompt(ctxKey)

  const userParts = [
    fieldHint ? `Field: ${fieldHint}` : null,
    ctxKey === 'soundscape'
      ? `Video / scene prompt:\n${raw.trim()}`
      : `Original prompt:\n${raw.trim()}`
  ].filter(Boolean)
  const userContent = userParts.join('\n\n')

  let enhanceModel = ctxKey === 'soundscape' ? 'openai/gpt-4o' : ENHANCE_MODEL
  const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : ''
  if (projectId && ctxKey !== 'soundscape') {
    try {
      const userId = await getPocketBaseUserIdFromRequest(event)
      const pb = await getAuthenticatedPocketBase()
      const project = await pb.collection('creative_projects').getOne(projectId) as Record<string, unknown>
      const access = await resolveProjectAccess(pb, userId, projectId, project)
      if (access) {
        const preferred = String(project.preferred_model_id || '').trim()
        const cfg = getConceptGeneratorModelById(preferred)
        if (cfg?.openrouterModelId) enhanceModel = cfg.openrouterModelId
      }
    } catch {
      // Keep endpoint resilient: fallback to default enhance model.
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey.trim()}`
  }
  if (process.env.OPENROUTER_REFERER) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_REFERER
  }
  if (process.env.OPENROUTER_TITLE) {
    headers['X-Title'] = process.env.OPENROUTER_TITLE
  }

  const fallbacks =
    ctxKey === 'soundscape'
      ? ['openai/gpt-4o-mini', 'anthropic/claude-sonnet-4', 'google/gemini-2.0-flash-001']
      : ENHANCE_MODEL_FALLBACKS

  const candidates = [enhanceModel, ...fallbacks]
    .map(m => m.trim())
    .filter(Boolean)
    .filter((m, i, arr) => arr.indexOf(m) === i)

  let lastMessage = ''
  let lastStatus = 502
  for (const model of candidates) {
    const requestBody = buildOpenRouterChatCompletionBody({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent }
      ],
      temperature: 0.45,
      max_tokens: 4096
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
        lastMessage = 'Prompt enhancement timed out (90s). Try again with a shorter prompt.'
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

    const enhanced = stripCodeFences(content).trim()
    if (!enhanced) {
      lastMessage = 'Could not parse enhanced prompt'
      lastStatus = 502
      continue
    }
    return { enhanced }
  }

  throwApiError(
    lastStatus === 401 ? 401 : lastStatus,
    lastStatus === 401 ? ApiErrorCode.UNAUTHORIZED : ApiErrorCode.OPENROUTER_UPSTREAM,
    lastMessage || 'Prompt enhancement failed across available models.'
  )
})
