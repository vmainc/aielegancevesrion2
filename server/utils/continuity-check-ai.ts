import type { ContinuityCheckStatus } from '~/lib/continuity-check-result'
import type { ProjectDirector } from '~/types/creative-project'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'
import type { GeneratedShot } from '~/server/utils/generate-shots-ai'
import { normalizeShotsFromModelArray } from '~/server/utils/generate-shots-ai'

export interface ContinuityCheckInput {
  shots: GeneratedShot[]
  continuityMemory: string
  director: ProjectDirector | null
  sceneTitle: string
  charactersSummary: string
  openrouterModelId?: string
}

export interface ContinuityCheckResult {
  status: ContinuityCheckStatus
  /** Short detail for logs / failed status (HTTP code, etc.). */
  detail?: string
  issues: string[]
  shots: GeneratedShot[]
  memoryAppend: string
}

function extractJson (text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as Record<string, unknown>
    } catch {
      return null
    }
  }
  let j = tryParse(trimmed)
  if (j) return j
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end > start) return tryParse(trimmed.slice(start, end + 1))
  return null
}

function asStrArr (v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(x => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
}

function failResult (
  status: Extract<ContinuityCheckStatus, 'skipped' | 'failed' | 'unavailable'>,
  shots: GeneratedShot[],
  detail?: string
): ContinuityCheckResult {
  return { status, detail, issues: [], shots, memoryAppend: '' }
}

/**
 * Claude (via OpenRouter): validate shot list vs continuity + director; return issues and optional fixes.
 * On skip/failure/unavailable, returns original shots unchanged.
 */
export async function checkShotsContinuity (input: ContinuityCheckInput): Promise<ContinuityCheckResult> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    console.warn('[continuity-check-ai] skipped — OpenRouter API key not configured')
    return failResult('skipped', input.shots)
  }

  console.log('[continuity-check-ai] running', {
    sceneTitle: input.sceneTitle,
    shotCount: input.shots.length,
    model: input.openrouterModelId || 'anthropic/claude-3.5-sonnet'
  })

  const d = input.director
  const directorSummary = d
    ? [
        d.name && `Name: ${d.name}`,
        d.style && `Style: ${d.style}`,
        d.tone && `Tone: ${d.tone}`,
        d.camera_preferences && `Camera: ${d.camera_preferences}`,
        d.lighting_style && `Light: ${d.lighting_style}`,
        d.pacing && `Pacing: ${d.pacing}`
      ]
        .filter(Boolean)
        .join('\n')
    : '(none)'

  const system = `You are a film continuity supervisor. Reply with ONLY valid JSON (no markdown):
{
  "issues": ["short bullet strings"],
  "shots": [ ... same objects as input, same keys: order, title, description, shot_type, camera_move, duration_seconds, image_prompt, video_prompt, negative_prompt ],
  "continuity_memory_append": "optional new bullet lines to append to production bible — empty string if nothing to add"
}
Rules:
- If the shot list already matches continuity memory and director bible, return "issues": [] and echo the same "shots" unchanged.
- If you find contradictions (character traits, wardrobe, geography, tone clash, director style break), list them in "issues" and put a FIXED shot list in "shots" (same length preferred; min 3 shots).
- Keep corrections minimal: adjust prompts and descriptions, not wholesale rewrites unless necessary.
- Preserve long image_prompt / video_prompt length and negative_prompt exclusions (especially "no humans" on animal casts).
- continuity_memory_append: only factual additions (e.g. "Mara always wears red scarf") — one line or short paragraph, or "".
`

  const user = `SCENE: ${input.sceneTitle}

CHARACTERS:
${input.charactersSummary || '(none)'}

CONTINUITY MEMORY:
${(input.continuityMemory || '').trim() || '(empty)'}

DIRECTOR BIBLE:
${directorSummary}

GENERATED SHOTS (JSON):
${JSON.stringify(input.shots).slice(0, 45000)}`

  const body = buildOpenRouterChatCompletionBody({
    model: input.openrouterModelId || 'anthropic/claude-3.5-sonnet',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.25,
    max_tokens: 8192
  })

  let res: Response
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aielegance.com',
        'X-Title': 'AI Elegance Continuity'
      },
      body: JSON.stringify(body)
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'network error'
    console.warn('[continuity-check-ai] fetch failed:', msg)
    return failResult('failed', input.shots, msg)
  }

  const raw = await res.text()
  if (!res.ok) {
    const detail = `HTTP ${res.status}`
    console.warn('[continuity-check-ai] OpenRouter error:', detail, raw.slice(0, 400))
    return failResult('failed', input.shots, detail)
  }

  let content = ''
  try {
    const j = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> }
    content = j.choices?.[0]?.message?.content || ''
  } catch {
    console.warn('[continuity-check-ai] invalid OpenRouter JSON envelope')
    return failResult('unavailable', input.shots)
  }

  if (!content.trim()) {
    console.warn('[continuity-check-ai] empty model content')
    return failResult('unavailable', input.shots)
  }

  const parsed = extractJson(content)
  if (!parsed) {
    console.warn('[continuity-check-ai] could not parse continuity JSON from model')
    return failResult('unavailable', input.shots)
  }

  const issues = asStrArr(parsed.issues)
  const memoryAppend =
    typeof parsed.continuity_memory_append === 'string'
      ? parsed.continuity_memory_append.trim().slice(0, 8000)
      : ''

  const rawShots = parsed.shots
  if (!Array.isArray(rawShots) || rawShots.length < 3) {
    console.log('[continuity-check-ai] complete (ran, shots unchanged — model shot list unusable)', {
      sceneTitle: input.sceneTitle,
      issueCount: issues.length
    })
    return { status: 'ran', issues, shots: input.shots, memoryAppend }
  }

  const normalized = normalizeShotsFromModelArray(rawShots)
  if (normalized.length < 3) {
    console.log('[continuity-check-ai] complete (ran, shots unchanged — normalization failed)', {
      sceneTitle: input.sceneTitle,
      issueCount: issues.length
    })
    return { status: 'ran', issues, shots: input.shots, memoryAppend }
  }

  const useFixed = issues.length > 0 && normalized.length >= 3
  const result: ContinuityCheckResult = {
    status: 'ran',
    issues,
    shots: useFixed ? normalized.slice(0, 12) : input.shots,
    memoryAppend
  }
  console.log('[continuity-check-ai] complete', {
    sceneTitle: input.sceneTitle,
    status: result.status,
    issueCount: result.issues.length,
    shotsRepaired: useFixed,
    memoryAppendChars: result.memoryAppend.length
  })
  return result
}
