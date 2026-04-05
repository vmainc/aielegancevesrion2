import type { ProjectDirector } from '~/types/creative-project'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'

export interface GeneratedShot {
  order: number
  title: string
  description: string
  shot_type: string
  camera_move: string
  duration_seconds: number
  image_prompt: string
  video_prompt: string
}

export interface GenerateShotsContext {
  projectName: string
  aspectRatio: string
  goal: string
  tone: string
  sceneTitle: string
  sceneSummary: string
  sceneScript: string
  characters: Array<{
    name: string
    traitsRoleVisual: string
  }>
  director?: ProjectDirector | null
  continuityMemory?: string | null
}

function extractJsonWithShots (text: string): { shots?: unknown[] } | null {
  const trimmed = text.trim()
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as { shots?: unknown[] }
    } catch {
      return null
    }
  }
  let j = tryParse(trimmed)
  if (j?.shots && Array.isArray(j.shots)) return j
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end > start) {
    j = tryParse(trimmed.slice(start, end + 1))
    if (j?.shots && Array.isArray(j.shots)) return j
  }
  return null
}

function num (v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v)
  return fallback
}

function str (v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

/** Reconcile order field: prefer 1-based order from model, fall back to index. */
export function normalizeShotsFromModelArray (rawList: unknown[]): GeneratedShot[] {
  const out: GeneratedShot[] = []
  rawList.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return
    const o = raw as Record<string, unknown>
    const orderVal = Math.floor(num(o.order, i + 1))
    const title = str(o.title).trim() || `Shot ${i + 1}`
    const description = str(o.description).trim() || title
    const image_prompt = str(o.image_prompt).trim()
    const video_prompt = str(o.video_prompt).trim()
    if (!image_prompt || !video_prompt) return
    out.push({
      order: orderVal,
      title: title.slice(0, 300),
      description: description.slice(0, 5000),
      shot_type: str(o.shot_type, 'medium shot').slice(0, 200),
      camera_move: str(o.camera_move, 'static').slice(0, 200),
      duration_seconds: Math.min(120, Math.max(0.5, num(o.duration_seconds, 3))),
      image_prompt: image_prompt.slice(0, 8000),
      video_prompt: video_prompt.slice(0, 8000)
    })
  })
  out.sort((a, b) => a.order - b.order)
  return out.map((s, i) => ({ ...s, order: i + 1 }))
}

/**
 * OpenRouter: scene → structured shot list (JSON).
 */
export async function generateShotsWithAi (ctx: GenerateShotsContext): Promise<GeneratedShot[]> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured')
  }

  const goalLabel =
    ctx.goal === 'commercial'
      ? 'commercial / ad'
      : ctx.goal === 'social'
        ? 'social / short-form viral'
        : ctx.goal === 'film'
          ? 'narrative film'
          : ctx.goal

  const aspectRules =
    ctx.aspectRatio === '9:16'
      ? `Aspect is 9:16 (vertical). Prioritize close-ups, vertical composition, tight framing, faster pacing, mobile-first readability. Include environment only when it serves the hook.`
      : ctx.aspectRatio === '1:1'
        ? `Aspect is 1:1 (square). Balance subject and environment; strong center-weighted compositions.`
        : `Aspect is 16:9 (landscape). Prioritize wide establishing shots, cinematic depth, environment, and layered framing.`

  const goalRules =
    ctx.goal === 'social'
      ? `Goal: social — first 1–2 shots must be a strong hook; faster pacing; shorter duration_seconds (often 1–4s per shot).`
      : ctx.goal === 'film'
        ? `Goal: film — slower, atmospheric pacing; longer duration_seconds (often 4–10s); room for mood and silence.`
        : ctx.goal === 'commercial'
          ? `Goal: commercial/ad — clear product or message readability; confident, polished look; varied shot sizes for cut points.`
          : `Goal: ${ctx.goal} — balanced pacing suitable for the format.`

  const charBlock =
    ctx.characters.length > 0
      ? ctx.characters
          .map(
            c =>
              `- ${c.name}: ${c.traitsRoleVisual || 'role and look to be inferred from script'}`
          )
          .join('\n')
      : '(No characters listed — infer from scene.)'

  const scriptExcerpt = (ctx.sceneScript || '').trim().slice(0, 12000)
  const summary = (ctx.sceneSummary || '').trim() || '(none)'

  const d = ctx.director
  const directorBlock =
    d &&
    (d.name ||
      d.style ||
      d.tone ||
      d.camera_preferences ||
      d.lighting_style ||
      d.pacing)
      ? `DIRECTOR BIBLE (follow this creative stance in every shot)
Name: ${d.name || '(unnamed)'}
Style: ${d.style || '—'}
Director tone: ${d.tone || '—'}
Camera preferences: ${d.camera_preferences || '—'}
Lighting style: ${d.lighting_style || '—'}
Pacing: ${d.pacing || '—'}

`
      : ''

  const mem = (ctx.continuityMemory || '').trim()
  const continuityBlock = mem
    ? `CONTINUITY MEMORY (do not contradict; reinforce when relevant)
${mem.slice(0, 8000)}

`
    : ''

  const system = `You are a director of photography and storyboard artist. Output ONLY valid JSON (no markdown), exactly this shape:
{"shots":[{"order":1,"title":"short label","description":"what we see and story beat","shot_type":"e.g. wide establishing | medium | close-up | insert","camera_move":"e.g. slow push in | handheld | static | crane up","duration_seconds":4,"image_prompt":"single clean visual prompt: lighting, environment, subject, mood, lens feel","video_prompt":"cinematic motion description: camera move, subject motion, lighting shifts, atmosphere"}]}
Rules:
- Produce between 5 and 12 shots in "shots" array.
- Mix establishing, medium, close-up, and detail/insert shots intentionally.
- order must be 1..N in story order.
- image_prompt: concise, production-ready still description (no camera jargon overload).
- video_prompt: expand with motion, camera behavior, lighting, atmosphere; may repeat and elaborate image_prompt.
- When named characters appear, keep their described traits and visual continuity across shots.
- Interpret scene meaning from summary and script; imperfect script formatting is OK.
- duration_seconds: realistic float (e.g. 2.5), aligned with goal rules below.`

  const user = `${directorBlock}${continuityBlock}PROJECT
Name: ${ctx.projectName}
Aspect ratio: ${ctx.aspectRatio}
Goal (format): ${goalLabel}
Tone (mood): ${ctx.tone || 'cinematic'}

${aspectRules}

${goalRules}

SCENE
Title: ${ctx.sceneTitle}
Summary: ${summary}

SCRIPT / SCENE TEXT (may be partial or messy):
${scriptExcerpt || '(no script body — work from title and summary only)'}

CHARACTERS
${charBlock}`

  const body = buildOpenRouterChatCompletionBody({
    model: 'openai/gpt-4o',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.55,
    max_tokens: 8192
  })

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aielegance.com',
      'X-Title': 'AI Elegance Shot Generator'
    },
    body: JSON.stringify(body)
  })

  const raw = await res.text()
  if (!res.ok) {
    console.warn('[generate-shots-ai] OpenRouter error:', res.status, raw.slice(0, 400))
    throw new Error(`OpenRouter error ${res.status}`)
  }

  let content = ''
  try {
    const j = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> }
    content = j.choices?.[0]?.message?.content || ''
  } catch {
    throw new Error('Invalid OpenRouter response')
  }

  const parsed = extractJsonWithShots(content)
  const arr = parsed?.shots
  if (!Array.isArray(arr) || arr.length < 1) {
    throw new Error('Model did not return a usable shots array')
  }

  const shots = normalizeShotsFromModelArray(arr)
  if (shots.length < 3) {
    throw new Error('Too few shots generated')
  }
  return shots.slice(0, 12)
}
