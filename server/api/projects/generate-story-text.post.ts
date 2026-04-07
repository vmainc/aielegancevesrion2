import { createError, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'
import { targetLengthModelGuidance } from '~/lib/target-length'
import type { ProjectTargetLength } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

const DEFAULT_MODEL =
  process.env.NUXT_OPENROUTER_STORY_MODEL ||
  process.env.OPENROUTER_STORY_MODEL ||
  'openai/gpt-4o-mini'

function maxOutTokens (kind: 'script' | 'treatment', length: ProjectTargetLength | undefined): number {
  const L = length || 'short'
  const scriptCaps: Record<ProjectTargetLength, number> = {
    spot: 2800,
    short: 6500,
    episode: 12000,
    feature: 16000
  }
  const treatCaps: Record<ProjectTargetLength, number> = {
    spot: 2000,
    short: 5000,
    episode: 9000,
    feature: 14000
  }
  return kind === 'script' ? scriptCaps[L] : treatCaps[L]
}

function buildProjectContextBlock (p: ReturnType<typeof pbRecordToCreativeProject>): string {
  const d = p.director
  const dir = d
    ? `Director bible: style ${d.style}; tone ${d.tone}; camera ${d.camera_preferences}; lighting ${d.lighting_style}; pacing ${d.pacing}.`
    : ''
  const themes = p.themes?.length ? `Themes: ${p.themes.join(', ')}.` : ''
  return [
    `Title: ${p.name}`,
    `Aspect: ${p.aspectRatio}. Goal: ${p.goal}.`,
    p.genre ? `Genre: ${p.genre}.` : '',
    p.tone ? `Tone: ${p.tone}.` : '',
    themes,
    dir,
    `Synopsis:\n${p.synopsis || '(none yet)'}`,
    `Existing treatment (may revise or extend):\n${p.treatment || '(none)'}`,
    `Notes / continuity:\n${p.conceptNotes || '(none)'}`
  ]
    .filter(Boolean)
    .join('\n\n')
}

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody(event).catch(() => null) as {
    projectId?: string
    kind?: string
  } | null

  const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : ''
  const kind = body?.kind === 'treatment' ? 'treatment' : body?.kind === 'script' ? 'script' : ''
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'projectId is required' })
  }
  if (kind !== 'script' && kind !== 'treatment') {
    throw createError({ statusCode: 400, message: 'kind must be "script" or "treatment"' })
  }
  if (!PB_ID.test(projectId)) {
    throw createError({
      statusCode: 400,
      message: 'Story generation needs a project saved to your account (cloud id).'
    })
  }

  const pb = await getAuthenticatedPocketBase()
  let projectRow: Record<string, unknown>
  try {
    projectRow = await pb.collection('creative_projects').getOne(projectId) as Record<string, unknown>
  } catch (e: unknown) {
    const err = e as { status?: number; response?: { status?: number } }
    if (err?.status === 404 || err?.response?.status === 404) {
      throw createError({ statusCode: 404, message: 'Project not found' })
    }
    throw e
  }
  const owner = pbRecordOwnerId(projectRow as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const project = pbRecordToCreativeProject(projectRow as Parameters<typeof pbRecordToCreativeProject>[0])
  const length = project.targetLength || 'short'
  const lengthGuide = targetLengthModelGuidance(length)

  const system =
    kind === 'script'
      ? `You are an experienced screenwriter. Write in plain text using common screenplay conventions: slug lines (INT./EXT. LOCATION - TIME), action lines, CHARACTER names in caps before dialogue, parentheticals sparingly.

${lengthGuide}

Do not include markdown code fences. Do not preface with an essay — start with the screenplay. If context is thin, invent specific, cinematic detail that still fits the synopsis.`
      : `You are a film development writer. Write a clear prose story treatment (paragraphs, optional short act labels if helpful). Match depth and subplot count to the runtime target below.

${lengthGuide}

Do not use markdown headings unless minimal. No code fences. Start with the treatment prose.`

  const userMsg = `Use this project context:\n\n${buildProjectContextBlock(project)}\n\nTarget length profile: ${length}.\n\n${kind === 'script' ? 'Write the screenplay draft now.' : 'Write the story treatment now.'}`

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throw createError({
      statusCode: 503,
      message: 'OpenRouter API key not configured for the server.'
    })
  }

  const model = DEFAULT_MODEL
  const max_tokens = maxOutTokens(kind, length)

  const reqBody = buildOpenRouterChatCompletionBody({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMsg }
    ],
    temperature: 0.72,
    max_tokens
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
  const t = setTimeout(() => controller.abort(), 180_000)
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify(reqBody),
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
    throw createError({ statusCode: 502, message: msg })
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    throw createError({ statusCode: 502, message: 'Empty model response' })
  }

  const trimmed = text.trim()
  const patch: Record<string, unknown> = {}
  if (kind === 'script') {
    patch.concept_notes = trimmed
  } else {
    patch.treatment = trimmed
  }

  const updated = await pb.collection('creative_projects').update(projectId, patch)
  const updatedProject = pbRecordToCreativeProject(updated as Parameters<typeof pbRecordToCreativeProject>[0])

  return {
    kind,
    project: updatedProject,
    model
  }
})
