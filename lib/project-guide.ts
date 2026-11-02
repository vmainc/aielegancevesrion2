/** Shared types for the project-scoped AI guide (client + server). */

import {
  STUDIO_GUIDE_PROJECT_DESTINATIONS,
  validateStudioGuidePath
} from '~/lib/studio-guide'

export type GuideSuggestionTarget = 'project' | 'character' | 'director'

/** Validated in-app navigation from Project Guide replies. */
export type GuideAction = {
  id: string
  label: string
  path: string
  rationale?: string
}

export type GuideSuggestion = {
  id: string
  target: GuideSuggestionTarget
  field: string
  value: string
  label: string
  rationale: string
  characterId?: string
  characterName?: string
}

export type GuideChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  suggestions?: GuideSuggestion[]
  actions?: GuideAction[]
  createdAt: string
}

export const PROJECT_GUIDE_STORAGE_PREFIX = 'aielegance-project-guide-'

export function guideStorageKey (projectId: string): string {
  return `${PROJECT_GUIDE_STORAGE_PREFIX}${projectId}`
}

export function loadGuideMessages (projectId: string): GuideChatMessage[] {
  if (typeof localStorage === 'undefined' || !projectId) return []
  try {
    const raw = localStorage.getItem(guideStorageKey(projectId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is GuideChatMessage =>
        m &&
        typeof m === 'object' &&
        typeof (m as GuideChatMessage).id === 'string' &&
        ((m as GuideChatMessage).role === 'user' || (m as GuideChatMessage).role === 'assistant') &&
        typeof (m as GuideChatMessage).content === 'string'
    )
  } catch {
    return []
  }
}

export function saveGuideMessages (projectId: string, messages: GuideChatMessage[]): void {
  if (typeof localStorage === 'undefined' || !projectId) return
  try {
    localStorage.setItem(guideStorageKey(projectId), JSON.stringify(messages.slice(-80)))
  } catch {
    /* quota / private mode */
  }
}

export function newGuideMessageId (): string {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** Human labels for suggestion cards. */
export const GUIDE_FIELD_LABELS: Record<string, string> = {
  synopsis: 'Synopsis',
  treatment: 'Treatment',
  conceptNotes: 'Concept notes',
  genre: 'Genre',
  tone: 'Tone',
  continuityMemory: 'Continuity memory',
  'director.style': 'Director · Visual style',
  'director.tone': 'Director · Tone',
  'director.camera_preferences': 'Director · Camera',
  'director.lighting_style': 'Director · Lighting',
  'director.pacing': 'Director · Pacing',
  roleDescription: 'Role / look prompt',
  appearanceDescription: 'Appearance',
  personality: 'Personality',
  voiceDescription: 'Voice notes',
  signatureDetails: 'Signature details',
  avoidDescription: 'Avoid / never show'
}

const PB_ID = /^[a-z0-9]{15}$/

/** Standalone tools the Project Guide may link (with optional query rules). */
const PROJECT_GUIDE_STATIC_TOOL_PATHS = new Set([
  '/tools/script-wizard',
  '/tools/image-generation',
  '/tools/video-generation',
  '/tools/storyboard-builder',
  '/character-creator'
])

export type ProjectGuidePathContext = {
  projectId: string
  sceneIds: ReadonlySet<string>
  characterIds: ReadonlySet<string>
}

function splitPathAndQuery (raw: string): { barePath: string; search: string } {
  const path = String(raw || '').trim()
  const qIdx = path.indexOf('?')
  if (qIdx === -1) return { barePath: path.split('#')[0] || '', search: '' }
  const barePath = path.slice(0, qIdx).split('#')[0] || ''
  const search = path.slice(qIdx + 1).split('#')[0] || ''
  return { barePath, search }
}

function parseSearchParams (search: string): URLSearchParams {
  const params = new URLSearchParams()
  if (!search.trim()) return params
  for (const part of search.split('&')) {
    const [k, v] = part.split('=')
    if (!k) continue
    try {
      params.set(decodeURIComponent(k.trim()), decodeURIComponent((v || '').trim()))
    } catch {
      params.set(k.trim(), (v || '').trim())
    }
  }
  return params
}

function buildPathWithQuery (barePath: string, params: URLSearchParams): string {
  const q = params.toString()
  return q ? `${barePath}?${q}` : barePath
}

function validateVideoGenerationPath (
  ctx: ProjectGuidePathContext,
  barePath: string,
  search: string
): string | null {
  const params = parseSearchParams(search)
  const projectId = (params.get('projectId') || '').trim()
  if (projectId !== ctx.projectId) return null
  const sceneId = (params.get('sceneId') || '').trim()
  if (sceneId && !ctx.sceneIds.has(sceneId)) return null
  const shotId = (params.get('shotId') || '').trim()
  if (shotId && !PB_ID.test(shotId)) return null
  const out = new URLSearchParams()
  out.set('projectId', ctx.projectId)
  if (sceneId) out.set('sceneId', sceneId)
  if (shotId) out.set('shotId', shotId)
  return buildPathWithQuery(barePath, out)
}

function validateStoryboardPath (
  ctx: ProjectGuidePathContext,
  barePath: string,
  search: string
): string | null {
  const params = parseSearchParams(search)
  const scene = (params.get('scene') || '').trim()
  if (!scene) return barePath
  if (!ctx.sceneIds.has(scene)) return null
  const out = new URLSearchParams()
  out.set('scene', scene)
  return buildPathWithQuery(barePath, out)
}

function validateBiblePath (
  ctx: ProjectGuidePathContext,
  barePath: string,
  search: string
): string | null {
  const params = parseSearchParams(search)
  const cast = (params.get('cast') || '').trim()
  if (!cast) return barePath
  if (!ctx.characterIds.has(cast)) return null
  const out = new URLSearchParams()
  out.set('cast', cast)
  const name = (params.get('name') || '').trim()
  if (name) out.set('name', name.slice(0, 120))
  return buildPathWithQuery(barePath, out)
}

/**
 * Validate a path the model proposed for this project. Returns normalized path or null.
 */
export function validateProjectGuidePath (
  rawPath: string,
  ctx: ProjectGuidePathContext
): string | null {
  const path = String(rawPath || '').trim()
  if (!path.startsWith('/') || path.includes('://') || path.includes('..') || path.includes('\\')) {
    return null
  }

  const { barePath, search } = splitPathAndQuery(path)
  if (!barePath) return null

  if (PROJECT_GUIDE_STATIC_TOOL_PATHS.has(barePath)) {
    if (barePath === '/tools/video-generation') {
      return validateVideoGenerationPath(ctx, barePath, search)
    }
    if (search) return null
    return barePath
  }

  const validated = validateStudioGuidePath(barePath, new Set([ctx.projectId]))
  if (!validated) return null

  if (validated.endsWith('/storyboard')) {
    return validateStoryboardPath(ctx, validated, search)
  }
  if (validated.endsWith('/bible')) {
    return validateBiblePath(ctx, validated, search)
  }
  if (search) return null
  return validated
}

export function projectGuidePathContextFromIds (input: {
  projectId: string
  sceneIds?: Iterable<string>
  characterIds?: Iterable<string>
}): ProjectGuidePathContext {
  const projectId = String(input.projectId || '').trim()
  return {
    projectId,
    sceneIds: new Set([...(input.sceneIds || [])].filter(id => PB_ID.test(id))),
    characterIds: new Set([...(input.characterIds || [])].filter(id => PB_ID.test(id)))
  }
}

/** Destination catalog injected into the Project Guide system prompt. */
export function catalogProjectGuidePathsForPrompt (projectId: string): string {
  const pid = PB_ID.test(projectId) ? projectId : '{projectId}'
  const projectLines = STUDIO_GUIDE_PROJECT_DESTINATIONS.map(
    d => `- /projects/${pid}${d.suffix} — ${d.label}: ${d.description}`
  ).join('\n')
  const deepLinks = [
    `- /projects/${pid}/storyboard?scene={sceneId} — open Storyboard focused on a scene (use scene ids from SCENES)`,
    `- /projects/${pid}/bible?cast={characterId} — open Production Bible on a cast member (use character ids from CHARACTERS)`,
    `- /tools/video-generation?projectId=${pid}&sceneId={sceneId}&shotId={shotId} — open Video Generation for a panel (optional shotId)`,
    `- /tools/script-wizard — import or develop a screenplay`,
    `- /tools/image-generation — standalone image generation`
  ].join('\n')
  return `Project pages (this project only — use project id ${pid}):\n${projectLines}\n\nDeep links and tools:\n${deepLinks}`
}
