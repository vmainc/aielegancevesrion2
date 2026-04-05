import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'

export interface ScriptAiEnrichment {
  summary: string
  genre: string
  tone: string
  themes: string[]
  sceneSummaries: { index: number; summary: string }[]
  characterRoles: { name: string; role_description: string }[]
}

function extractJsonObject (text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function asStr (v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asStrArr (v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(x => (typeof x === 'string' ? x : '')).filter(Boolean)
}

/**
 * One OpenRouter call to enrich parsed script metadata (gaps filled by model).
 */
export async function enrichScriptWithAi (input: {
  projectName: string
  sceneOutline: string
  characterNames: string[]
}): Promise<ScriptAiEnrichment> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    return {
      summary: `Imported project: ${input.projectName}`,
      genre: 'unknown',
      tone: 'unknown',
      themes: [],
      sceneSummaries: [],
      characterRoles: input.characterNames.map(name => ({
        name,
        role_description: 'Imported from script; details to be expanded.'
      }))
    }
  }

  const system = `You are a screenplay analyst. Reply with ONLY valid JSON (no markdown fences), shape:
{
  "summary": "2-4 sentence project summary",
  "genre": "primary genre label",
  "tone": "short tone description",
  "themes": ["theme1","theme2"],
  "sceneSummaries": [{"index":0,"summary":"one line"}, ...],
  "characterRoles": [{"name":"EXACT_NAME","role_description":"one or two sentences"}, ...]
}
Use the same scene order as given (index 0 = first scene). Include every character name from the list in characterRoles (infer role from context).`

  const user = `Project title: ${input.projectName}

Characters seen: ${input.characterNames.join(', ') || '(none detected)'}

Scene list (numbered):
${input.sceneOutline.slice(0, 14000)}`

  const body = buildOpenRouterChatCompletionBody({
    model: 'openai/gpt-4o',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.4,
    max_tokens: 4096
  })

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aielegance.com',
      'X-Title': 'AI Elegance Script Import'
    },
    body: JSON.stringify(body)
  })

  const raw = await res.text()
  if (!res.ok) {
    console.warn('[script-import-ai] OpenRouter error:', res.status, raw.slice(0, 500))
    return {
      summary: `Imported project: ${input.projectName}`,
      genre: 'unknown',
      tone: 'unknown',
      themes: [],
      sceneSummaries: [],
      characterRoles: input.characterNames.map(name => ({
        name,
        role_description: 'Imported from script; details to be expanded.'
      }))
    }
  }

  let content = ''
  try {
    const j = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    content = j.choices?.[0]?.message?.content || ''
  } catch {
    return {
      summary: `Imported project: ${input.projectName}`,
      genre: 'unknown',
      tone: 'unknown',
      themes: [],
      sceneSummaries: [],
      characterRoles: input.characterNames.map(name => ({
        name,
        role_description: 'Imported from script; details to be expanded.'
      }))
    }
  }

  const parsed = extractJsonObject(content)
  if (!parsed) {
    return {
      summary: content.slice(0, 500) || `Imported project: ${input.projectName}`,
      genre: 'unknown',
      tone: 'unknown',
      themes: [],
      sceneSummaries: [],
      characterRoles: input.characterNames.map(name => ({
        name,
        role_description: 'Imported from script; details to be expanded.'
      }))
    }
  }

  const sceneSummaries: { index: number; summary: string }[] = []
  const ss = parsed.sceneSummaries
  if (Array.isArray(ss)) {
    for (const row of ss) {
      if (row && typeof row === 'object') {
        const o = row as Record<string, unknown>
        const idx = typeof o.index === 'number' ? o.index : Number(o.index)
        sceneSummaries.push({
          index: Number.isFinite(idx) ? idx : sceneSummaries.length,
          summary: asStr(o.summary)
        })
      }
    }
  }

  const characterRoles: { name: string; role_description: string }[] = []
  const cr = parsed.characterRoles
  if (Array.isArray(cr)) {
    for (const row of cr) {
      if (row && typeof row === 'object') {
        const o = row as Record<string, unknown>
        const name = asStr(o.name)
        if (name) {
          characterRoles.push({
            name,
            role_description: asStr(o.role_description) || 'Character from script.'
          })
        }
      }
    }
  }

  for (const name of input.characterNames) {
    if (!characterRoles.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      characterRoles.push({
        name,
        role_description: 'Imported from script; details to be expanded.'
      })
    }
  }

  return {
    summary: asStr(parsed.summary) || `Imported project: ${input.projectName}`,
    genre: asStr(parsed.genre) || 'unknown',
    tone: asStr(parsed.tone) || 'unknown',
    themes: asStrArr(parsed.themes),
    sceneSummaries,
    characterRoles
  }
}
