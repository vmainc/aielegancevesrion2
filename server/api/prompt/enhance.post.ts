import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'

/** Claude via OpenRouter — same as text comparison “Claude” model. */
const ENHANCE_MODEL = 'anthropic/claude-sonnet-4'

const CONTEXT_HINTS: Record<string, string> = {
  character:
    'Character portrait / reference image for film or games. Keep names and key facts if present; add lighting, wardrobe, and camera-friendly detail.',
  video:
    'AI video generation: motion, camera, lighting, time, mood. Be specific and film-literate.',
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
    'Motion/video prompt for a storyboard shot.',
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

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    prompt?: string
    context?: string
    fieldHint?: string
  }>(event)

  const raw = typeof body?.prompt === 'string' ? body.prompt : ''
  const prompt = raw.trim()
  if (!prompt) {
    throw createError({ statusCode: 400, message: 'prompt is required' })
  }
  if (prompt.length > 20000) {
    throw createError({ statusCode: 400, message: 'prompt is too long' })
  }

  const ctxKey = typeof body?.context === 'string' && CONTEXT_HINTS[body.context] ? body.context : 'general'
  const fieldHint = typeof body?.fieldHint === 'string' ? body.fieldHint.trim().slice(0, 120) : ''

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY or NUXT_OPENROUTER_API_KEY.'
    })
  }

  const system = `You are an expert prompt engineer. Improve the user's prompt for clarity, specificity, and results—without changing their intent or language.

Rules:
- Output ONLY the improved prompt text. No title, no quotes, no markdown fences, no preamble.
- Preserve the same language as the input (e.g. English stays English).
- Do not add meta-commentary like "Here is" or "Improved prompt:".
- Keep proper nouns and numbers unless clearly wrong.

${CONTEXT_HINTS[ctxKey]}`

  const userParts = [
    fieldHint ? `Field: ${fieldHint}` : null,
    `Original prompt:\n${raw.trim()}`
  ].filter(Boolean)
  const userContent = userParts.join('\n\n')

  const requestBody = buildOpenRouterChatCompletionBody({
    model: ENHANCE_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent }
    ],
    temperature: 0.45,
    max_tokens: 4096
  })

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
    throw createError({ statusCode: response.status === 401 ? 401 : 502, message: msg })
  }

  let data: { choices?: Array<{ message?: { content?: string } }> }
  try {
    data = JSON.parse(rawText) as { choices?: Array<{ message?: { content?: string } }> }
  } catch {
    throw createError({ statusCode: 502, message: 'Invalid JSON from OpenRouter' })
  }

  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw createError({ statusCode: 502, message: 'Empty response from model' })
  }

  const enhanced = stripCodeFences(content).trim()
  if (!enhanced) {
    throw createError({ statusCode: 502, message: 'Could not parse enhanced prompt' })
  }

  return { enhanced }
})
