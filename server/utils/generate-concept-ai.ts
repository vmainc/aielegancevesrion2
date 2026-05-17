import {
  buildConceptSystemPrompt,
  buildConceptUserPrompt
} from '~/lib/story-idea-generator-prompts'
import { sanitizeCharacterNameList } from '~/lib/screenplay-format'
import type { ProjectAspectRatio, ProjectGoal } from '~/types/creative-project'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'

function extractJsonObject (text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as Record<string, unknown>
    } catch {
      return null
    }
  }
  let j = tryParse(trimmed)
  if (j && typeof j === 'object' && !Array.isArray(j)) return j
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end > start) {
    j = tryParse(trimmed.slice(start, end + 1))
    if (j && typeof j === 'object' && !Array.isArray(j)) return j
  }
  return null
}

function pickStr (o: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

export interface ParsedConceptFields {
  title: string
  logline: string
  summary: string
  tone: string
  genre: string
  hook?: string
  characters?: string[]
}

export function parseConceptJsonFromAssistantText (text: string): ParsedConceptFields | null {
  const o = extractJsonObject(text)
  if (!o) return null
  const title = pickStr(o, ['title', 'Title'])
  const logline = pickStr(o, ['logline', 'Logline'])
  const summary = pickStr(o, ['summary', 'Summary', 'short_summary', 'shortSummary'])
  const tone = pickStr(o, ['tone', 'Tone'])
  const genre = pickStr(o, ['genre', 'Genre'])
  const hook = pickStr(o, ['hook', 'Hook', 'opening_hook', 'openingHook'])
  if (!title || !summary) return null
  const characters = sanitizeCharacterNameList(o.characters ?? o.Characters ?? o.cast)
  return {
    title: title.slice(0, 500),
    logline: logline.slice(0, 800),
    summary: summary.slice(0, 12000),
    tone: tone.slice(0, 500),
    genre: genre.slice(0, 200),
    ...(hook ? { hook: hook.slice(0, 500) } : {}),
    ...(characters.length ? { characters } : {})
  }
}

/**
 * Call OpenRouter for one concept; returns parsed fields or throws.
 */
export async function generateConceptWithOpenRouter (options: {
  openrouterModelId: string
  userPrompt: string
  goal?: ProjectGoal
  aspectRatio?: ProjectAspectRatio
}): Promise<ParsedConceptFields> {
  const goal = options.goal || 'film'
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured')
  }

  const body = buildOpenRouterChatCompletionBody({
    model: options.openrouterModelId,
    messages: [
      { role: 'system', content: buildConceptSystemPrompt(goal) },
      {
        role: 'user',
        content: buildConceptUserPrompt(options.userPrompt, goal, options.aspectRatio)
      }
    ],
    temperature: 0.75,
    max_tokens: 1200
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
  const t = setTimeout(() => controller.abort(), 120_000)
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: controller.signal
  }).finally(() => clearTimeout(t))

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    let msg = `OpenRouter ${res.status}`
    try {
      const j = JSON.parse(errText) as { error?: { message?: string } }
      if (j?.error?.message) msg = j.error.message
    } catch {
      if (errText) msg = errText.slice(0, 500)
    }
    throw new Error(msg)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Empty model response')
  }

  const parsed = parseConceptJsonFromAssistantText(content)
  if (!parsed) {
    throw new Error('Could not parse concept JSON from model')
  }
  return parsed
}
