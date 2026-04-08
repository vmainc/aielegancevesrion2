import type {
  CreativeProject,
  ProjectAspectRatio,
  ProjectDirector,
  ProjectGoal,
  ProjectTargetLength
} from '~/types/creative-project'

type PbProjectRecord = {
  id: string
  name: string
  aspect_ratio: string
  goal: string
  synopsis?: string
  treatment?: string
  concept_notes?: string
  genre?: string
  tone?: string
  themes?: unknown
  director?: unknown
  continuity_memory?: string
  continuity_last_issues?: string
  target_length?: string
  created?: string
  updated?: string
}

/** Flatten director bible for AI prompts (synopsis / scene / cast enrichment). */
export function formatDirectorForAiPrompt (d: ProjectDirector | undefined): string {
  if (!d) return ''
  const chunks: string[] = []
  if (d.style?.trim()) chunks.push(`Visual style: ${d.style.trim()}`)
  if (d.tone?.trim()) chunks.push(`Directorial tone: ${d.tone.trim()}`)
  if (d.camera_preferences?.trim()) chunks.push(`Camera preferences: ${d.camera_preferences.trim()}`)
  if (d.lighting_style?.trim()) chunks.push(`Lighting: ${d.lighting_style.trim()}`)
  if (d.pacing?.trim()) chunks.push(`Pacing: ${d.pacing.trim()}`)
  return chunks.join('\n').slice(0, 6000)
}

export function parseDirectorField (raw: unknown): ProjectDirector | undefined {
  if (raw == null) return undefined
  if (typeof raw === 'string') {
    try {
      return parseDirectorField(JSON.parse(raw))
    } catch {
      return undefined
    }
  }
  if (typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  return {
    name: typeof o.name === 'string' ? o.name : '',
    style: typeof o.style === 'string' ? o.style : '',
    tone: typeof o.tone === 'string' ? o.tone : '',
    camera_preferences: typeof o.camera_preferences === 'string' ? o.camera_preferences : '',
    lighting_style: typeof o.lighting_style === 'string' ? o.lighting_style : '',
    pacing: typeof o.pacing === 'string' ? o.pacing : ''
  }
}

export function pbRecordToCreativeProject (r: PbProjectRecord): CreativeProject {
  let themes: string[] | undefined
  if (Array.isArray(r.themes)) {
    themes = r.themes.filter((x): x is string => typeof x === 'string')
  } else if (r.themes && typeof r.themes === 'object') {
    themes = undefined
  }

  const director = parseDirectorField(r.director)

  const tl = r.target_length as ProjectTargetLength | undefined
  const targetLength: ProjectTargetLength | undefined =
    tl === 'spot' || tl === 'short' || tl === 'episode' || tl === 'feature' ? tl : undefined

  return {
    id: r.id,
    name: r.name,
    aspectRatio: (r.aspect_ratio || '16:9') as ProjectAspectRatio,
    goal: (r.goal || 'film') as ProjectGoal,
    targetLength,
    synopsis: r.synopsis || '',
    treatment: r.treatment || '',
    conceptNotes: r.concept_notes || '',
    genre: r.genre,
    tone: r.tone,
    themes,
    director,
    continuityMemory: r.continuity_memory || '',
    continuityLastIssues: r.continuity_last_issues || '',
    createdAt: r.created || new Date().toISOString(),
    updatedAt: r.updated || new Date().toISOString(),
    source: 'pocketbase'
  }
}
