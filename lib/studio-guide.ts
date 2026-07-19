/** Studio-wide Guide — routing assistant (client + server). */

export type StudioGuideAction = {
  id: string
  label: string
  path: string
  rationale?: string
}

export type StudioGuideChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: StudioGuideAction[]
  createdAt: string
}

export type StudioGuideDestination = {
  id: string
  label: string
  description: string
  /** Absolute app path, or `/projects/{projectId}/…` template for project-scoped destinations. */
  path: string
  kind: 'static' | 'project'
}

export type StudioGuideProjectSummary = {
  id: string
  name: string
}

const PB_ID = /^[a-z0-9]{15}$/

/** Allowed static destinations the model may recommend. */
export const STUDIO_GUIDE_STATIC_DESTINATIONS: StudioGuideDestination[] = [
  {
    id: 'projects',
    label: 'Projects',
    description: 'Browse existing projects or start a new one.',
    path: '/projects',
    kind: 'static'
  },
  {
    id: 'import-script',
    label: 'Import a screenplay',
    description: 'Upload a script and turn it into scenes, cast, and storyboard.',
    path: '/tools/script-wizard',
    kind: 'static'
  },
  {
    id: 'video-generation',
    label: 'Generate video',
    description: 'Create clips with AI video models.',
    path: '/tools/video-generation',
    kind: 'static'
  },
  {
    id: 'music-generation',
    label: 'Generate music',
    description: 'Create soundtrack and music cues.',
    path: '/tools/music-generation',
    kind: 'static'
  },
  {
    id: 'character-creator',
    label: 'Create a character',
    description: 'Design a character look and save it to assets.',
    path: '/character-creator',
    kind: 'static'
  },
  {
    id: 'storyboard-builder',
    label: 'Storyboard builder',
    description: 'Standalone storyboard tool outside a project.',
    path: '/tools/storyboard-builder',
    kind: 'static'
  },
  {
    id: 'script-wizard',
    label: 'Script Wizard',
    description: 'Develop or refine a screenplay with AI.',
    path: '/tools/script-wizard',
    kind: 'static'
  },
  {
    id: 'assets',
    label: 'Assets',
    description: 'Browse videos, scripts, characters, storyboards, and music.',
    path: '/assets',
    kind: 'static'
  },
  {
    id: 'tools',
    label: 'Tools',
    description: 'All standalone creative tools.',
    path: '/tools',
    kind: 'static'
  },
  {
    id: 'account',
    label: 'Account',
    description: 'Account settings and profile.',
    path: '/account',
    kind: 'static'
  }
]

/** Allowed project-scoped destination suffixes (after `/projects/{id}`). */
export const STUDIO_GUIDE_PROJECT_SUFFIXES = [
  '/guide',
  '/overview',
  '/home',
  '/characters',
  '/director',
  '/scenes',
  '/storyboard',
  '/video',
  '/bible',
  '/review'
] as const

export type StudioGuideProjectSuffix = (typeof STUDIO_GUIDE_PROJECT_SUFFIXES)[number]

export const STUDIO_GUIDE_PROJECT_DESTINATIONS: Array<{
  id: string
  label: string
  description: string
  suffix: StudioGuideProjectSuffix
}> = [
  {
    id: 'project-guide',
    label: 'Project Guide',
    description: 'Chat about this project’s story, cast, and next steps.',
    suffix: '/guide'
  },
  {
    id: 'project-story',
    label: 'Story',
    description: 'Edit synopsis, treatment, and concept.',
    suffix: '/overview'
  },
  {
    id: 'project-steps',
    label: 'Steps',
    description: 'Project overview of workflow steps.',
    suffix: '/home'
  },
  {
    id: 'project-characters',
    label: 'Characters',
    description: 'Cast bible and character looks.',
    suffix: '/characters'
  },
  {
    id: 'project-director',
    label: 'Director',
    description: 'Visual tone and director bible.',
    suffix: '/director'
  },
  {
    id: 'project-scenes',
    label: 'Scenes',
    description: 'Scene list and breakdown.',
    suffix: '/scenes'
  },
  {
    id: 'project-storyboard',
    label: 'Storyboard',
    description: 'Panels, frames, and shot prompts.',
    suffix: '/storyboard'
  },
  {
    id: 'project-video',
    label: 'Project video',
    description: 'Render and review project video.',
    suffix: '/video'
  }
]

export const STUDIO_GUIDE_STORAGE_KEY = 'aielegance-studio-guide'

const STATIC_PATHS = new Set(STUDIO_GUIDE_STATIC_DESTINATIONS.map(d => d.path))
const PROJECT_SUFFIX_SET = new Set<string>(STUDIO_GUIDE_PROJECT_SUFFIXES)

export function isCloudProjectId (id: string): boolean {
  return PB_ID.test(id)
}

export function projectGuidePath (projectId: string): string {
  return `/projects/${projectId}/guide`
}

export function catalogPathForPrompt (): string {
  const staticLines = STUDIO_GUIDE_STATIC_DESTINATIONS.map(
    d => `- ${d.path} — ${d.label}: ${d.description}`
  ).join('\n')
  const projectLines = STUDIO_GUIDE_PROJECT_DESTINATIONS.map(
    d => `- /projects/{projectId}${d.suffix} — ${d.label}: ${d.description}`
  ).join('\n')
  return `Static destinations:\n${staticLines}\n\nProject destinations (replace {projectId} with an id from the user's projects):\n${projectLines}`
}

/**
 * Validate a path the model proposed. Returns the path if allowed, else null.
 * Project paths require the id to be in `allowedProjectIds`.
 */
export function validateStudioGuidePath (
  rawPath: string,
  allowedProjectIds: ReadonlySet<string> | readonly string[]
): string | null {
  const path = String(rawPath || '').trim()
  if (!path.startsWith('/') || path.includes('://') || path.includes('..') || path.includes('\\')) {
    return null
  }
  // Strip query/hash for allowlist check; keep path only.
  const bare = path.split('?')[0]?.split('#')[0] || ''
  if (!bare) return null

  if (STATIC_PATHS.has(bare)) return bare

  const m = bare.match(/^\/projects\/([a-z0-9]{15})(\/[\w-]+)?$/)
  if (!m) return null
  const projectId = m[1]!
  const suffix = m[2] || '/guide'
  const allowed =
    allowedProjectIds instanceof Set
      ? allowedProjectIds
      : new Set(allowedProjectIds)
  if (!allowed.has(projectId)) return null
  if (!PROJECT_SUFFIX_SET.has(suffix)) return null
  return `/projects/${projectId}${suffix}`
}

export function newStudioGuideMessageId (): string {
  return `sg${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function parseActions (raw: unknown): StudioGuideAction[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: StudioGuideAction[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (
      typeof o.id !== 'string' ||
      typeof o.label !== 'string' ||
      typeof o.path !== 'string'
    ) {
      continue
    }
    out.push({
      id: o.id,
      label: o.label,
      path: o.path,
      rationale: typeof o.rationale === 'string' ? o.rationale : undefined
    })
  }
  return out.length ? out : undefined
}

export function loadStudioGuideMessages (): StudioGuideChatMessage[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STUDIO_GUIDE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((m): m is StudioGuideChatMessage => {
      if (!m || typeof m !== 'object') return false
      const msg = m as StudioGuideChatMessage
      return (
        typeof msg.id === 'string' &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        typeof msg.content === 'string'
      )
    }).map(m => ({
      ...m,
      actions: parseActions(m.actions)
    }))
  } catch {
    return []
  }
}

export function saveStudioGuideMessages (messages: StudioGuideChatMessage[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STUDIO_GUIDE_STORAGE_KEY, JSON.stringify(messages.slice(-80)))
  } catch {
    /* quota / private mode */
  }
}

/** Starter chips shown on the empty Studio Guide state. */
export const STUDIO_GUIDE_STARTERS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Start a new project',
    prompt: 'I want to start a new film or content project.'
  },
  {
    label: 'Import a screenplay',
    prompt: 'I have a screenplay to import.'
  },
  {
    label: 'Generate video',
    prompt: 'I want to generate a video clip.'
  },
  {
    label: 'Create a character',
    prompt: 'I want to create a character look.'
  },
  {
    label: 'Continue a project',
    prompt: 'Help me continue one of my existing projects.'
  },
  {
    label: 'Browse my assets',
    prompt: 'Where can I find my saved videos and assets?'
  }
]
