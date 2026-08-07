import { ApiErrorCode, isAbortLikeError, throwApiError } from '~/server/utils/api-error-envelope'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'
import {
  heuristicMusicGuideAnalyze,
  parseMusicGuideAnalyzeJson
} from '~/lib/music-generation-guide'

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4'
const MODEL_FALLBACKS = ['openai/gpt-4o', 'google/gemini-2.0-flash-001']

const SYSTEM = `You analyze a user's freeform music request and return JSON for Lyria music generation settings.

Return ONLY valid JSON (no markdown) with this shape:
{
  "purpose": "film_score" | "theme_song" | "mood_bed" | "promo" | "other",
  "purposeOther": "string if purpose is other, else empty",
  "length": "clip" | "full",
  "vocals": "instrumental" | "own_lyrics" | "generate_lyrics",
  "ownLyrics": "only if user pasted lyrics; else empty",
  "mood": "1-2 sentences capturing genre, energy, instrumentation, emotion",
  "bpm": null or a number,
  "compositionPrompt": "a rich Lyria prompt that preserves the user's intent and adds useful production detail"
}

Rules:
- length "clip" ≈ 30 seconds (stings, beds, short cues). "full" ≈ up to 3 minutes (songs, themes).
- If they want a song with lyrics but did not paste lyrics, use vocals "generate_lyrics".
- If they want underscore/score/ambient with no singing, use "instrumental".
- If they pasted lyrics in the request, use "own_lyrics" and copy them into ownLyrics.
- compositionPrompt must keep the user's subject matter (e.g. salamanders stay salamanders).
- Prefer rock/pop/song requests as length "full" and vocals "generate_lyrics" unless they say instrumental.
- Prefer film score / underscore as length "clip" (or "full" if they ask for a long cue) and instrumental.`

export default defineEventHandler(async (event) => {
  const body = await readBody<{ intent?: string }>(event)
  const intent = typeof body?.intent === 'string' ? body.intent.trim() : ''
  if (!intent) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'intent is required')
  }
  if (intent.length > 4000) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'intent is too long')
  }

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    return {
      source: 'heuristic' as const,
      ...heuristicMusicGuideAnalyze(intent)
    }
  }

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

  for (const candidate of candidates) {
    const requestBody = buildOpenRouterChatCompletionBody({
      model: candidate,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: intent }
      ],
      temperature: 0.3,
      max_tokens: 1200
    })

    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 60000)
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
        lastMessage = 'timed out'
        continue
      }
      lastMessage = e instanceof Error ? e.message : String(e)
      continue
    } finally {
      clearTimeout(t)
    }

    const rawText = await response.text()
    if (!response.ok) {
      lastMessage = `OpenRouter ${response.status}`
      continue
    }

    let content = ''
    try {
      const j = JSON.parse(rawText) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      content = j.choices?.[0]?.message?.content?.trim() || ''
    } catch {
      lastMessage = 'bad response'
      continue
    }

    const parsed = parseMusicGuideAnalyzeJson(content)
    if (parsed) {
      return { source: 'ai' as const, ...parsed }
    }
    lastMessage = 'could not parse analysis'
  }

  // Soft fallback — never block the guide on model failure
  return {
    source: 'heuristic' as const,
    notice: lastMessage || 'Fell back to local analysis.',
    ...heuristicMusicGuideAnalyze(intent)
  }
})
