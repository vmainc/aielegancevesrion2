import type { ProjectDirector } from '~/types/creative-project'
import {
  durationBudgetPromptBlock,
  fitShotsToSceneCap,
  type ProjectDurationBudget
} from '~/lib/project-duration-budget'
import { isAnimalOnlyCast } from '~/lib/storyboard-continuity-prompts'
import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'
import { OPENROUTER_TEXT_MODEL_MAP } from '~/server/utils/openrouter-text-models'

export interface GeneratedShot {
  order: number
  title: string
  description: string
  shot_type: string
  camera_move: string
  duration_seconds: number
  image_prompt: string
  video_prompt: string
  negative_prompt: string
  /** Exact cast names visible in this panel (from CHARACTERS list). */
  characters?: string[]
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
  openrouterModelId?: string
  durationBudget?: ProjectDurationBudget | null
  /** When set, overrides budget min/max for this scene (project-wide allocation). */
  sceneShotCap?: { minShots: number; maxShots: number } | null
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

function firstStr (o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function buildFallbackVideoPrompt (
  description: string,
  cameraMove: string,
  shotType: string
): string {
  const move = cameraMove || 'subtle camera movement'
  const type = shotType || 'cinematic'
  return `${description}. ${type}, ${move}, atmospheric lighting, filmic motion.`.slice(0, 8000)
}

function parseShotCharacterNames (o: Record<string, unknown>): string[] {
  const raw = o.characters ?? o.cast ?? o.character_names ?? o.characterNames
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const name = typeof item === 'string'
      ? item.trim()
      : item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string'
        ? String((item as { name: string }).name).trim()
        : ''
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name.slice(0, 120))
  }
  return out.slice(0, 12)
}

/** Reconcile order field: prefer 1-based order from model, fall back to index. */
export function normalizeShotsFromModelArray (rawList: unknown[]): GeneratedShot[] {
  const out: GeneratedShot[] = []
  rawList.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return
    const o = raw as Record<string, unknown>
    const orderVal = Math.floor(num(o.order, i + 1))
    const title = firstStr(o, 'title') || `Shot ${i + 1}`
    const description = firstStr(o, 'description', 'summary', 'beat') || title
    const shot_type = firstStr(o, 'shot_type', 'shotType', 'type') || 'medium shot'
    const camera_move = firstStr(o, 'camera_move', 'cameraMove', 'camera') || 'static'
    let image_prompt = firstStr(o, 'image_prompt', 'imagePrompt', 'still_prompt', 'stillPrompt')
    let video_prompt = firstStr(o, 'video_prompt', 'videoPrompt', 'motion_prompt', 'motionPrompt')
    if (!image_prompt) image_prompt = description
    if (!video_prompt) {
      video_prompt = buildFallbackVideoPrompt(description, camera_move, shot_type)
    }
    const negative_prompt = firstStr(
      o,
      'negative_prompt',
      'negativePrompt',
      'negative',
      'exclusions'
    )
    if (!image_prompt.trim()) return
    const characters = parseShotCharacterNames(o)
    out.push({
      order: orderVal,
      title: title.slice(0, 300),
      description: description.slice(0, 5000),
      shot_type: shot_type.slice(0, 200),
      camera_move: camera_move.slice(0, 200),
      duration_seconds: snapToStoryboardClipSeconds(
        num(o.duration_seconds, num(o.durationSeconds, 5))
      ),
      image_prompt: image_prompt.slice(0, 8000),
      video_prompt: video_prompt.slice(0, 8000),
      negative_prompt: negative_prompt.slice(0, 4000),
      ...(characters.length ? { characters } : {})
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
      ? `Goal: social — first 1–2 shots must be a strong hook; faster pacing; use duration_seconds 5 for most panels (10 only when the beat needs room).`
      : ctx.goal === 'film'
        ? `Goal: film — slower, atmospheric pacing; prefer duration_seconds 10 for mood beats, 5 for quicker cuts.`
        : ctx.goal === 'commercial'
          ? `Goal: commercial/ad — clear product or message readability; confident, polished look; varied shot sizes for cut points.`
          : `Goal: ${ctx.goal} — balanced pacing suitable for the format.`

  const charBlock =
    ctx.characters.length > 0
      ? ctx.characters
          .map((c) => {
            const token = c.name.trim().replace(/\s+/g, ' ').toUpperCase()
            return `- ${token}: ${c.traitsRoleVisual || 'role and look to be inferred from script'}`
          })
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

  const budget = ctx.durationBudget
  const shotMax = ctx.sceneShotCap?.maxShots ?? (budget ? budget.maxShotsPerScene : 6)
  const shotMin = ctx.sceneShotCap?.minShots ?? (budget ? Math.min(budget.minShotsPerScene, shotMax) : 1)
  if (shotMax < 1) {
    throw new Error(
      budget
        ? `This scene is outside the ${budget.totalSeconds}s runtime budget (${budget.maxPanelsTotal} panels max). Remove extra scenes or raise target runtime on Overview.`
        : 'No shots to generate for this scene'
    )
  }

  const animalOnly = isAnimalOnlyCast(
    ctx.characters.map(c => ({ name: c.name, traitsRoleVisual: c.traitsRoleVisual }))
  )
  const animalRules = animalOnly
    ? `
ANIMAL-ONLY CAST (critical):
- This project uses NON-HUMAN animal/creature characters only. NEVER describe or imply humans, people, human faces, human hands, or human silhouettes in any shot.
- Every image_prompt must name which animal characters are visible and paste their FULL visual design from CHARACTERS (species, fur/feathers, colors, clothing, props, expression style).
- negative_prompt on every shot MUST include: no humans, no people, no human faces, no human hands, no realistic human figures.`
    : ''

  const system = `You are a professional storyboard artist and director of photography focused on VISUAL CONTINUITY across panels. You break each scene into a clear SEQUENCE OF PANELS — strict story order (establish geography → develop action → emotional turn → cut point).

Output ONLY valid JSON (no markdown), exactly this shape:
{"shots":[{"order":1,"title":"short label","description":"story beat in plain language","shot_type":"e.g. wide establishing | medium | close-up | insert","camera_move":"e.g. slow push in | handheld | static","duration_seconds":5,"characters":["ONLY names from CHARACTERS who are visible in THIS panel — empty array if none"],"image_prompt":"LONG detailed still-frame prompt (see rules)","video_prompt":"LONG motion prompt (see rules)","negative_prompt":"comma-separated exclusions"}]}
Rules:
- Produce ${shotMin === shotMax ? `exactly ${shotMax}` : `between ${shotMin} and ${shotMax}`} shots for THIS scene only; order 1..N; duration_seconds MUST be exactly 5 or 10 (integer).
- characters: array of exact character names from CHARACTERS who appear on-screen in THIS panel only. Empty [] for establishing/environment inserts with no people. Never list the whole cast.
- image_prompt: MINIMUM ~120 words. Production-ready STILL frame. START with the UNIQUE action, pose, and composition for THIS panel only (order N) — each panel must look like a different moment. Then include: (1) which cast members appear (must match the characters array) and their COMPLETE visual design copied from CHARACTERS (materials, colors, proportions, wardrobe, expression); (2) locked environment/props/lighting for this scene; (3) lens/framing for shot_type; (4) same art direction as director bible. Repeat the same character DESIGN wording across shots for consistency — never repeat the same pose, blocking, or framing.
- video_prompt: MINIMUM ~80 words. Motion-only delta on the still: camera_move, subject action, lighting shifts — do NOT introduce new characters or redesign anyone.
- negative_prompt: comma-separated forbidden elements (watermark, text, blurry, wrong species, extra characters, style drift).${animalRules}
- Same character = SAME design in every panel; close-ups must match wide shots.
- CAST NAMES IN ALL CAPS: In every image_prompt and video_prompt, refer to cast members only with their ALL CAPS token from CHARACTERS (e.g. DOG, CAT). These are proper character names — not generic animals. Never write lowercase "dog" or "cat" when you mean the cast character.
- Vary shot scale on purpose (establish, medium, close-up, insert) but keep location palette and set dressing consistent unless the script changes location.
- Interpret summary and script; imperfect formatting is OK.`

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
${budget ? `${durationBudgetPromptBlock(budget, ctx.sceneShotCap ?? undefined)}\n\n` : ''}${charBlock}`

  const body = buildOpenRouterChatCompletionBody({
    model: ctx.openrouterModelId || OPENROUTER_TEXT_MODEL_MAP.Claude,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.35,
    max_tokens: 12_288
  })

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 180_000)
  let res: Response
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aielegance.com',
        'X-Title': 'AI Elegance Storyboard'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
  } finally {
    clearTimeout(t)
  }

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

  const normalized = normalizeShotsFromModelArray(arr)
  let shots = normalized
  if (shots.length < shotMin && shotMin > 1) {
    console.warn(
      '[generate-shots-ai] Too few normalized shots:',
      shots.length,
      'from raw array length',
      arr.length
    )
    throw new Error(
      shots.length === 0
        ? 'Model returned shots but none had usable prompts — try again'
        : `Too few shots generated (${shots.length}); need at least ${shotMin}`
    )
  }
  if (shots.length === 0) {
    throw new Error('Model returned shots but none had usable prompts — try again')
  }
  shots = fitShotsToSceneCap(shots, shotMax, budget?.clipSeconds ?? 5)
  return shots
}
